"""Daily prices for the Position Value label, from the Yahoo chart endpoint the Swing refresh job already uses.

Price basis. Yahoo `close` is split-adjusted to today's share basis and not dividend-adjusted; `adjclose` is
also dividend-adjusted and is used only for backtest total returns. A market capitalisation therefore needs
the share count moved to today's basis: a count filed on date F is multiplied by every split after F, because
filings issued after a split restate share counts retroactively (ASC 260). The result equals the real price
times the real share count on the valuation day.
"""
from __future__ import annotations

import hashlib
from datetime import date, datetime, timezone

import requests

URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
MAX_STALE_DAYS = 7


def _iso(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()


def fetch(symbol: str, start: str = "2014-01-01") -> dict:
    begin = int(datetime.fromisoformat(start).replace(tzinfo=timezone.utc).timestamp())
    response = requests.get(URL.format(symbol=symbol), headers={"User-Agent": "Mozilla/5.0"}, timeout=60, params={
        "period1": begin, "period2": int(datetime.now(timezone.utc).timestamp()), "interval": "1d", "events": "split,div"})
    response.raise_for_status()
    return parse(response.json(), symbol, hashlib.sha256(response.content).hexdigest())


def parse(body: dict, symbol: str, raw_sha256: str | None = None) -> dict:
    result = body["chart"]["result"][0]
    quote, adj = result["indicators"]["quote"][0], result["indicators"]["adjclose"][0]["adjclose"]
    rows = [(_iso(ts), c, a) for ts, c, a in zip(result.get("timestamp", []), quote["close"], adj)
            if c is not None and a is not None and c > 0 and a > 0]
    splits = sorted(({"date": _iso(int(s["date"])), "ratio": s["numerator"] / s["denominator"]}
                     for s in result.get("events", {}).get("splits", {}).values()), key=lambda s: s["date"])
    return {"symbol": symbol, "currency": result["meta"].get("currency"), "source": "yahoo-chart",
            "dates": [r[0] for r in rows], "close": [r[1] for r in rows], "adjclose": [r[2] for r in rows],
            "splits": splits, "raw_sha256": raw_sha256}


def _index_on(prices: dict, day: str) -> int | None:
    """Last trading day on or before `day`, if it is at most MAX_STALE_DAYS old."""
    dates = prices["dates"]
    lo, hi = 0, len(dates)
    while lo < hi:
        mid = (lo + hi) // 2
        if dates[mid] <= day:
            lo = mid + 1
        else:
            hi = mid
    i = lo - 1
    if i < 0 or (date.fromisoformat(day) - date.fromisoformat(dates[i])).days > MAX_STALE_DAYS:
        return None
    return i


def close_on(prices: dict, day: str) -> tuple[str, float] | None:
    i = _index_on(prices, day)
    return None if i is None else (prices["dates"][i], prices["close"][i])


def total_return(prices: dict, start: str, end: str) -> float | None:
    a, b = _index_on(prices, start), _index_on(prices, end)
    return None if a is None or b is None else prices["adjclose"][b] / prices["adjclose"][a] - 1


def split_factor_after(prices: dict, day: str) -> float:
    factor = 1.0
    for split in prices["splits"]:
        if split["date"] > day:
            factor *= split["ratio"]
    return factor


def market_cap(prices: dict, day: str, shares: float | None, shares_filed: str | None) -> dict | None:
    """Price basis for one valuation day, or None when the price or share basis is missing."""
    hit = close_on(prices, day)
    if hit is None or not shares or not shares_filed:
        return None
    price_day, close = hit
    factor = split_factor_after(prices, shares_filed)
    return {"price_date": price_day, "close_split_adjusted": close, "shares": shares, "shares_filed": shares_filed,
            "split_factor": factor, "market_cap": close * shares * factor, "source": prices["source"],
            "symbol": prices["symbol"], "raw_sha256": prices.get("raw_sha256")}
