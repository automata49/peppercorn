// Server-side only. Never include this module or the connection string in browser assets.
import pg from 'pg';
import {readFileSync} from 'node:fs';
import {rootCertificates} from 'node:tls';
export async function connectMarketDb() {
  const connectionString = process.env.PROD_SUPABASE_DB_URL;
  if (!connectionString) throw Error('Repository secret PROD_SUPABASE_DB_URL is required');
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !(url.hostname === 'db.mhbcchegrbakearqptdr.supabase.co' ||
        (url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username).endsWith('.mhbcchegrbakearqptdr')))) {
    throw Error('Database connection must target the existing Peppercorn production project');
  }
  if (url.searchParams.get('sslmode') === 'disable') throw Error('Database TLS is required');
  // pg-connection-string can override explicit TLS options when sslmode is present.
  for (const key of ['sslmode','sslrootcert','sslcert','sslkey','uselibpqcompat']) url.searchParams.delete(key);
  const ca=readFileSync(new URL('./supabase-prod-ca-2021.crt',import.meta.url),'utf8');
  const client = new pg.Client({connectionString:url.toString(), ssl:{rejectUnauthorized:true,ca:[...rootCertificates,ca]},connectionTimeoutMillis:15000,
    statement_timeout:120000, query_timeout:125000});
  try {await client.connect();} catch (e) {throw Error(`Database connection failed (${e.code || 'connection_error'}); check PROD_SUPABASE_DB_URL`);}
  return client;
}

export async function publicSnapshot(client) {
  const {rows} = await client.query('select row_to_json(v) as row from public.leaderboard_view v order by rs_rank desc nulls last, market asc, ticker asc');
  const instruments = rows.map(x => x.row);
  if (instruments.length < 1000 || instruments.filter(x=>x.asset_class==='Equity').length < 900) {
    throw Error('Public leaderboard export failed the minimum coverage check');
  }
  // Publication time is not a price date. Per-row source dates are preserved exactly.
  return {published_at:new Date().toISOString(),source:'snapshot',rows:instruments};
}
