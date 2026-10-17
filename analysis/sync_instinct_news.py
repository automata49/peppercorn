"""Sync PUBLIC Instinct article summaries from the existing private Folio Drive folder.

The only published output is sanitized article metadata, never PDFs, Drive links,
OAuth credentials, images or private report content. Requires Google OAuth
read-only Drive token credentials as GitHub Actions secrets.
"""
from __future__ import annotations

import ipaddress
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

FOLDER_ID = "1HdM3uXO3_cAnJS0igLlDIsCylch6KMey"
NAME = re.compile(r"^Folio-News-(\d{4}-\d{2}-\d{2})\.json$")
TARGET = Path("public/data/instinct-leader-news.json")
MAX_FILE = 500_000
MAX_ITEMS = 60


def utc(s):
    if not isinstance(s, str) or not re.search(r"(?:Z|[+-]\d\d:\d\d)$", s):
        raise ValueError("Timestamp requires UTC offset")
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dt.astimezone(timezone.utc)


def url_ok(value):
    if not isinstance(value, str) or len(value) > 2048:
        return False
    try:
        p = urllib.parse.urlsplit(value)
        if p.scheme != "https" or not p.hostname or p.username or p.password or p.port not in (None, 443):
            return False
    except ValueError:
        return False
    host = p.hostname.lower()
    if "." not in host or host.endswith((".local", ".internal")) or host in ("drive.google.com", "docs.google.com", "files.instinct.com"):
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        return True


def clean(raw, now):
    """Reject unsupported fields by reconstructing the public article from an allowlist."""
    if not isinstance(raw, dict):
        return None
    market, ticker = raw.get("market"), raw.get("ticker")
    if market not in ("KR", "US") or not isinstance(ticker, str):
        return None
    if not re.fullmatch(r"\d{6}" if market == "KR" else r"[A-Z][A-Z0-9.-]{0,11}", ticker):
        return None
    for field, lo, hi in (("headline", 5, 120), ("summary", 10, 320), ("source_name", 2, 100)):
        value = raw.get(field)
        if not isinstance(value, str) or not lo <= len(value.strip()) <= hi:
            return None
    if not url_ok(raw.get("source_url")):
        return None
    try:
        published = utc(raw["published_at"])
    except (KeyError, TypeError, ValueError):
        return None
    if not -timedelta(hours=1) <= now - published <= timedelta(days=7):
        return None
    return {k: raw[k].strip() if k != "published_at" else published.isoformat().replace("+00:00", "Z")
            for k in ("market", "ticker", "headline", "summary", "source_name", "source_url", "published_at")}


def parse_file(data, now):
    if len(data) > MAX_FILE:
        raise ValueError("File exceeds limit")
    obj = json.loads(data)
    if not isinstance(obj, dict) or obj.get("version") != 1 or not isinstance(obj.get("items"), list) or len(obj["items"]) > 100:
        raise ValueError("Expected version 1 news object with <=100 items")
    return [p for x in obj["items"] if (p := clean(x, now)) is not None]


def request_json(url, token, *, data=None, headers=None):
    h = {"Authorization": "Bearer " + token, **(headers or {})}
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        blob = r.read(MAX_FILE + 1 if "alt=media" in url else 1_000_000)
    return blob if "alt=media" in url else json.loads(blob)


def get_token():
    keys = ("GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET", "GOOGLE_DRIVE_REFRESH_TOKEN")
    missing = [k for k in keys if not os.environ.get(k)]
    if missing:
        raise RuntimeError("Google Drive read-only OAuth secrets not configured: " + ", ".join(missing))
    payload = urllib.parse.urlencode({
        "client_id": os.environ[keys[0]], "client_secret": os.environ[keys[1]],
        "refresh_token": os.environ[keys[2]], "grant_type": "refresh_token"
    }).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=payload,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=20) as r:
        response = json.load(r)
    return response["access_token"]


def main():
    token = get_token()
    now = datetime.now(timezone.utc)
    q = "'" + FOLDER_ID + "' in parents and trashed = false and name contains 'Folio-News-'"
    items, page_token = [], None
    for _ in range(5):
        params = {"q": q, "fields": "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
                  "pageSize": "100"}
        if page_token:
            params["pageToken"] = page_token
        result = request_json("https://www.googleapis.com/drive/v3/files?" + urllib.parse.urlencode(params), token)
        items.extend(result.get("files", []))
        page_token = result.get("nextPageToken")
        if not page_token:
            break
    else:
        raise RuntimeError("Drive folder listing exceeded safe page budget")
    articles = []
    for f in items:
        m = NAME.fullmatch(f.get("name", ""))
        if not m or f.get("mimeType") != "application/json" or int(f.get("size", MAX_FILE + 1)) > MAX_FILE:
            continue
        try:
            stamp = datetime.strptime(m.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc)
            if not -timedelta(days=1) <= now - stamp <= timedelta(days=8):
                continue
            fid = f["id"]
            if not re.fullmatch(r"[A-Za-z0-9_-]{10,100}", fid):
                continue
            raw = request_json("https://www.googleapis.com/drive/v3/files/" + fid + "?alt=media", token)
            articles.extend(parse_file(raw, now))
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            print("Skipped invalid news file", f.get("name"), str(exc), file=sys.stderr)
    # Prefer most recently published news, unique by market+ticker+publisher URL.
    dedup = {}
    for a in articles:
        key = (a["market"], a["ticker"], a["source_url"])
        dedup[key] = a
    selected = sorted(dedup.values(), key=lambda a: a["published_at"], reverse=True)[:MAX_ITEMS]
    previous = json.loads(TARGET.read_text()) if TARGET.exists() else None
    if previous and previous.get("items") == selected:
        print("Unchanged:", len(selected), "items")
        return
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps({"version": 1, "updated_at": now.isoformat().replace("+00:00", "Z"),
                                  "items": selected}, ensure_ascii=False, indent=2) + "\n")
    print("Published", len(selected), "public articles")


if __name__ == "__main__":
    main()
