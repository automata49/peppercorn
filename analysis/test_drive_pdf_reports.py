import tempfile
import unittest
from pathlib import Path
from .drive_pdf_reports import extract, upsert_sql
from .research_summary import FALLBACK, summarize_research


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

    def test_summary_quotes_market_industry_and_company_facts_not_report_intent(self):
        intro = '이번 리포트는 반도체 산업의 투자 방향을 분석한다.'
        market = '미국 국채 금리는 4.2%로 상승했고 나스닥 지수는 1.4% 하락했다.'
        industry = '반도체 재고는 2026년 3분기에 전분기 대비 12% 감소했다.'
        stock = '엔비디아 매출은 전년 동기 대비 34% 증가했다.'
        text = '\n\n'.join((intro, market, industry, stock))
        lines = summarize_research(text, preferred=[intro, '이 리포트는 시장 전망을 설명합니다.'])
        self.assertEqual(lines, ['[시장] ' + market, '[산업] ' + industry, '[종목] ' + stock])
        for line in lines:
            self.assertIn(line.split('] ', 1)[1], text)

    def test_stock_only_and_no_supported_claim(self):
        company = 'NVDA revenue increased 31% year over year during the last quarter.'
        self.assertEqual(summarize_research(company), ['[종목] ' + company])
        earnings = '9/1 발표 FY27 Q2 전사 매출470억 달러(+58%), GAAP EPS6.34달러, 영업현금22억 달러였습니다.'
        self.assertEqual(summarize_research(earnings), ['[종목] ' + earnings])
        self.assertFalse(any('증거가 아닙니다' in line for line in summarize_research(
            '주가 하락은 기업 매출 악화의 증거가 아닙니다.\\n\\n' + earnings)))
        self.assertEqual(summarize_research('목차와 참고문헌입니다.'), [FALLBACK])
        with self.assertRaises(ValueError):
            summarize_research(company, preferred=['ok'] * 6)

    def test_source_pdf_import_overrides_report_direction_summary(self):
        import fitz
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'facts.pdf'
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((45, 70), 'The report outlines the semiconductor investment direction.')
            page.insert_text((45, 105), 'Nasdaq rose 2% while Treasury yields fell to 3.8%.')
            page.insert_text((45, 140), 'NVDA revenue increased 31% year over year in 2026.')
            doc.save(path)
            result = extract(path, file_id='fixture_facts_12345', title='Research facts',
                             modified_at='2026-10-17T02:00:00Z',
                             summary=['The report outlines the semiconductor investment direction.'])
            self.assertTrue(any(line.startswith('[시장] ') for line in result['summary']))
            self.assertTrue(any(line.startswith('[종목] ') for line in result['summary']))
            self.assertFalse(any('report outlines' in line.lower() for line in result['summary']))

    def test_rejects_malformed_inputs(self):
        with self.assertRaises(ValueError):
            extract('unused', file_id='bad', title='report', modified_at='2026-10-15T02:00:00Z')
        with self.assertRaises(ValueError):
            upsert_sql({'folder_id':'unregistered'}, '10000000-0000-0000-0000-000000000001')


if __name__ == '__main__':
    unittest.main()
