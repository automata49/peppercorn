"""Check the Position migration and pipeline role through a real Supabase project's Data API (PostgREST).

Run only against an isolated test project, never production (.github/workflows/position-staging.yml
refuses the production project ref). It needs TEST_SUPABASE_URL, TEST_SUPABASE_APIKEY (publishable or
anon key) and TEST_SUPABASE_JWT_SECRET (the legacy HS256 secret, still accepted for verification). Tokens
are minted here, live for ten minutes and are never printed.

  python supabase/tests/position_growth_staging.py roles        # grants, RLS and forged-token checks
  python supabase/tests/position_growth_staging.py token        # print a pipeline JWT for persist.py (masked in CI)
  python supabase/tests/position_growth_staging.py counts       # print fact and snapshot row counts as JSON
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import sys
import time
import uuid

import requests

URL = os.environ.get("TEST_SUPABASE_URL", "").rstrip("/")
APIKEY = os.environ.get("TEST_SUPABASE_APIKEY", "")
SECRET = os.environ.get("TEST_SUPABASE_JWT_SECRET", "")
DENIED = {401, 403}


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def mint(role: str, secret: str = "", ttl: int = 600, **claims) -> str:
    """HS256 JWT with the given database role."""
    now = int(time.time())
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64(json.dumps({"role": role, "iat": now, "exp": now + ttl, **claims}).encode())
    signature = hmac.new((secret or SECRET).encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    return f"{header}.{body}.{_b64(signature)}"


def call(method: str, path: str, token: str | None, **kwargs) -> requests.Response:
    headers = {"apikey": APIKEY, "Content-Type": "application/json", **kwargs.pop("headers", {})}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.request(method, f"{URL}/rest/v1/{path}", headers=headers, timeout=60, **kwargs)


def count(table: str, token: str) -> int:
    response = call("HEAD", f"{table}?select=id", token, headers={"Prefer": "count=exact"})
    if response.status_code >= 300:
        raise RuntimeError(f"count {table}: HTTP {response.status_code}")
    return int(response.headers["Content-Range"].split("/")[-1])


def roles() -> int:
    results = []

    def check(name: str, response: requests.Response, expected: set[int]):
        passed = response.status_code in expected
        detail = "" if passed else f" (HTTP {response.status_code}: {response.text[:200]})"
        results.append(passed)
        print(f"{'PASS' if passed else 'FAIL'} {name}{detail}")

    pipeline, authed = mint("position_pipeline"), mint("authenticated", sub=str(uuid.uuid4()), aud="authenticated")
    ok = {200, 206}
    instrument = call("GET", "instruments?market=eq.US&ticker=eq.NVDA&select=id", pipeline)
    check("pipeline reads instruments", instrument, ok)
    inst = (instrument.json() or [{}])[0].get("id") if instrument.status_code in ok else None
    check("pipeline reads fundamentals_q", call("GET", "fundamentals_q?select=id&limit=1", pipeline), ok)
    check("pipeline reads position_snapshot", call("GET", "position_snapshot?select=id&limit=1", pipeline), ok)
    check("pipeline cannot update fundamentals_q",
          call("PATCH", "fundamentals_q?id=not.is.null", pipeline, json={"value": 1}), DENIED)
    check("pipeline cannot delete fundamentals_q", call("DELETE", "fundamentals_q?id=not.is.null", pipeline), DENIED)
    check("pipeline cannot delete position_snapshot", call("DELETE", "position_snapshot?id=not.is.null", pipeline), DENIED)
    check("pipeline cannot update instruments",
          call("PATCH", "instruments?id=not.is.null", pipeline, json={"name": "x"}), DENIED)
    for table in ["price_daily", "market_metrics", "universe_memberships", "stock_analyses", "watchlist",
                  "portfolio_positions", "user_thresholds", "research_notes", "trade_journal"]:
        check(f"pipeline cannot read {table}", call("GET", f"{table}?limit=1", pipeline), DENIED)
    if inst:
        check("pipeline cannot insert into price_daily", call("POST", "price_daily", pipeline,
              json={"instrument_id": inst, "trade_date": "2026-01-01", "close": 1}), DENIED)
        # The lineage constraint must also hold through the Data API, not only in PGlite.
        check("reported fact without lineage rejected", call("POST", "fundamentals_q", pipeline, json={
            "instrument_id": inst, "period_end": "2026-07-26", "field": "revenue", "status": "reported",
            "value": 1, "unit": "USD", "scope": "consolidated", "extraction": "direct", "method_version": "staging",
            "lineage": {"source": "SEC", "operation": "direct", "inputs": []}, "source_filed_at": "2026-08-26",
            "input_hash": "0" * 64, "pipeline_version": "staging-check"}), {400})
    else:
        results.append(False)
        print("FAIL NVDA instrument row missing; seed step did not run")

    check("anon reads position_snapshot", call("GET", "position_snapshot?select=id&limit=1", None), ok)
    check("anon cannot read fundamentals_q", call("GET", "fundamentals_q?select=id&limit=1", None), DENIED)
    check("anon cannot insert position_snapshot", call("POST", "position_snapshot", None, json={}), DENIED)
    check("authenticated reads fundamentals_q", call("GET", "fundamentals_q?select=id&limit=1", authed), ok)
    check("authenticated cannot insert fundamentals_q", call("POST", "fundamentals_q", authed, json={}), DENIED)
    check("authenticated cannot delete position_snapshot",
          call("DELETE", "position_snapshot?id=not.is.null", authed), DENIED)
    forged = mint("position_pipeline", secret="not-the-project-secret")
    check("forged pipeline token rejected", call("GET", "fundamentals_q?select=id&limit=1", forged), {401})
    expired = mint("position_pipeline", ttl=-120)
    check("expired pipeline token rejected", call("GET", "fundamentals_q?select=id&limit=1", expired), {401})
    print(f"{sum(results)} passed, {len(results) - sum(results)} failed")
    return 0 if all(results) else 1


def main() -> int:
    if not (URL and APIKEY and SECRET):
        raise SystemExit("TEST_SUPABASE_URL, TEST_SUPABASE_APIKEY and TEST_SUPABASE_JWT_SECRET are required")
    command = sys.argv[1] if len(sys.argv) > 1 else "roles"
    if command == "roles":
        return roles()
    if command == "token":
        print(mint("position_pipeline", ttl=900))
        return 0
    if command == "counts":
        token = mint("position_pipeline")
        print(json.dumps({"facts": count("fundamentals_q", token), "snapshots": count("position_snapshot", token)}))
        return 0
    raise SystemExit(f"unknown command {command}")


if __name__ == "__main__":
    sys.exit(main())
