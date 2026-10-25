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

class ExportCompatibilityTests(unittest.TestCase):
    def legacy(self):
        return {
            'id':'synthetic-legacy-report','title':'Synthetic legacy report',
            'published_at':REPORT['published_at'],'updated_at':REPORT['updated_at'],
            'summaries':{'market':'Observed market fact.','industry':'Observed industry fact.','stocks':'Observed company fact.'},
            'disclaimer':'Synthetic data only.',
            'sections':[{'heading':'Industry evidence','facts':['Observed capacity change.','A dated company statement.'],
                         'outlook':['Company forecast remains uncertain.'],'images':[]}],
            'sources':REPORT['sources'],'tickers':REPORT['tickers']}

    def test_known_export_without_discriminators_is_lossless_and_private(self):
        import hashlib,json
        raw=self.legacy();original=copy.deepcopy(raw)
        payload=convert(raw)
        self.assertEqual(raw,original)
        self.assertEqual(payload['summary'],['[시장] Observed market fact.','[산업] Observed industry fact.','[종목] Observed company fact.'])
        body=payload['pages'][0]['text']
        self.assertIn('확인된 사실\n• Observed capacity change.',body)
        self.assertIn('전망 · 미확정\n• Company forecast remains uncertain.',body)
        self.assertIn('자료 유의사항\nSynthetic data only.',body)
        self.assertEqual(payload['content_hash'],hashlib.sha256(json.dumps(raw,ensure_ascii=False,sort_keys=True).encode()).hexdigest())

    def test_explicit_unknown_version_or_type_is_never_downgraded(self):
        for extra in ({'version':2},{'type':'news'},{'version':'1'}):
            with self.assertRaises(ValueError):convert({**self.legacy(),**extra})

    def test_ambiguous_or_malformed_legacy_input_fails_closed(self):
        for extra in ({'summaries':{'unknown':'Do not silently drop this'}},
                      {'sections':[{'heading':'Missing factual body'}]},
                      {'sections':[{'heading':'Invalid list','facts':'not a list','outlook':[]}]},
                      {'summaries':{'market':{'not':'text'}}}):
            with self.assertRaises(ValueError):convert({**self.legacy(),**extra})
        with self.assertRaises(ValueError):convert({k:v for k,v in REPORT.items() if k not in ('version','type')})

    def test_explicit_v1_facts_outlook_and_native_contract_both_work(self):
        payload=convert({**self.legacy(),'version':1,'type':'report'})
        self.assertIn('확인된 사실',payload['pages'][0]['text'])
        self.assertEqual(convert(REPORT)['pages'][0]['text'],REPORT['sections'][0]['body'])

    def test_ci_diagnostics_never_contain_private_text(self):
        from analysis.sync_instinct_reports import validation_code
        self.assertEqual(validation_code(ValueError('private title and body must never appear')),'invalid_structure')
        self.assertEqual(validation_code(ValueError('Expected version 1 report')),'report_version_or_type')
        self.assertEqual(validation_code(KeyError('private value')),'missing_required_field')


class IncrementalSyncTests(unittest.TestCase):
    def test_sql_timestamp_roundtrip_handles_unchanged_and_updated_reports(self):
        import json,io
        from contextlib import redirect_stdout
        from unittest.mock import patch
        from analysis import sync_instinct_reports as sync
        fid='fixture_report_12345'
        for modified,expected in [('2026-10-25T11:00:00Z','imported=0 unchanged=1'),
                                  ('2026-10-25T12:00:00Z','imported=1 unchanged=0')]:
            writes=[]
            def query(sql):
                if 'select distinct' in sql:return [{'user_id':UID}]
                if 'select drive_file_id' in sql:return [{'drive_file_id':fid,'report_id':REPORT['id'],
                    'source_modified_at':'2026-10-25 11:00:00+00','pending_images':'false'}]
                if 'select pages' in sql:return []
                writes.append(sql);return []
            def drive(url,token,media=False):
                if media:return json.dumps(REPORT).encode()
                return {'files':[{'id':fid,'name':'Folio-Report-2026-10-25.json','mimeType':'application/json',
                                  'size':'1000','modifiedTime':modified}]}
            output=io.StringIO()
            with patch.object(sync,'query',side_effect=query),patch.object(sync,'drive',side_effect=drive),\
                 patch.object(sync,'get_token',return_value='synthetic'),patch.dict(sync.os.environ,{'FOLIO_REPORT_USER_ID':''}),redirect_stdout(output):
                sync.main()
            self.assertIn(expected,output.getvalue())
            self.assertEqual(len(writes),int('imported=1' in expected))
            self.assertNotIn(REPORT['title'],output.getvalue())

    def test_database_offset_parser_does_not_relax_export_dates(self):
        from analysis.sync_instinct_reports import stored_utc,utc
        self.assertEqual(stored_utc('2026-10-25 20:00:00+09'),utc('2026-10-25T11:00:00Z'))
        with self.assertRaises(ValueError):stored_utc('2026-10-25 11:00:00')
        with self.assertRaises(ValueError):utc('2026-10-25 11:00:00+00')

    def test_public_http_citation_preserved_but_unsafe_sources_and_images_rejected(self):
        from analysis.sync_instinct_reports import source_links
        from analysis.instinct_images import public_url
        link='http://publisher.example/original'
        self.assertEqual(source_links([{'label':'Original','url':link}])[0]['url'],link)
        for url in ['javascript:alert(1)','http://127.0.0.1/a','http://localhost/a',
                    'http://drive.google.com/file/a','http://user:password@publisher.example/a']:
            with self.assertRaises(ValueError):source_links([{'label':'Bad','url':url}])
        with self.assertRaises(ValueError):public_url(link)
