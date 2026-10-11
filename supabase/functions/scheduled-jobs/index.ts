// Supabase Edge Function: scheduled-jobs
// Handles automated background maintenance:
// 1. Auto-expiration (30 days)
// 2. Auto-confirmation (7 days post-handover)
// 3. Storage Photo Cleanup (physical deletion after 60 days via Storage API)
// 4. Day 5 Return Reminders for owners

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing server environment configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({ job: "all" }));
    const requestedJob = body.job || "all";
    const results: Record<string, any> = {};

    // 1. AUTO-EXPIRATION (30 Days)
    if (requestedJob === "all" || requestedJob === "expiration") {
      const { data, error } = await adminSupabase.rpc("run_auto_expiration_job");
      results.expiration = error ? { error: error.message } : data;
    }

    // 2. AUTO-CONFIRMATION (7 Days post-handover)
    if (requestedJob === "all" || requestedJob === "auto_confirm") {
      const { data, error } = await adminSupabase.rpc("run_auto_confirm_job");
      results.auto_confirm = error ? { error: error.message } : data;
    }

    // 3. STORAGE PHOTO CLEANUP (60 Days post-resolution)
    if (requestedJob === "all" || requestedJob === "photo_cleanup") {
      const jobStart = new Date().toISOString();
      const cutoffDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const { data: oldItems, error: itemsError } = await adminSupabase
        .from("items")
        .select("id, photo_path")
        .in("status", ["returned", "expired"])
        .not("photo_path", "is", null)
        .lt("created_at", cutoffDate);

      if (itemsError) {
        results.photo_cleanup = { error: itemsError.message };
      } else if (oldItems && oldItems.length > 0) {
        const paths = oldItems.map((item) => item.photo_path).filter(Boolean);
        const { error: storageError } = await adminSupabase.storage
          .from("item-photos")
          .remove(paths);

        if (!storageError) {
          // Clear photo_path from rows
          await adminSupabase
            .from("items")
            .update({ photo_path: null })
            .in("id", oldItems.map((i) => i.id));

          await adminSupabase.from("job_logs").insert({
            job_name: "photo_cleanup_job",
            started_at: jobStart,
            completed_at: new Date().toISOString(),
            status: "success",
            error_message: null,
          });

          results.photo_cleanup = { deleted_count: paths.length };
        } else {
          await adminSupabase.from("job_logs").insert({
            job_name: "photo_cleanup_job",
            started_at: jobStart,
            completed_at: new Date().toISOString(),
            status: "failed",
            error_message: storageError.message,
          });
          results.photo_cleanup = { error: storageError.message };
        }
      } else {
        await adminSupabase.from("job_logs").insert({
          job_name: "photo_cleanup_job",
          started_at: jobStart,
          completed_at: new Date().toISOString(),
          status: "success",
          error_message: null,
        });
        results.photo_cleanup = { deleted_count: 0 };
      }
    }

    // 4. DAY 5 RETURN REMINDER
    if (requestedJob === "all" || requestedJob === "reminders") {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

      const { data: reminderItems } = await adminSupabase
        .from("items")
        .select(`
          id,
          title,
          claims!inner(id, claimant_id, status)
        `)
        .eq("status", "released")
        .eq("claims.status", "approved")
        .lte("released_at", fiveDaysAgo)
        .gte("released_at", sixDaysAgo);

      let notifiedCount = 0;
      if (reminderItems && reminderItems.length > 0) {
        for (const item of reminderItems) {
          const claimantId = (item.claims as any)?.[0]?.claimant_id;
          if (claimantId) {
            await adminSupabase.from("notifications").insert({
              user_id: claimantId,
              type: "return_reminder",
              body: `Paalala ukol sa "${item.title}": 2 araw na lamang bago awtomatikong kumpirmahin ang pagkakabalik. Kung may dispute, i-report ito kaagad.`,
              item_id: item.id,
              read: false,
            });
            notifiedCount++;
          }
        }
      }
      results.reminders = { notified_count: notifiedCount };
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to execute scheduled job" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
