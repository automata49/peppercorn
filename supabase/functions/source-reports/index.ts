import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const origins = new Set(["https://automata49.github.io", "http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:4173"]);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = { "Access-Control-Allow-Origin": origin && origins.has(origin) ? origin : "https://automata49.github.io", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,OPTIONS", "Vary": "Origin", "Cache-Control": "private, no-store" };
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers });
  if (origin && !origins.has(origin)) return reply({ error: "origin_not_allowed" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET") return reply({ error: "method_not_allowed" }, 405);
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return reply({ error: "missing_auth" }, 401);
  const base = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!base || !key) return reply({ error: "not_configured" }, 503);
  const requestHeaders = { apikey: key, Authorization: auth };
  try {
    // Verify the user with Auth; never authorize using an unverified JWT payload.
    const verified = await fetch(base + "/auth/v1/user", { headers: requestHeaders });
    if (!verified.ok) return reply({ error: "invalid_auth" }, 401);
    const user = await verified.json();
    if (typeof user.id !== "string") return reply({ error: "invalid_auth" }, 401);
    const id = new URL(req.url).searchParams.get("id");
    if (id !== null && !/^[A-Za-z0-9_-]{10,100}$/.test(id)) return reply({ error: "invalid_id" }, 400);
    const fields = "drive_file_id,title,source_url,source_modified_at,imported_at,summary,content_hash" + (id ? ",pages,links" : "");
    const query = new URLSearchParams({ user_id: "eq." + user.id, select: fields, order: "source_modified_at.desc,drive_file_id.asc", limit: id ? "1" : "100" });
    if (id) query.set("drive_file_id", "eq." + id);
    // The user's bearer is forwarded: RLS applies independently of this filter.
    const result = await fetch(base + "/rest/v1/private_source_reports?" + query, { headers: requestHeaders });
    if (!result.ok) return reply({ error: "reports_unavailable" }, 502);
    return reply({ rows: await result.json() });
  } catch { return reply({ error: "reports_unavailable" }, 502); }
});
