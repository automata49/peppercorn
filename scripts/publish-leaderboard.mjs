// LEADERBOARD-STATIC-1: write dist/data/leaderboard.json from the live leaderboard function for the Pages deployment.
// A failed or implausible fetch publishes nothing (the app then reads the live function), never a partial file.
import {mkdirSync, writeFileSync, readFileSync} from 'node:fs';
const url = 'https://mhbcchegrbakearqptdr.supabase.co/functions/v1/leaderboard?client=peppercorn-public-read-v1';
try {
  // Server-only export of the same already-public view. Never export account tables.
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const res = token
    ? await fetch('https://api.supabase.com/v1/projects/mhbcchegrbakearqptdr/database/query', {
        method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({query: 'select * from public.leaderboard_view order by rs_rank desc nulls last, market asc, ticker asc'}),
        signal: AbortSignal.timeout(90_000)})
    : await fetch(url, {signal: AbortSignal.timeout(90_000)});
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const result = await res.json();
  const payload = token ? {rows: result} : result;
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const equities = rows.filter(r => r.asset_class === 'Equity').length;
  if (rows.length < 1000 || equities < 900) throw new Error(`implausible payload: ${rows.length} rows, ${equities} equities`);
  mkdirSync('dist/data', {recursive: true});
  const body = JSON.stringify({published_at: new Date().toISOString(), source: 'snapshot', updated_at: payload.updated_at, rows});
  writeFileSync('dist/data/leaderboard.json', body);
  console.log(`Published ${rows.length} rows (${(body.length / 1e6).toFixed(2)} MB before compression)`);
} catch (e) {
  // A reviewed public recovery export is allowed only with its original timestamp.
  try {
    const saved = JSON.parse(readFileSync('public/data/leaderboard.json', 'utf8'));
    if (saved.recovery !== true || saved.rows?.length < 1000 || !Number.isFinite(Date.parse(saved.published_at))) throw Error('no recovery snapshot');
    mkdirSync('dist/data', {recursive: true});
    writeFileSync('dist/data/leaderboard.json', JSON.stringify(saved));
    console.log(`::warning::Using dated public recovery snapshot (${e.message}); source refresh remains unavailable`);
  } catch {
    console.error(`leaderboard snapshot not published: ${e.message}`);
    process.exitCode = 1;
  }
}
