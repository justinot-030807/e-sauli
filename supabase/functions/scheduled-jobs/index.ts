import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const routines = {
  expiration: "expire_stale_items",
  auto_confirm: "auto_confirm_released_items",
  reminders: "remind_unconfirmed_claims",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

async function cleanupPhotos(client: SupabaseClient) {
  const startedAt = new Date().toISOString();
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: items, error } = await client.from("items")
    .select("id, photo_path")
    .not("photo_path", "is", null)
    .or(`and(status.eq.returned,released_at.lt.${cutoff}),and(status.eq.expired,expires_at.lt.${cutoff})`)
    .order("id")
    .limit(100);
  if (error) throw error;

  const paths = (items ?? []).map((item) => item.photo_path as string);
  if (paths.length) {
    const { error: storageError } = await client.storage.from("item-photos").remove(paths);
    if (storageError) throw storageError;
    const { error: updateError } = await client.from("items")
      .update({ photo_path: null }).in("id", items!.map((item) => item.id));
    if (updateError) throw updateError;
  }
  const { error: logError } = await client.from("job_logs").insert({
    job_name: "photo_cleanup",
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    status: "success",
  });
  if (logError) throw logError;
  return paths.length;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Missing server configuration" }, 500);

  const token = req.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({ error: "Unauthorized" }, 401);

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (token !== key) {
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return json({ error: "Unauthorized" }, 401);
    const { data: profile, error: profileError } = await client.from("profiles")
      .select("id").eq("id", user.id).eq("role", "admin")
      .eq("approval_status", "approved").eq("is_suspended", false)
      .is("deleted_at", null).maybeSingle();
    if (profileError || !profile) return json({ error: "Forbidden" }, 403);
  }

  const body = await req.json().catch(() => null);
  const job = body?.job;
  const jobs = [...Object.keys(routines), "photo_cleanup"];
  if (job !== "all" && !jobs.includes(job)) return json({ error: "Invalid job" }, 400);

  const results: Record<string, number | { error: string }> = {};
  for (const name of job === "all" ? jobs : [job]) {
    try {
      if (name === "photo_cleanup") {
        results[name] = await cleanupPhotos(client);
      } else {
        const { data, error } = await client.rpc(routines[name as keyof typeof routines]);
        if (error) throw error;
        results[name] = data as number;
      }
    } catch (error) {
      console.error("Maintenance job failed", name, error);
      results[name] = { error: "Nabigo ang maintenance job." };
    }
  }
  return json({ results });
});
