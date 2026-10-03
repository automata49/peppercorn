// LEADERBOARD-STATIC-1: write dist/data/leaderboard.json from the live leaderboard function for the Pages deployment.
// A failed or implausible fetch publishes nothing (the app then reads the live function), never a partial file.
import {mkdirSync, writeFileSync} from 'node:fs';
const url = 'https://mhbcchegrbakearqptdr.supabase.co/functions/v1/leaderboard?client=peppercorn-public-read-v1';
try {
  const res = await fetch(url, {signal: AbortSignal.timeout(90_000)});
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const payload = await res.json();
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const equities = rows.filter(r => r.asset_class === 'Equity').length;
  if (rows.length < 1000 || equities < 900) throw new Error(`implausible payload: ${rows.length} rows, ${equities} equities`);
  mkdirSync('dist/data', {recursive: true});
  const body = JSON.stringify({published_at: new Date().toISOString(), source: 'snapshot', updated_at: payload.updated_at, rows});
  writeFileSync('dist/data/leaderboard.json', body);
  console.log(`Published ${rows.length} rows (${(body.length / 1e6).toFixed(2)} MB before compression)`);
} catch (e) {
  console.log(`::warning::leaderboard snapshot not published: ${e.message}`);
}
