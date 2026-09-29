"""Walk-forward improvement of the Position label rules, with sealed predictions and no model tokens.

One deterministic `step` per scheduled run:

1. Seal: every live candidate rule set labels each quarter-end since FORWARD_START using only filings up to that
   date. Predictions are written once into the ledger and never rewritten.
2. Evaluate: a candidate is judged only on dates whose 3-year outcome matured after the candidate was frozen, so
   nothing it was chosen with can confirm it. The gate is the pre-registered A1-A5 from `backtest.summarize`.
3. Improve: when there is room, one-step mutations of the best candidate so far (ranked on history that has already
   matured) are frozen as new candidates. They must then earn their own forward evidence.

A candidate that passes on at least MIN_FORWARD_DATES forward dates is only reported as ready for review. Turning
labels on (`"active": true`) stays a human decision recorded in docs/harness/POSITION_RULES_V1.md.

  python forward.py step --cache cache --ledger ledger [--today YYYY-MM-DD]
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
from datetime import date, timedelta
from pathlib import Path

import backtest
import labels

FORWARD_START = "2023-03-31"
MATURITY_LAG_DAYS = 120                 # a 10-Q for the quarter 3 years later is filed within about 45 days
MIN_FORWARD_DATES = 4                   # a year of quarterly maturities before any candidate can be reviewed
MAX_LIVE = 6
PROPOSE_PER_STEP = 2
SEED = "position-rules-v2"
# Each parameter moves one step within its list; the lists bracket the v2 values.
MUTATION_SPACE = {
    ("quality", "high_roic_min"): [0.12, 0.15, 0.18],
    ("quality", "low_roic_max"): [0.06, 0.08, 0.10],
    ("quality", "high_fcf_conversion_min"): [0.6, 0.7, 0.8],
    ("growth", "durable_min_positive_share"): [0.67, 0.75, 0.83],
    ("growth", "weak_min_positive_share"): [0.42, 0.5, 0.58],
    ("growth", "durable_min_momentum"): [0.3, 0.5, 0.7],
    ("growth", "weak_max_cagr"): [-0.02, 0.0, 0.02],
    ("type", "growth_classes", "fast_min_cagr"): [0.12, 0.15, 0.18],
    ("type", "growth_classes", "stalwart_min_cagr"): [0.03, 0.05, 0.07],
    ("value", "attractive_gap"): [0.03, 0.05, 0.08],
    ("value", "equity_risk_premium"): [0.045, 0.05, 0.055],
}


def quarter_ends(start: str, until: str) -> list[str]:
    out, year, month = [], int(start[:4]), int(start[5:7])
    while True:
        day = {3: 31, 6: 30, 9: 30, 12: 31}[month]
        iso = f"{year:04d}-{month:02d}-{day:02d}"
        if iso > until:
            return out
        out.append(iso)
        month += 3
        if month > 12:
            year, month = year + 1, 3


def maturity(as_of: str) -> str:
    d = date.fromisoformat(as_of)
    return (d.replace(year=d.year + backtest.HORIZON_YEARS) + timedelta(days=MATURITY_LAG_DAYS)).isoformat()


def candidate_id(rules: dict) -> str:
    body = {k: v for k, v in rules.items() if k not in ("version", "active", "active_note", "supersedes")}
    return "wf-" + hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()[:10]


def _get(rules: dict, path: tuple):
    node = rules
    for key in path:
        node = node[key]
    return node


def _set(rules: dict, path: tuple, value) -> dict:
    out = copy.deepcopy(rules)
    node = out
    for key in path[:-1]:
        node = node[key]
    node[path[-1]] = value
    return out


def neighbours(rules: dict) -> list[tuple[str, dict]]:
    """Every rule set one grid step away from `rules`, with a short description of the step."""
    out = []
    for path, grid in MUTATION_SPACE.items():
        current = _get(rules, path)
        if current not in grid:
            continue
        i = grid.index(current)
        for j in (i - 1, i + 1):
            if 0 <= j < len(grid):
                out.append((f"{'.'.join(path)} {current} -> {grid[j]}", _set(rules, path, grid[j])))
    return out


def as_candidate(rules: dict, frozen_at: str, parent: str | None, origin: str) -> dict:
    rules = copy.deepcopy(rules)
    cid = candidate_id(rules)
    rules |= {"version": cid, "active": False,
              "active_note": "Walk-forward candidate; activation is a human decision after review."}
    return {"id": cid, "frozen_at": frozen_at, "parent": parent, "origin": origin, "retired": None, "rules": rules}


def fitness(report: dict) -> float:
    """Acceptance criteria passed, plus a bounded tie-break from how clearly the ordered groups separate."""
    passed = sum(bool(v) for v in report["acceptance"].values())
    gaps = []
    for test in report["tests"].values():
        medians = [test["groups"][label]["median"] for label in test["order"]]
        if None not in medians:
            gaps.append(min(a - b for a, b in zip(medians, medians[1:])))
    shares = [g["met_share"] for g in report["value_expectations"].values()]
    if None not in shares:
        gaps.append(min(a - b for a, b in zip(shares, shares[1:])))
    stability = report.get("type_stability") or 0
    return passed + 0.5 * math.tanh(10 * sum(gaps)) + 0.1 * stability


def _labelled(panel: list[dict], rules: dict, dates: set[str]) -> list[dict]:
    return backtest.label_panel([row for row in panel if row.get("as_of") in dates], rules)


class Ledger:
    """Files on the position-ledger branch; predictions are write-once."""

    def __init__(self, root: Path):
        self.root = root

    def candidates(self) -> list[dict]:
        folder = self.root / "candidates"
        return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(folder.glob("*.json"))] if folder.exists() else []

    def save_candidate(self, candidate: dict) -> None:
        path = self.root / "candidates" / f"{candidate['id']}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(candidate, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    def prediction(self, cid: str, as_of: str) -> dict | None:
        path = self.root / "predictions" / cid / f"{as_of}.json"
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None

    def seal(self, cid: str, as_of: str, sealed_at: str, rows: list[dict]) -> bool:
        path = self.root / "predictions" / cid / f"{as_of}.json"
        if path.exists():
            return False
        path.parent.mkdir(parents=True, exist_ok=True)
        body = {"candidate": cid, "as_of": as_of, "sealed_at": sealed_at, "outcome_harness": backtest.OUTCOME_HARNESS,
                "labels": {r["ticker"]: {**r["labels"], "implied_growth": r["value_detail"].get("implied_growth")}
                           for r in rows if r.get("status") == "ok"}}
        path.write_text(json.dumps(body, sort_keys=True) + "\n", encoding="utf-8")
        return True


def forward_rows(panel: list[dict], ledger: Ledger, candidate: dict, today: str) -> tuple[list[dict], list[str]]:
    """Sealed labels joined with matured outcomes, only for dates that matured after the candidate was frozen."""
    dates = [d for d in quarter_ends(FORWARD_START, today)
             if maturity(d) <= today and maturity(d) > candidate["frozen_at"]]
    rows = []
    for d in dates:
        sealed = ledger.prediction(candidate["id"], d)
        if sealed is None:
            continue
        for row in panel:
            if row.get("as_of") == d and row["ticker"] in sealed["labels"]:
                kept = dict(sealed["labels"][row["ticker"]])
                implied = kept.pop("implied_growth", None)
                rows.append({"ticker": row["ticker"], "as_of": d, "status": "ok", "labels": kept, "outcomes": row["outcomes"],
                             "value_detail": {} if implied is None else {"implied_growth": implied}})
    return rows, dates


def step(panel: list[dict], ledger: Ledger, today: str, seed_rules: dict) -> dict:
    candidates = ledger.candidates()
    if not candidates:
        seed = as_candidate(seed_rules, today, None, f"seed from {seed_rules['version']}")
        ledger.save_candidate(seed)
        candidates = [seed]
    history = set(backtest.HOLDOUT + backtest.AS_OF) | {d for d in quarter_ends(FORWARD_START, today) if maturity(d) <= today}
    forward_dates = quarter_ends(FORWARD_START, today)

    def seal_all(candidate):
        return sum(ledger.seal(candidate["id"], d, today, _labelled(panel, candidate["rules"], {d}))
                   for d in forward_dates)

    sealed = {c["id"]: seal_all(c) for c in candidates if not c["retired"]}
    board = []
    for c in candidates:
        rows, dates = forward_rows(panel, ledger, c, today)
        report = backtest.summarize(rows, c["rules"]) if rows else None
        in_sample = backtest.summarize(_labelled(panel, c["rules"], history), c["rules"])
        entry = {"id": c["id"], "origin": c["origin"], "frozen_at": c["frozen_at"], "retired": c["retired"],
                 "in_sample_fitness": round(fitness(in_sample), 4), "in_sample_acceptance": in_sample["acceptance"],
                 "forward_dates": len(dates), "forward_acceptance": report["acceptance"] if report else None,
                 "ready_for_review": bool(report and len(dates) >= MIN_FORWARD_DATES and report["activate"])}
        if not c["retired"] and report and len(dates) >= MIN_FORWARD_DATES and not report["activate"]:
            c["retired"] = today
            entry["retired"] = today
            ledger.save_candidate(c)
        board.append(entry)
    live = [c for c in candidates if not c["retired"]]
    proposed = []
    if len(live) < MAX_LIVE:
        best = max(board, key=lambda e: (e["in_sample_fitness"], e["id"]))
        parent = next(c for c in candidates if c["id"] == best["id"])
        known = {c["id"] for c in candidates}
        scored = []
        for change, rules in neighbours(parent["rules"]):
            if candidate_id(rules) in known:
                continue
            report = backtest.summarize(_labelled(panel, rules, history), rules)
            scored.append((round(fitness(report), 4), change, rules))
        scored.sort(key=lambda item: (-item[0], item[1]))
        for score, change, rules in scored[:min(PROPOSE_PER_STEP, MAX_LIVE - len(live))]:
            if score < best["in_sample_fitness"]:
                break
            child = as_candidate(rules, today, parent["id"], change)
            ledger.save_candidate(child)
            sealed[child["id"]] = seal_all(child)
            proposed.append({"id": child["id"], "change": change, "in_sample_fitness": score})
    result = {"today": today, "candidates": board, "proposed": proposed, "sealed": sealed,
              "next_maturity": next((maturity(d) for d in forward_dates if maturity(d) > today), None),
              "ready_for_review": [e["id"] for e in board if e["ready_for_review"]]}
    (ledger.root / "scoreboard.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    (ledger.root / "STATUS.md").write_text(render(result), encoding="utf-8")
    return result


def render(result: dict) -> str:
    lines = [f"# Position walk-forward — {result['today']}", "",
             f"Next forward outcome matures on {result['next_maturity']}. A candidate needs {MIN_FORWARD_DATES} forward dates.", "",
             "| candidate | origin | frozen | in-sample fitness | forward dates | forward gate | status |", "|---|---|---|---|---|---|---|"]
    for e in sorted(result["candidates"], key=lambda e: -e["in_sample_fitness"]):
        gate = "—" if not e["forward_acceptance"] else ", ".join(k.split()[0] for k, v in e["forward_acceptance"].items() if v) or "none"
        status = "ready for review" if e["ready_for_review"] else f"retired {e['retired']}" if e["retired"] else "live"
        lines.append(f"| {e['id']} | {e['origin']} | {e['frozen_at']} | {e['in_sample_fitness']} | {e['forward_dates']} | {gate} | {status} |")
    lines += ["", "Proposed this run: " + (", ".join(f"{p['id']} ({p['change']})" for p in result["proposed"]) or "none"), ""]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("command", choices=["step"])
    ap.add_argument("--cache", default="cache")
    ap.add_argument("--ledger", default="ledger")
    ap.add_argument("--today", default=date.today().isoformat())
    a = ap.parse_args()
    seed = labels.load_rules(SEED)
    dates = backtest.HOLDOUT + backtest.AS_OF + quarter_ends(FORWARD_START, a.today)
    panel = backtest.build_panel(Path(a.cache), backtest.tickers("ALL"), dates, seed)
    result = step(panel, Ledger(Path(a.ledger)), a.today, seed)
    print(render(result))
    flag = Path(a.ledger) / "READY_FOR_REVIEW"
    if result["ready_for_review"]:
        flag.write_text("\n".join(result["ready_for_review"]) + "\n", encoding="utf-8")
    elif flag.exists():
        flag.unlink()


if __name__ == "__main__":
    main()
