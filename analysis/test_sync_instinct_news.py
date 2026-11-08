import json
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch, Mock
from datetime import datetime, timezone
from analysis.sync_instinct_news import clean, parse_file
from analysis import sync_instinct_news as sync

NOW = datetime(2026, 10, 17, 5, tzinfo=timezone.utc)
VALID = {
    "market": "US", "ticker": "NVDA", "headline": "NVIDIA announces a new platform",
    "summary": "The company announced a new enterprise hardware platform.",
    "source_name": "NVIDIA Newsroom", "source_url": "https://nvidianews.nvidia.com/news/platform",
    "published_at": "2026-10-16T11:00:00Z"
}
class NewsValidationTests(unittest.TestCase):
    def test_short_korean_topic_long_headline_and_public_http_article(self):
        item = {**VALID, "type": "trend", "trend_topic": "로봇", "market": "GLOBAL",
                "headline": "긴 제목 " * 30, "source_url": "http://www.hansbiz.co.kr/news/articleView.html?idxno=876567"}
        parsed = clean(item, NOW)
        self.assertEqual(parsed["trend_topic"], "로봇")
        self.assertEqual(parsed["headline"], item["headline"].strip())
        self.assertTrue(parsed["source_url"].startswith("http://"))
        self.assertIsNone(clean({**item, "source_url": "http://localhost/private"}, NOW))

    def test_valid(self):
        self.assertEqual(clean(VALID, NOW)["ticker"], "NVDA")
    def test_private_drive_link_refused(self):
        self.assertIsNone(clean({**VALID, "source_url": "https://drive.google.com/file/d/test/view"}, NOW))
    def test_unsupported_ticker_refused(self):
        self.assertIsNone(clean({**VALID, "ticker": "NOT A TICKER"}, NOW))
    def test_private_content_not_exported(self):
        item = clean({**VALID, "private_note": "never publish", "drive_file_id": "secret"}, NOW)
        self.assertNotIn("private_note", item)
        self.assertNotIn("drive_file_id", item)
    def test_older_article_keeps_original_date(self):
        self.assertEqual(clean({**VALID, "published_at": "2026-09-01T00:00:00Z"}, NOW)["published_at"], "2026-09-01T00:00:00Z")
    def test_bounded_versioned_json(self):
        body = json.dumps({"version": 1, "items": [VALID]}).encode()
        self.assertEqual(len(parse_file(body, NOW)), 1)
        with self.assertRaises(ValueError):
            parse_file(json.dumps({"version": 2, "items": [VALID]}).encode(), NOW)
    def test_more_than_100_articles_are_retained(self):
        items = [{**VALID, "source_url": f"https://example.com/news/{i}"} for i in range(125)]
        self.assertEqual(len(parse_file(json.dumps({"version": 1, "items": items}).encode(), NOW)), 125)

    def test_sync_includes_old_files_and_more_than_60_articles(self):
        articles = [{**VALID, "source_url": f"https://example.com/news/{i}",
                     "published_at": "2026-09-01T00:00:00Z"} for i in range(125)]
        def request(url, token):
            if "alt=media" in url:
                return json.dumps({"version": 1, "items": articles}).encode()
            return {"files": [{"id": "old_news_file_123", "name": "Folio-News-2026-09-01.json",
                               "mimeType": "application/json", "size": "50000"}]}
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "news.json"
            with patch.object(sync, "TARGET", target), patch.object(sync, "get_token", return_value="test"), \
                 patch.object(sync, "request_json", side_effect=request), \
                 patch("analysis.instinct_images.ImageCollector", return_value=Mock()):
                sync.main()
            result = json.loads(target.read_text())
            self.assertEqual(len(result["items"]), 125)
            self.assertEqual(result["items"][-1]["published_at"], "2026-09-01T00:00:00Z")

    def test_future_article_refused(self):
        self.assertIsNone(clean({**VALID, "published_at": "2026-11-01T00:00:00Z"}, NOW))

    def test_independent_trend_without_ticker(self):
        trend = {k: v for k, v in VALID.items() if k != "ticker"}
        trend.update(type="trend", market="GLOBAL", trend_topic="AI Infrastructure")
        item = clean(trend, NOW)
        self.assertEqual(item["type"], "trend")
        self.assertEqual(item["trend_topic"], "AI Infrastructure")
        self.assertNotIn("ticker", item)
        self.assertEqual(len(parse_file(json.dumps({"version":1, "items":[trend]}).encode(), NOW)), 1)

    def test_malformed_trend_rejected(self):
        trend = {k: v for k, v in VALID.items() if k != "ticker"}
        trend.update(type="trend", market="GLOBAL", trend_topic="AI Infrastructure")
        self.assertIsNone(clean({**trend, "trend_topic":""}, NOW))
        self.assertIsNone(clean({**trend, "market":"INVALID"}, NOW))
        self.assertIsNone(clean({**trend, "source_url":"http://localhost/private"}, NOW))

if __name__ == "__main__":
    unittest.main()
