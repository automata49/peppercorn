"""Offline comparison of PoC output to independently read SEC/Samsung filings."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from zipfile import ZipFile

REFERENCE = json.loads(Path(__file__).with_name("official_reference_2025.json").read_text(encoding="utf-8"))


def compare(result: dict) -> list[tuple[str, bool, str]]:
    expected = REFERENCE.get(result.get("ticker"))
    if not expected:
        return []
    period = expected["period_end"]
    row = result.get("quarters", {}).get(period)
    if row is None:
        return [(f"공식 공시 {period}", False, "기준 분기 누락")]
    outcome = []
    for field, value in expected["values"].items():
        actual = row.get(field)
        good = actual is not None and actual == value
        outcome.append((f"공식 공시 {period} {field}", good,
                        f"수집 {actual}; 공시 {value} {expected['currency']}"))
    return outcome


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("artifact", help="PoC artifact ZIP or folder containing NVDA.json and 005930.json")
    args = ap.parse_args()
    path = Path(args.artifact)
    if path.is_file():
        with ZipFile(path) as archive:
            results = [(ticker, json.loads(archive.read(f"{ticker}.json"))) for ticker in REFERENCE]
    else:
        results = [(ticker, json.loads((path / f"{ticker}.json").read_text(encoding="utf-8"))) for ticker in REFERENCE]
    failed = False
    for ticker, result in results:
        if result.get("ticker") != ticker or result.get("currency") != REFERENCE[ticker]["currency"]:
            print(f"FAIL {ticker}: artifact identity or currency mismatch")
            failed = True
            continue
        checks = compare(result)
        if not checks:
            print(f"FAIL {ticker}: no official reference checks")
            failed = True
        for name, ok, detail in checks:
            print(f"{'PASS' if ok else 'FAIL'} {ticker} {name}: {detail}")
            failed |= not ok
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
