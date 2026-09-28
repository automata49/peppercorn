import {readFileSync} from 'node:fs';

const policy = JSON.parse(readFileSync(new URL('../../harness/contracts/position-write-policy.json', import.meta.url), 'utf8'));
const ROLE = 'position_pipeline';

const statements = sql => sql.replace(/--[^\n]*/g, '').split(/;\s*(?:\n|$)/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const names = list => list.split(',').map(s => s.trim().replace(/^public\./, '')).filter(Boolean);

/** Static review of the Position migration against the write policy. Returns a list of violations. */
export function reviewPositionMigration(sql) {
  const problems = [];
  const all = statements(sql);
  const created = all.map(s => /^create table if not exists public\.(\w+)/i.exec(s)?.[1]).filter(Boolean);
  for (const table of created) {
    if (!policy.writable.includes(table)) problems.push(`creates ${table}, which is not a Position writable table`);
    if (!all.some(s => new RegExp(`^alter table public\\.${table} enable row level security$`, 'i').test(s))) problems.push(`${table}: RLS not enabled`);
  }
  const protectedName = new RegExp(`\\b(${policy.protected.join('|')})\\b`);
  for (const s of all) {
    const grant = /^grant (.+?) on (?:table )?(.+?) to (.+)$/i.exec(s);
    if (grant && names(grant[3]).includes(ROLE)) {
      const privileges = names(grant[1].toLowerCase());
      for (const table of names(grant[2])) {
        if (table.startsWith('schema')) continue;
        const readOnly = table === 'instruments';
        if (!readOnly && !created.includes(table)) problems.push(`grants ${ROLE} access to ${table}`);
        if (privileges.some(p => !['select', 'insert', 'usage'].includes(p) || (readOnly && p !== 'select'))) problems.push(`grants ${ROLE} ${privileges.join('/')} on ${table}`);
      }
    }
    if (protectedName.test(s) && !(/^revoke all on /i.test(s) && new RegExp(`from ${ROLE}$`, 'i').test(s))) problems.push(`mentions a protected table outside a revoke from ${ROLE}: ${s.slice(0, 60)}`);
    if (/^(grant|create policy).*\b(anon|authenticated)\b/i.test(s) && /\b(insert|update|delete|all)\b/i.test(s) && !/^grant usage/i.test(s)) problems.push(`grants write access to a public role: ${s.slice(0, 60)}`);
    if (/^grant .* to .*service_role/i.test(s)) problems.push('grants to service_role');
  }
  for (const table of created) {
    const granted = all.some(s => new RegExp(`^grant select, insert on .*public\\.${table}\\b.* to ${ROLE}$`, 'i').test(s));
    if (!granted) problems.push(`${table}: pipeline has no select, insert grant`);
  }
  if (!all.some(s => new RegExp(`^revoke all on .*public\\.price_daily.*public\\.market_metrics.* from ${ROLE}$`, 'i').test(s))) problems.push('no revoke of Swing tables from the pipeline role');
  if (!created.length) problems.push('creates no tables');
  return problems;
}

export const positionMigrationSql = () => readFileSync(new URL('../../supabase/position_growth.sql', import.meta.url), 'utf8');
