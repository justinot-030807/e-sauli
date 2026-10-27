// Supabase Edge Function: verify-cash-amount
// Enforces server-side Cash & Wallet amount verification using secret HMAC.
// Never exposes stored amounts, plain hashes, or distance metrics.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeAmount(input: string): string {
  if (!input) return "";
  // Strip currency symbols (₱, P, PHP), commas, and spaces
  let cleaned = input.trim().toUpperCase();
  cleaned = cleaned.replace(/^(PHP|₱|P)\s*/i, "");
  cleaned = cleaned.replace(/,/g, "").trim();

  const num = parseFloat(cleaned);
  if (isNaN(num)) return cleaned;
  // If whole integer (e.g. 500.00 -> 500), strip redundant decimals
  return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
}

async function computeHmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const hmacSecret = Deno.env.get("ITEM_HMAC_SECRET") ?? "campus_default_secret_hmac_salt";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing server environment configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Client with service role to query private tables
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    // Client with caller's token to verify user session
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized access" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { itemId, amountGuess } = await req.json();

    if (!itemId || amountGuess === undefined) {
      return new Response(
        JSON.stringify({ error: "itemId and amountGuess are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if claimant is the finder/owner (cannot claim own post)
    const { data: itemData, error: itemError } = await adminSupabase
      .from("items")
      .select("id, user_id, status")
      .eq("id", itemId)
      .single();

    if (itemError || !itemData) {
      return new Response(
        JSON.stringify({ error: "Item not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (itemData.user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "Hindi maaaring i-claim ang sariling post" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check 3-attempt lockout policy
    const { count: failedAttempts } = await adminSupabase
      .from("claim_attempts")
      .select("*", { count: "exact", head: true })
      .eq("item_id", itemId)
      .eq("user_id", user.id)
      .eq("matched", false);

    // Check if lockout was overridden by admin
    const { data: overrideData } = await adminSupabase
      .from("claim_lockout_overrides")
      .select("id")
      .eq("item_id", itemId)
      .eq("user_id", user.id)
      .maybeSingle();

    if ((failedAttempts ?? 0) >= 3 && !overrideData) {
      return new Response(
        JSON.stringify({
          status: "LOCKED",
          message: "Naka-lock out ang verification matapos ang 3 maling pagtatangka. Makipag-ugnayan sa Admin.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch stored HMAC from item_private
    const { data: privateData, error: privateError } = await adminSupabase
      .from("item_private")
      .select("amount_hmac")
      .eq("item_id", itemId)
      .maybeSingle();

    if (privateError || !privateData?.amount_hmac) {
      return new Response(
        JSON.stringify({ error: "Walang naka-imbak na halaga para sa verification ng gamit na ito" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compute HMAC for the submitted guess
    const normalized = normalizeAmount(String(amountGuess));
    const computedHmac = await computeHmacSha256(hmacSecret, normalized);

    const isMatch = computedHmac === privateData.amount_hmac;

    // Log the verification attempt
    await adminSupabase.from("claim_attempts").insert({
      item_id: itemId,
      user_id: user.id,
      matched: isMatch,
    });

    return new Response(
      JSON.stringify({
        status: isMatch ? "MATCH" : "NO_MATCH",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
