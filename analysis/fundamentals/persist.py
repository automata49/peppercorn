"""Persist a collector result into the Position tables through the pipeline role (server side only).

Default is a dry run that touches nothing. `--apply` needs POSITION_SUPABASE_URL and POSITION_PIPELINE_JWT
(a JWT whose role is position_pipeline, see supabase/position_growth.sql). Never run it in a browser or hand
the token to a coding agent. Writes are append-only and idempotent: a row's input_hash covers the filing
identity and amounts of its inputs, so an unchanged filing adds nothing and an amendment adds a row.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import date
from pathlib import Path

import requests

POLICY = json.loads(Path(__file__).resolve().parents[2].joinpath(
    "harness", "contracts", "position-write-policy.json").read_text(encoding="utf-8"))
PIPELINE_VERSION = "fundamentals-persist-1"
RULES_VERSION = "uncalibrated"          # no calibrated label rules exist, so snapshots never carry labels
EXTRACT_VERSION = "fundamentals-extract-1"
CHUNK = 200
EXPECTED = ["revenue", "gross_profit", "operating_income", "pretax_income", "income_tax", "net_income",
            "operating_cash_flow", "capex", "sbc", "diluted_shares", "equity", "cash", "short_term_investments", "debt"]
UNKNOWN_WHY = {
    ("KR", "sbc"): "share-based compensation is not collected from DART statements",
    ("KR", "diluted_shares"): "weighted diluted share count is not collected from DART statements (total shares differ)",
}
CONFLICT_KEYS = {"fundamentals_q": "instrument_id,period_end,field,input_hash",
                 "position_snapshot": "instrument_id,as_of,rules_version,input_hash"}


def assert_position_write_target(table: str) -> str:
    """Python twin of scripts/harness/position-write.mjs; both read the same policy file."""
    if not isinstance(table, str) or table not in POLICY["writable"] or table in POLICY["protected"]:
        raise PermissionError(f"Position pipeline write denied: {table}")
    return table


def _iso(day: str) -> str:
    return f"{day[:4]}-{day[4:6]}-{day[6:]}" if len(day) == 8 and day.isdigit() else day


def _strip_volatile(item):
    """Response-level hashes change whenever a source adds an unrelated fact, so they never enter input_hash."""
    if isinstance(item, dict):
        return {k: _strip_volatile(v) for k, v in item.items() if k != "raw_sha256"}
    if isinstance(item, list):
        return [_strip_volatile(v) for v in item]
    return item


def digest(payload) -> str:
    text = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def fact_rows(result: dict, quarters: int = 20) -> tuple[list[dict], list[str]]:
    """Rows for fundamentals_q from the newest `quarters` quarters, and a list of what was skipped and why."""
    rows, skipped = [], []
    market, currency = result["market"], result["currency"]
    capex_method = result["methodology"]["version"]
    for end in sorted(result["quarters"])[-quarters:]:
        present = result["quarters"][end]
        for field, value in sorted(present.items()):
            origin = result.get("source_lineage", {}).get(end, {}).get(field)
            inputs = (origin or {}).get("inputs") or []
            filed = [_iso(i["filed"]) for i in inputs if i.get("filed")]
            if not inputs or len(filed) != len(inputs):
                skipped.append(f"{end}/{field}: no complete filing lineage")
                continue
            method = capex_method if field == "capex" else EXTRACT_VERSION
            identity = {"field": field, "period_end": end, "value": value, "operation": origin["operation"],
                        "inputs": _strip_volatile(inputs), "method_version": method}
            lineage = {"operation": origin["operation"], "inputs": inputs, "source": result["source"]}
            if result.get("raw_sha256") and isinstance(result["raw_sha256"], str):
                lineage["raw_sha256"] = result["raw_sha256"]
            rows.append({"period_end": end, "field": field, "status": "reported", "value": value,
                         "unit": "shares" if field == "diluted_shares" else currency, "scope": "consolidated",
                         "unknown_reason": None, "extraction": origin["operation"], "method_version": method,
                         "lineage": lineage, "source_filed_at": max(filed), "input_hash": digest(identity),
                         "pipeline_version": PIPELINE_VERSION})
        for field in EXPECTED:
            if field in present:
                continue
            why = UNKNOWN_WHY.get((market, field), f"{field} not reported in the collected {result['source']} statements")
            rows.append({"period_end": end, "field": field, "status": "unknown", "value": None,
                         "unit": "shares" if field == "diluted_shares" else currency, "scope": "consolidated",
                         "unknown_reason": why, "extraction": "direct", "method_version": EXTRACT_VERSION,
                         "lineage": {}, "source_filed_at": None,
                         "input_hash": digest({"unknown": True, "field": field, "period_end": end, "why": why}),
                         "pipeline_version": PIPELINE_VERSION})
    return rows, skipped


def snapshot_row(result: dict, fact_hashes: list[str], computed_on: str) -> dict | None:
    """One label-free snapshot: check_failed when any check failed, otherwise unavailable (no calibrated rules)."""
    metrics = result.get("metrics") or {}
    if not metrics.get("as_of") or not result.get("checks"):
        return None
    passed = all(check[1] for check in result["checks"])
    method = result["methodology"]
    return {"as_of": metrics["as_of"], "rules_version": RULES_VERSION, "fcf_method": method["version"],
            "roic_method": metrics.get("roic_method") or method["roic"]["version"],
            "status": "unavailable" if passed else "check_failed",
            "checks": [list(check) for check in result["checks"]], "metrics": metrics,
            "type_label": None, "quality_label": None, "growth_label": None, "value_label": None,
            "label_reasons": {}, "pipeline_version": PIPELINE_VERSION,
            "input_hash": digest({"facts": sorted(fact_hashes), "fcf": method["version"], "rules": RULES_VERSION,
                                  "roic": metrics.get("roic_method"), "computed_on": computed_on})}


def plan(result: dict, quarters: int, computed_on: str) -> dict:
    """Everything that would be written for one collector result, or why nothing would be."""
    if "error" in result:
        return {"ticker": result.get("ticker"), "refused": "collector reported an error"}
    if result.get("as_of"):
        return {"ticker": result["ticker"], "refused": "historical as_of reconstruction is not persisted"}
    facts, skipped = fact_rows(result, quarters)
    reported = [row["input_hash"] for row in facts if row["status"] == "reported"]
    return {"ticker": result["ticker"], "market": result["market"], "facts": facts, "skipped": skipped,
            "snapshot": snapshot_row(result, reported, computed_on)}


def project_url(url: str) -> str:
    """Accept the project URL or the REST endpoint (…/rest/v1) that the Supabase dashboard also shows."""
    url = url.strip().rstrip("/")
    return url[: -len("/rest/v1")] if url.endswith("/rest/v1") else url


class Client:
    """Minimal PostgREST client for the pipeline role; the token never appears in messages."""

    def __init__(self, url: str, token: str, apikey: str | None = None):
        self.url = project_url(url)
        self.token = token
        self.headers = {"apikey": apikey or token, "Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def _clean(self, text: str) -> str:
        for secret in {self.token, self.headers["apikey"]}:
            text = text.replace(secret, "***")
        return text[:300]

    def _check(self, response, what: str):
        if response.status_code >= 300:
            raise RuntimeError(f"{what} failed: HTTP {response.status_code} {self._clean(response.text)}")
        return response

    def instrument_id(self, market: str, ticker: str) -> str:
        response = self._check(requests.get(f"{self.url}/rest/v1/instruments", headers=self.headers, timeout=60, params={
            "market": f"eq.{market}", "ticker": f"eq.{ticker}", "select": "id"}), "instrument lookup")
        found = response.json()
        if len(found) != 1:
            raise RuntimeError(f"instrument {market}:{ticker} not found exactly once ({len(found)} rows)")
        return found[0]["id"]

    def insert(self, table: str, rows: list[dict]) -> int:
        assert_position_write_target(table)
        headers = {**self.headers, "Prefer": "resolution=ignore-duplicates,return=minimal"}
        for start in range(0, len(rows), CHUNK):
            self._check(requests.post(f"{self.url}/rest/v1/{table}", headers=headers, timeout=120,
                                      params={"on_conflict": CONFLICT_KEYS[table]}, data=json.dumps(rows[start:start + CHUNK], allow_nan=False)),
                        f"insert into {table}")
        return len(rows)


def apply(planned: dict, client: Client) -> dict:
    instrument = client.instrument_id(planned["market"], planned["ticker"])
    facts = [{**row, "instrument_id": instrument} for row in planned["facts"]]
    counts = {"facts": client.insert("fundamentals_q", facts)}
    if planned["snapshot"]:
        counts["snapshots"] = client.insert("position_snapshot", [{**planned["snapshot"], "instrument_id": instrument}])
    return counts


def load_results(folder: Path) -> list[dict]:
    return [json.loads(path.read_text(encoding="utf-8")) for path in sorted(folder.glob("*.json"))]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("out", help="collector output folder (NVDA.json, 005930.json)")
    ap.add_argument("--quarters", type=int, default=20, help="newest quarters to persist (default 20)")
    ap.add_argument("--apply", action="store_true", help="write to the database; default is a dry run")
    args = ap.parse_args()
    client = None
    if args.apply:
        url, token = os.environ.get("POSITION_SUPABASE_URL", ""), os.environ.get("POSITION_PIPELINE_JWT", "")
        if not url or not token:
            raise SystemExit("--apply needs POSITION_SUPABASE_URL and POSITION_PIPELINE_JWT (server side only)")
        client = Client(url, token, os.environ.get("POSITION_SUPABASE_APIKEY") or None)
    failed = False
    for result in load_results(Path(args.out)):
        planned = plan(result, args.quarters, date.today().isoformat())
        if "refused" in planned:
            print(f"REFUSED {planned['ticker']}: {planned['refused']}")
            failed = True
            continue
        reported = sum(1 for row in planned["facts"] if row["status"] == "reported")
        summary = (f"{planned['ticker']}: {reported} reported + {len(planned['facts']) - reported} unknown facts, "
                   f"{len(planned['skipped'])} skipped, snapshot {planned['snapshot']['status'] if planned['snapshot'] else 'none'}")
        if not client:
            print("DRY RUN", summary)
            continue
        print("APPLIED", summary, apply(planned, client))
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
