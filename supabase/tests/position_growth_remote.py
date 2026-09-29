"""Checks supabase/position_growth.sql on a real, non-production Supabase project through PostgREST and SQL.

Run only from .github/workflows/position-test-db.yml. It needs TEST_SUPABASE_URL, TEST_SUPABASE_APIKEY,
TEST_SUPABASE_JWT_SECRET (legacy HS256 secret) and TEST_SUPABASE_DB_URL, and `psql` on PATH.

  token <role>   print a short-lived JWT for that role (the caller must mask it)
  counts         print row counts of the Position tables as JSON
  verify         JWT role mapping, grants, RLS, append-only and label checks; exit 1 on any failure

Tokens and keys never appear in output. Nothing here writes to a Swing or user table: every write attempt
below is expected to be refused, and the check fails if one succeeds.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
import time
import uuid

import requests

PRODUCTION_REF = "mhbcchegrbakearqptdr"
PIPELINE_BLOCKED = ["price_daily", "market_metrics", "universe_memberships", "stock_analyses", "watchlist",
                    "portfolio_positions", "user_thresholds", "research_notes", "trade_journal"]


def env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise SystemExit(f"{name} is not set")
    return value


def refuse_production():
    for name in ("TEST_SUPABASE_URL", "TEST_SUPABASE_DB_URL"):
        if PRODUCTION_REF in os.environ.get(name, ""):
            raise SystemExit(f"{name} points at the production project; refusing")


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def token(role: str, ttl: int = 1800) -> str:
    now = int(time.time())
    claims = {"role": role, "iss": "supabase", "iat": now, "exp": now + ttl}
    if role == "authenticated":
        claims |= {"sub": str(uuid.uuid4()), "aud": "authenticated"}
    head = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = _b64(json.dumps(claims, separators=(",", ":")).encode())
    sig = hmac.new(env("TEST_SUPABASE_JWT_SECRET").encode(), f"{head}.{body}".encode(), hashlib.sha256).digest()
    return f"{head}.{body}.{_b64(sig)}"


def sql(query: str) -> str:
    done = subprocess.run(["psql", env("TEST_SUPABASE_DB_URL"), "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query],
                          capture_output=True, text=True, timeout=120)
    if done.returncode:
        raise RuntimeError(f"psql failed: {done.stderr.strip()[:300]}")
    return done.stdout.strip()


def counts() -> dict:
    return {t: int(sql(f"select count(*) from public.{t}")) for t in ("fundamentals_q", "position_snapshot")}


class Rest:
    def __init__(self, bearer: str | None):
        base = env("TEST_SUPABASE_URL").strip().rstrip("/")
        self.base = base if base.endswith("/rest/v1") else base + "/rest/v1"
        self.headers = {"apikey": env("TEST_SUPABASE_APIKEY"), "Content-Type": "application/json"}
        if bearer:
            self.headers["Authorization"] = f"Bearer {bearer}"

    def call(self, method: str, table: str, params: dict | None = None, body=None, prefer: str = "return=minimal"):
        return requests.request(method, f"{self.base}/{table}", headers={**self.headers, "Prefer": prefer},
                                params=params, data=None if body is None else json.dumps(body), timeout=60)


results: list[tuple[str, bool, str]] = []


def check(name: str, passed: bool, detail: str = ""):
    results.append((name, passed, detail))
    print(f"{'PASS' if passed else 'FAIL'} {name}{'' if passed else ' — ' + detail}")


def allowed(response) -> bool:
    return response.status_code < 300


def refused(response) -> bool:
    """Permission, RLS or append-only refusal; a 2xx or an unrelated error does not count."""
    if response.status_code < 400:
        return False
    try:
        code = response.json().get("code", "")
    except ValueError:
        code = ""
    return code in {"42501", "P0001"} or response.status_code in (401, 403)


def brief(response) -> str:
    return f"HTTP {response.status_code} {response.text[:160]}"


def verify():
    pipeline, anon, user = Rest(token("position_pipeline")), Rest(None), Rest(token("authenticated"))
    probe = {"instrument_id": "00000000-0000-0000-0000-000000000000", "trade_date": "2000-01-03", "close": 1}

    r = pipeline.call("GET", "instruments", {"select": "id", "limit": "1"})
    check("pipeline JWT maps to position_pipeline and reads instruments", allowed(r), brief(r))
    r = pipeline.call("GET", "fundamentals_q", {"select": "id", "limit": "1"})
    check("pipeline reads its facts", allowed(r), brief(r))
    for table in PIPELINE_BLOCKED:
        r = pipeline.call("GET", table, {"select": "*", "limit": "1"})
        check(f"pipeline cannot read {table}", refused(r), brief(r))
    r = pipeline.call("POST", "price_daily", body=probe)
    check("pipeline cannot insert into price_daily", refused(r), brief(r))
    r = pipeline.call("PATCH", "fundamentals_q", {"id": "not.is.null"}, {"value": 1})
    check("pipeline cannot update facts", refused(r), brief(r))
    r = pipeline.call("DELETE", "fundamentals_q", {"id": "not.is.null"})
    check("pipeline cannot delete facts", refused(r), brief(r))
    r = pipeline.call("DELETE", "position_snapshot", {"id": "not.is.null"})
    check("pipeline cannot delete snapshots", refused(r), brief(r))
    r = pipeline.call("PATCH", "instruments", {"id": "not.is.null"}, {"name": "x"})
    check("pipeline cannot update instruments", refused(r), brief(r))

    r = anon.call("GET", "position_snapshot", {"select": "id", "limit": "1"})
    check("anon reads snapshots", allowed(r), brief(r))
    r = anon.call("GET", "fundamentals_q", {"select": "id", "limit": "1"})
    check("anon cannot read facts", refused(r), brief(r))
    r = anon.call("POST", "position_snapshot", body={})
    check("anon cannot insert snapshots", refused(r), brief(r))
    r = anon.call("GET", "market_metrics", {"select": "instrument_id", "limit": "1"})
    check("anon still reads market_metrics", allowed(r), brief(r))

    r = user.call("GET", "fundamentals_q", {"select": "id", "limit": "1"})
    check("authenticated reads facts", allowed(r) and len(r.json()) == 1, brief(r))
    r = user.call("POST", "fundamentals_q", body={})
    check("authenticated cannot insert facts", refused(r), brief(r))
    r = user.call("DELETE", "fundamentals_q", {"id": "not.is.null"})
    check("authenticated cannot delete facts", refused(r), brief(r))

    member = sql("select pg_has_role('authenticator','position_pipeline','member')")
    check("authenticator can switch to position_pipeline", member == "t", member)
    for role in ("anon", "authenticated", "position_pipeline"):
        for table in ("fundamentals_q", "position_snapshot"):
            for priv in ("UPDATE", "DELETE", "TRUNCATE"):
                got = sql(f"select has_table_privilege('{role}','public.{table}','{priv}')")
                check(f"{role} has no {priv} on {table}", got == "f", got)
    for role in ("anon", "authenticated"):
        for table in ("fundamentals_q", "position_snapshot"):
            got = sql(f"select has_table_privilege('{role}','public.{table}','INSERT')")
            check(f"{role} has no INSERT on {table}", got == "f", got)
    got = sql("select has_table_privilege('anon','public.fundamentals_q','SELECT')")
    check("anon has no SELECT on fundamentals_q despite default privileges", got == "f", got)
    for table in PIPELINE_BLOCKED:
        got = sql(f"select bool_or(has_table_privilege('position_pipeline','public.{table}',p)) "
                  f"from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) p")
        check(f"position_pipeline has no privilege on {table}", got == "f", got)
    login = sql("select rolcanlogin::text || rolbypassrls::text from pg_roles where rolname='position_pipeline'")
    check("position_pipeline cannot log in or bypass RLS", login == "falsefalse", login)

    rows = counts()
    check("persist wrote facts", rows["fundamentals_q"] > 0, str(rows))
    check("persist wrote snapshots", rows["position_snapshot"] > 0, str(rows))
    labelled = sql("select count(*) from public.position_snapshot where type_label is not null or quality_label is not null "
                   "or growth_label is not null or value_label is not null or status = 'ok'")
    check("no snapshot carries a label or ok status (rules uncalibrated)", labelled == "0", labelled)
    zero_unknown = sql("select count(*) from public.fundamentals_q where status = 'unknown' and value is not null")
    check("unknown facts are never stored as a number", zero_unknown == "0", zero_unknown)

    failed = [name for name, passed, _ in results if not passed]
    print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed")
    if failed:
        raise SystemExit(1)


def main():
    refuse_production()
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "token" and len(sys.argv) == 3 and sys.argv[2] in ("position_pipeline", "authenticated"):
        print(token(sys.argv[2]))
    elif command == "counts":
        print(json.dumps(counts()))
    elif command == "verify":
        verify()
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
