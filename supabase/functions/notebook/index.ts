import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const origins = new Set(["https://automata49.github.io", "http://localhost:5173", "http://127.0.0.1:5173"]);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = {"Access-Control-Allow-Origin": origin && origins.has(origin) ? origin : "https://automata49.github.io", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", Vary: "Origin"};
  const json = (data: unknown, status = 200) => Response.json(data, {status, headers});
  if (req.method === "OPTIONS") return new Response(null, {status: 204, headers});
  if (origin && !origins.has(origin)) return json({error: "origin_not_allowed"}, 403);
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({error: "missing_auth"}, 401);
  const url = Deno.env.get("SUPABASE_URL")!, apikey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeaders = {apikey, Authorization: authorization, "Content-Type": "application/json"};
  // Verify with Auth; every database request retains the caller JWT and owner RLS.
  const user = await fetch(url + "/auth/v1/user", {headers: authHeaders});
  if (!user.ok) return json({error: "invalid_auth"}, 401);
  if (new URL(req.url).searchParams.get("resource") === "basket") {
    const uid = (await user.json()).id;
    if (req.method === "POST") {
      const raw = await req.text();if(raw.length > 500000) return json({error:"payload_too_large"},413);
      let changes:any;try{changes=JSON.parse(raw).changes}catch{return json({error:"invalid_json"},400)}
      if(!Array.isArray(changes)||changes.length>1000||changes.some(c=>!c||!['KR','US'].includes(c.market)||typeof c.ticker!=='string'||!c.ticker||c.ticker.length>40||typeof c.name!=='string'||c.name.length>200||typeof c.removed!=='boolean'))return json({error:"invalid_changes"},400);
      if(changes.length){const saved=await fetch(url+'/rest/v1/folio_basket_items?on_conflict=user_id,market,ticker',{method:'POST',headers:{...authHeaders,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(changes.map(c=>({user_id:uid,market:c.market,ticker:c.ticker,name:c.name,removed:c.removed})))});if(!saved.ok)return json({error:'write_failed'},502)}
    } else if(req.method!=="GET") return json({error:"method_not_allowed"},405);
    const response=await fetch(url+'/rest/v1/folio_basket_items?select=market,ticker,name,removed&order=market.asc,ticker.asc&limit=1000',{headers:authHeaders});
    if(!response.ok)return json({error:'read_failed'},502);
    const rows=await response.json();return json({items:rows.filter((r:any)=>!r.removed).map(({market,ticker,name}:any)=>({market,ticker,name})),known:rows.map((r:any)=>r.market+':'+r.ticker)});
  }
  if (req.method === "GET") {
    const response = await fetch(url + "/rest/v1/notebook_entries?select=entry&order=id.asc&limit=1000", {headers: authHeaders});
    if (!response.ok) return json({error: "read_failed"}, 502);
    const rows = await response.json();
    return json({entries: rows.map((r: {entry: unknown}) => r.entry)});
  }
  if (req.method !== "POST") return json({error: "method_not_allowed"}, 405);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > 20000000) return json({error: "payload_too_large"}, 413);
  let entries: unknown;
  try { entries = JSON.parse(raw).entries; } catch { return json({error: "invalid_json"}, 400); }
  if (!Array.isArray(entries) || entries.length > 1000 || entries.some(e => !e || typeof e.id !== "string" || !e.id || e.id.length > 200 || typeof e.title !== "string" || !Array.isArray(e.revisions) || !Number.isFinite(Date.parse(e.updatedAt)) || !Number.isFinite(Date.parse(e.createdAt)))) return json({error: "invalid_entries"}, 400);
  const response = await fetch(url + "/rest/v1/rpc/save_notebook_entries", {method: "POST", headers: authHeaders, body: JSON.stringify({updates: entries})});
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return json({error: error.code === "40001" ? "edit_conflict" : "write_failed"}, error.code === "40001" ? 409 : 502);
  }
  return json({entries});
});
