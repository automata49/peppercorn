"""Read-only SQL checks for supabase/position_growth.sql on a deployed project (used by position-production.yml).

  python supabase/tests/position_growth_db_check.py swing-acl > before.json   # grants and policies outside Position
  python supabase/tests/position_growth_db_check.py verify before.json        # after the migration; exit 1 on failure

Needs PROD_SUPABASE_DB_URL and `psql`. Every query is a catalog or count read; nothing is written.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

POSITION_TABLES = ("fundamentals_q", "position_snapshot")
PIPELINE_BLOCKED = ("price_daily", "market_metrics", "universe_memberships", "stock_analyses", "watchlist",
                    "portfolio_positions", "user_thresholds", "research_notes", "trade_journal")


def sql(query: str) -> str:
    done = subprocess.run(["psql", os.environ["PROD_SUPABASE_DB_URL"], "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
                           "-c", query], capture_output=True, text=True, timeout=120)
    if done.returncode:
        raise RuntimeError(f"psql failed: {done.stderr.strip()[:300]}")
    return done.stdout.strip()


def swing_acl() -> dict:
    """Grants and policies on every public table except the two Position tables and the pipeline's own grants."""
    grants = sql("""select coalesce(json_agg(g order by g), '[]') from (
        select table_name || ':' || grantee || ':' || privilege_type g from information_schema.role_table_grants
        where table_schema = 'public' and table_name not in ('fundamentals_q','position_snapshot')
          and grantee <> 'position_pipeline') s""")
    policies = sql("""select coalesce(json_agg(p order by p), '[]') from (
        select tablename || ':' || policyname || ':' || cmd || ':' || array_to_string(roles, ',') p from pg_policies
        where schemaname = 'public' and tablename not in ('fundamentals_q','position_snapshot')
          and not ('position_pipeline' = any(roles))) s""")
    rls = sql("""select coalesce(json_agg(c.relname || ':' || c.relrowsecurity order by c.relname), '[]')
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname not in ('fundamentals_q','position_snapshot')""")
    return {"grants": json.loads(grants), "policies": json.loads(policies), "rls": json.loads(rls)}


def verify(before_path: str) -> int:
    results = []

    def check(name: str, passed: bool, detail: str = ""):
        results.append(passed)
        print(f"{'PASS' if passed else 'FAIL'} {name}{'' if passed else ' — ' + detail}")

    role = sql("select rolcanlogin::text || ',' || rolbypassrls::text from pg_roles where rolname = 'position_pipeline'")
    check("position_pipeline exists without login or RLS bypass", role == "false,false", role or "missing")
    member = sql("select pg_has_role('authenticator', 'position_pipeline', 'member')")
    check("authenticator can switch to position_pipeline", member == "t", member)
    for table in POSITION_TABLES:
        rls = sql(f"select relrowsecurity from pg_class where oid = to_regclass('public.{table}')")
        check(f"{table} exists with RLS", rls == "t", rls or "missing")
        trig = sql(f"select count(*) from pg_trigger where tgrelid = to_regclass('public.{table}') and tgname = '{table}_append_only'")
        check(f"{table} append-only trigger", trig == "1", trig)
        for who in ("anon", "authenticated", "position_pipeline"):
            for priv in ("UPDATE", "DELETE", "TRUNCATE"):
                got = sql(f"select has_table_privilege('{who}', 'public.{table}', '{priv}')")
                check(f"{who} has no {priv} on {table}", got == "f", got)
        for who in ("anon", "authenticated"):
            got = sql(f"select has_table_privilege('{who}', 'public.{table}', 'INSERT')")
            check(f"{who} has no INSERT on {table}", got == "f", got)
        got = sql(f"select has_table_privilege('position_pipeline', 'public.{table}', 'INSERT')")
        check(f"position_pipeline can INSERT into {table}", got == "t", got)
    expected_read = {("anon", "position_snapshot"): "t", ("authenticated", "position_snapshot"): "t",
                     ("anon", "fundamentals_q"): "f", ("authenticated", "fundamentals_q"): "t"}
    for (who, table), want in expected_read.items():
        got = sql(f"select has_table_privilege('{who}', 'public.{table}', 'SELECT')")
        check(f"{who} SELECT on {table} is {want}", got == want, got)
    for table in PIPELINE_BLOCKED:
        got = sql(f"select bool_or(has_table_privilege('position_pipeline', 'public.{table}', p)) "
                  f"from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) p")
        check(f"position_pipeline has no privilege on {table}", got == "f", got)
    got = sql("select has_table_privilege('position_pipeline', 'public.instruments', 'UPDATE')")
    check("position_pipeline cannot update instruments", got == "f", got)

    with open(before_path, encoding="utf-8") as handle:
        before = json.load(handle)
    after = swing_acl()
    for key in ("grants", "policies", "rls"):
        added, removed = sorted(set(after[key]) - set(before[key])), sorted(set(before[key]) - set(after[key]))
        check(f"Swing/user {key} unchanged", not added and not removed, f"added {added[:5]} removed {removed[:5]}")
    rows = sql("select (select count(*) from public.fundamentals_q) || ',' || (select count(*) from public.position_snapshot)")
    print(f"Position rows (facts,snapshots): {rows}")
    print(f"{sum(results)} passed, {len(results) - sum(results)} failed")
    return 0 if all(results) else 1


def main() -> int:
    if not os.environ.get("PROD_SUPABASE_DB_URL"):
        raise SystemExit("PROD_SUPABASE_DB_URL is not set")
    if len(sys.argv) == 2 and sys.argv[1] == "swing-acl":
        print(json.dumps(swing_acl()))
        return 0
    if len(sys.argv) == 3 and sys.argv[1] == "verify":
        return verify(sys.argv[2])
    raise SystemExit(__doc__)


if __name__ == "__main__":
    sys.exit(main())
