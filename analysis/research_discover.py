"""RESEARCH-INGEST-1: discover public HS Academy Telegram messages.

This collector deliberately reads only the public Telegram preview at t.me/s/HS_academy.
It never requests contents.premium.naver.com article bodies, cookies, sessions, or subscriber content.
"""
from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
import os
import re
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

CHANNEL = "HS_academy"
PUBLIC_URL = f"https://t.me/s/{CHANNEL}"
USER_AGENT = "PeppercornResearchDiscovery/1.0 (+https://github.com/automata49/peppercorn)"
MAX_ITEMS = 50


def _clean_url(value: str) -> str | None:
    value = html.unescape(value or "").strip()
    if not value.startswith("https://"):
        return None
    return value[:2048]


def _link_type(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    if host == "contents.premium.naver.com":
        return "naver_premium"
    if host.endswith("naver.me") or host.endswith("naver.com"):
        return "naver"
    if host in {"youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"}:
        return "youtube"
    return "other"


class TelegramParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.div_depth = 0
        self.current: dict | None = None
        self.root_depth: int | None = None
        self.text_depth: int | None = None
        self.items: list[dict] = []

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        attrs = dict(attrs_list)
        if tag == "div":
            self.div_depth += 1
            classes = set((attrs.get("class") or "").split())
            post = attrs.get("data-post") or ""
            if self.current is None and "tgme_widget_message" in classes and post.startswith(CHANNEL + "/"):
                self.current = {"post": post, "text": [], "links": [], "published_at": None}
                self.root_depth = self.div_depth
            if self.current is not None and "tgme_widget_message_text" in classes:
                self.text_depth = self.div_depth
        if self.current is not None and self.text_depth is not None:
            if tag == "a":
                href = _clean_url(attrs.get("href") or "")
                if href and href not in self.current["links"]:
                    self.current["links"].append(href)
            elif tag == "br":
                self.current["text"].append("\n")
        if self.current is not None and tag == "time" and attrs.get("datetime"):
            self.current["published_at"] = attrs["datetime"]

    def handle_endtag(self, tag: str) -> None:
        if tag != "div":
            return
        if self.current is not None and self.text_depth == self.div_depth:
            self.text_depth = None
        if self.current is not None and self.root_depth == self.div_depth:
            self.items.append(self.current)
            self.current = None
            self.root_depth = None
            self.text_depth = None
        self.div_depth = max(0, self.div_depth - 1)

    def handle_data(self, data: str) -> None:
        if self.current is not None and self.text_depth is not None:
            self.current["text"].append(data)


def parse_public_page(body: str) -> list[dict]:
    parser = TelegramParser()
    parser.feed(body)
    out: list[dict] = []
    for raw in parser.items:
        external_id = raw["post"].split("/", 1)[1]
        text = "".join(raw["text"])
        text = re.sub(r"[ \t\r\f\v]+", " ", text)
        text = re.sub(r"\n\s*\n+", "\n", text).strip()
        if not text:
            continue
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        title = (lines[0] if lines else f"Telegram {external_id}")[:500]
        links = [u for u in raw["links"] if u and "t.me/" not in u][:20]
        preferred = next((u for u in links if _link_type(u) == "naver_premium"), None)
        preferred = preferred or next((u for u in links if _link_type(u) == "naver"), None)
        preferred = preferred or next((u for u in links if _link_type(u) == "youtube"), None)
        preferred = preferred or (links[0] if links else None)
        fingerprint = hashlib.sha256(f"telegram|{CHANNEL}|{external_id}".encode()).hexdigest()
        out.append({
            "source": "telegram",
            "source_key": "hs_academy",
            "external_id": external_id,
            "fingerprint": fingerprint,
            "source_url": f"https://t.me/{CHANNEL}/{external_id}",
            "linked_url": preferred,
            "linked_type": _link_type(preferred) if preferred else None,
            "title": title,
            "excerpt": text[:4000],
            "published_at": raw.get("published_at"),
            "metadata": {"links": links, "collector": "telegram-public-v1"},
        })
    return out[-MAX_ITEMS:]


def fetch_public_page() -> str:
    req = Request(PUBLIC_URL, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urlopen(req, timeout=20) as response:
        return response.read(2_000_000).decode("utf-8", errors="replace")


def github_oidc(audience: str) -> str:
    request_url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL")
    request_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not request_url or not request_token:
        raise RuntimeError("GitHub Actions OIDC environment is unavailable")
    parts = urlsplit(request_url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["audience"] = audience
    url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    req = Request(url, headers={"Authorization": f"Bearer {request_token}", "Accept": "application/json"})
    with urlopen(req, timeout=15) as response:
        payload = json.load(response)
    token = payload.get("value")
    if not token:
        raise RuntimeError("GitHub OIDC response had no token")
    return token


def push(items: list[dict], edge_url: str, audience: str) -> dict:
    token = github_oidc(audience)
    data = json.dumps({"items": items}, ensure_ascii=False).encode("utf-8")
    req = Request(edge_url, data=data, method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": USER_AGENT,
    })
    with urlopen(req, timeout=30) as response:
        return json.load(response)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--input", help="parse a local HTML fixture instead of fetching Telegram")
    p.add_argument("--push", action="store_true")
    p.add_argument("--edge-url", default="")
    p.add_argument("--audience", default="peppercorn-supabase")
    args = p.parse_args()
    body = open(args.input, encoding="utf-8").read() if args.input else fetch_public_page()
    items = parse_public_page(body)
    print(json.dumps({"count": len(items), "items": items}, ensure_ascii=False, indent=2))
    if args.push:
        if not args.edge_url.startswith("https://"):
            raise RuntimeError("--edge-url must be https://")
        result = push(items, args.edge_url, args.audience)
        print("ingest:", json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
