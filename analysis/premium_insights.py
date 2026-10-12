"""Registered HS Academy public metadata only; never reads subscription bodies."""
import datetime as dt
import hashlib
import json
import os
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from analysis.leader_insights import PublicHTTP, HOSTS, UTC, iso, plain, summarize, MODEL

CHANNEL = 'https://contents.premium.naver.com/hsacademy/hsacademy1'
BOILERPLATE = re.compile(r"본인(?:의)?\s*책임|투자자.{0,12}책임|투자\s*(?:관련\s*)?정보.{0,20}참고(?:사항|용)|외부의.{0,20}(?:압력|간섭)")


def article_url(value):
    try:
        u = urlsplit(urljoin(CHANNEL + '/', value))
        if (u.scheme == 'https' and u.hostname == 'contents.premium.naver.com'
                and not u.username and not u.password and u.port in (None, 443)
                and re.fullmatch(r'/hsacademy/hsacademy1/contents/[A-Za-z0-9]+', u.path)):
            return 'https://contents.premium.naver.com' + u.path
    except (ValueError, TypeError):
        pass
    return None

class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links, self.meta = [], {}
        self.in_head = False
        self.head_seen = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'head' and not self.head_seen:
            self.in_head, self.head_seen = True, True
        if tag == 'a' and article_url(a.get('href', '')):
            url = article_url(a['href'])
            if url not in self.links:
                self.links.append(url)
        if tag == 'meta' and self.in_head:
            key = a.get('property') or a.get('name')
            if key in ('og:title', 'og:description'):
                self.meta[key] = plain(a.get('content', ''))

    def handle_endtag(self, tag):
        if tag == 'head':
            self.in_head = False

def collect(http, now, key=''):
    result = {'version': 1, 'collected_at': iso(now), 'state': 'unavailable',
              'ai_status': 'not_configured' if not key else 'no_drafts', 'items': []}
    provider_stopped = False
    try:
        listing = Metadata()
        listing.feed(http.get(CHANNEL + "/contents"))
        result['state'] = 'empty'
        for url in listing.links[:3]:
            try:
                page = Metadata()
                page.feed(http.get(url))
                title = page.meta.get('og:title', '')[:120]
                if not title:
                    continue
                preview = page.meta.get('og:description', '')[:1000]
                item = {'id': hashlib.sha256(url.encode()).hexdigest()[:20], 'url': url,
                        'title': title, 'summary': '', 'summary_kind': 'title_only'}
                if key and len(preview) >= 40 and not provider_stopped:
                    try:
                        draft = summarize({'id': item['id'], 'title': title, 'text': preview}, key)
                        if BOILERPLATE.search(draft['summary']):
                            raise ValueError('uninformative preview')
                        item.update(summary=draft['summary'], summary_kind='public_preview_draft',
                                    evidence=draft['evidence'], model=MODEL)
                        result['ai_status'] = 'ready'
                    except ValueError:
                        result['ai_status'] = 'ready' if any(i['summary_kind'] == 'public_preview_draft' for i in result['items']) else 'no_drafts'
                    except Exception:
                        provider_stopped = True
                        result['ai_status'] = 'unavailable'
                result['items'].append(item)
            except Exception:
                continue
        if result['items']:
            result['state'] = 'collected'
    except Exception:
        pass
    return result

def main():
    # Exact registered host, with the existing robots/DNS/redirect/byte/time gates.
    HOSTS.clear()
    HOSTS.add('contents.premium.naver.com')
    result = collect(PublicHTTP(), dt.datetime.now(UTC), os.environ.get('GEMINI_API_KEY', ''))
    out = Path('dist/data/premium-insights.json')
    out.parent.mkdir(parents=True, exist_ok=True)
    temp = out.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    temp.replace(out)
    print(f"HS Academy: {result['state']}; public metadata: {len(result['items'])}; AI: {result['ai_status']}")

if __name__ == '__main__':
    main()
