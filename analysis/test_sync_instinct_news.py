import json
import unittest
from datetime import datetime, timezone
from analysis.sync_instinct_news import clean, parse_file

NOW = datetime(2026, 10, 17, 5, tzinfo=timezone.utc)
VALID = {
    "market": "US", "ticker": "NVDA", "headline": "NVIDIA announces a new platform",
    "summary": "The company announced a new enterprise hardware platform.",
    "source_name": "NVIDIA Newsroom", "source_url": "https://nvidianews.nvidia.com/news/platform",
    "published_at": "2026-10-16T11:00:00Z"
}
class NewsValidationTests(unittest.TestCase):
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
    def test_stale_article_refused(self):
        self.assertIsNone(clean({**VALID, "published_at": "2026-09-01T00:00:00Z"}, NOW))
    def test_bounded_versioned_json(self):
        body = json.dumps({"version": 1, "items": [VALID]}).encode()
        self.assertEqual(len(parse_file(body, NOW)), 1)
        with self.assertRaises(ValueError):
            parse_file(json.dumps({"version": 2, "items": [VALID]}).encode(), NOW)
if __name__ == "__main__":
    unittest.main()
