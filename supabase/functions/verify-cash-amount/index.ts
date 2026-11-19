import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(() => new Response(JSON.stringify({
  error: "Cash ownership verification is handled by the Lost & Found Office.",
}), {
  status: 410,
  headers: { "Content-Type": "application/json" },
}));
