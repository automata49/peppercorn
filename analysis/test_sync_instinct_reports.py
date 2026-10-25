import copy
import unittest
from analysis.sync_instinct_reports import normalize, owner_id
from analysis.drive_pdf_reports import upsert_sql
from analysis.instinct_images import ImageCollector
from analysis.test_instinct_images import IMAGE, reader

UID='10000000-0000-0000-0000-000000000001'
REPORT={'version':1,'type':'report','id':'folio-research-20261026','title':'시장·산업 리포트',
        'published_at':'2026-10-25T10:00:00Z','updated_at':'2026-10-25T11:00:00Z',
        'summary':['[산업] 공급사 발표에 따르면 설비 투자가 증가했다.'],
        'tickers':[{'market':'US','ticker':'NVDA'}],
        'sections':[{'heading':'설비 투자','body':'발표된 사실과 전망을 구분합니다.', 'images':[],
                     'tables':[{'caption':'매출 · USD million · 2025년','columns':['기간','매출'],'rows':[['2025','100']]}]}],
        'sources':[{'label':'공식 발표','url':'https://issuer.example/news'}]}


def convert(raw):
    return normalize(raw,file_id='fixture_report_12345',modified_at='2026-10-25T12:00:00Z',images=ImageCollector(max_fetches=0))


class ReportTests(unittest.TestCase):
    def test_private_contract_reuses_owner_storage(self):
        payload=convert(REPORT)
        self.assertEqual(payload['pages'][0]['heading'],'설비 투자')
        self.assertEqual(payload['pages'][0]['tables'][0]['rows'][0][1],'100')
        self.assertEqual(payload['pages'][0]['report_id'],REPORT['id'])
        sql=upsert_sql(payload,UID)
        self.assertIn('on conflict (user_id,drive_file_id)',sql)
        self.assertIn('excluded.source_modified_at >= previous.source_modified_at',sql)
    def test_hash_is_stable_and_tracks_corrections(self):
        self.assertEqual(convert(REPORT)['content_hash'],convert(copy.deepcopy(REPORT))['content_hash'])
        changed=copy.deepcopy(REPORT);changed['sections'][0]['body']='정정된 본문입니다.'
        self.assertNotEqual(convert(REPORT)['content_hash'],convert(changed)['content_hash'])
    def test_owner_never_guessed_across_accounts(self):
        self.assertEqual(owner_id([{'user_id':UID}]),UID)
        with self.assertRaises(ValueError):owner_id([])
        with self.assertRaises(ValueError):owner_id([{'user_id':UID},{'user_id':'20000000-0000-0000-0000-000000000002'}])
        with self.assertRaises(ValueError):owner_id([{'user_id':UID}],'20000000-0000-0000-0000-000000000002')
    def test_invalid_sources_timestamps_and_tables_rejected(self):
        for key,value in [('sources',[{'label':'bad','url':'javascript:alert(1)'}]),('updated_at','2027-01-01T00:00:00Z'),('summary',[])]:
            with self.assertRaises(ValueError):convert({**REPORT,key:value})
        malformed=copy.deepcopy(REPORT);malformed['sections'][0]['tables'][0]['rows']=[['one cell']]
        with self.assertRaises(ValueError):convert(malformed)
    def test_html_is_plain_text_and_unknown_image_falls_back(self):
        report=copy.deepcopy(REPORT);report['sections'][0].update(body='<script>alert(1)</script>',images=[{'image_url':'http://127.0.0.1'}])
        payload=convert(report)
        self.assertEqual(payload['pages'][0]['images'],[])
        self.assertEqual(payload['pages'][0]['text'],'<script>alert(1)</script>')

class ImageRecoveryTests(unittest.TestCase):
    def test_many_repeated_images_fit_reader_and_store_bytes_once(self):
        report=copy.deepcopy(REPORT)
        report['sections']=[{'heading':str(i),'body':'bounded text','images':[IMAGE]*3} for i in range(21)]
        payload=normalize(report,file_id='fixture_report_12345',modified_at='2026-10-25T12:00:00Z',images=ImageCollector(read=reader))
        self.assertEqual(sum(len(p['images']) for p in payload['pages']),60)
        self.assertNotIn('url',payload['pages'][0]['image_meta'][0])
        self.assertEqual(payload['pages'][0]['image_meta'][0]['image_index'],0)
    def test_transient_image_failure_marks_retry(self):
        report=copy.deepcopy(REPORT);report['sections'][0]['images']=[IMAGE]
        def unavailable(*a,**k):raise TimeoutError('temporary')
        payload=normalize(report,file_id='fixture_report_12345',modified_at='2026-10-25T12:00:00Z',images=ImageCollector(read=unavailable))
        self.assertTrue(payload['pages'][0]['pending_images'])
        self.assertEqual(payload['pages'][0]['images'],[])
    def test_unknown_rights_stays_permanent_fallback(self):
        report=copy.deepcopy(REPORT);report['sections'][0]['images']=[{**IMAGE,'source_url':'https://issuer.example/news','usage_rights':'unknown'}]
        payload=normalize(report,file_id='fixture_report_12345',modified_at='2026-10-25T12:00:00Z',images=ImageCollector(read=reader))
        self.assertFalse(payload['pages'][0]['pending_images'])
        self.assertEqual(len(payload['pages'][0]['image_rejections']),1)
