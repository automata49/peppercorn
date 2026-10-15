import tempfile
import unittest
from pathlib import Path
from .drive_pdf_reports import extract, upsert_sql


class DrivePDFReportsTest(unittest.TestCase):
    def test_extract_vector_render_and_idempotent_upsert(self):
        import fitz
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'fixture.pdf'
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((50, 70), 'Synthetic research fixture. Orders and margins need verification. No trade execution.')
            page.draw_rect(fitz.Rect(50, 100, 250, 140), color=(1, 0, 0), fill=(1, 0, 0))
            page.insert_link({'kind': fitz.LINK_URI, 'from': fitz.Rect(50, 60, 100, 75), 'uri': 'https://example.com/source'})
            doc.save(path)
            payload = extract(path, file_id='fixture_report_12345', title="Report's title", modified_at='2026-10-15T02:00:00Z')
            self.assertIn('Orders', payload['pages'][0]['text'])
            self.assertEqual(payload['links'][0]['url'], 'https://example.com/source')
            self.assertTrue(payload['pages'][0]['images'][0].startswith('data:image/webp;base64,'))
            self.assertEqual(payload['content_hash'], extract(path, file_id='fixture_report_12345', title='same', modified_at='2026-10-15T02:00:00Z')['content_hash'])
            sql = upsert_sql(payload, '10000000-0000-0000-0000-000000000001')
            self.assertIn("Report''s title", sql)
            self.assertIn('on conflict (user_id,drive_file_id)', sql)
            self.assertIn('excluded.summary is distinct from previous.summary', sql)
            self.assertIn('excluded.pages is distinct from previous.pages', sql)
            self.assertIn('excluded.source_modified_at >= previous.source_modified_at', sql)

    def test_rejects_malformed_inputs(self):
        with self.assertRaises(ValueError):
            extract('unused', file_id='bad', title='report', modified_at='2026-10-15T02:00:00Z')
        with self.assertRaises(ValueError):
            upsert_sql({'folder_id':'unregistered'}, '10000000-0000-0000-0000-000000000001')


if __name__ == '__main__':
    unittest.main()
