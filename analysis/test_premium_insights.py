import datetime as dt
import unittest
from unittest.mock import patch
from analysis.premium_insights import CHANNEL, article_url, collect
from analysis.leader_insights import UTC

URL = CHANNEL + '/contents/261012083419860vz'
class HTTP:
    def get(self, url):
        if url == CHANNEL + "/contents":
            return f'<a href="{URL}?tracking=1">article</a><a href="https://evil.example/x">bad</a>'
        return '<meta property="og:title" content="반도체 산업 변화"><meta property="og:description" content="공개 미리보기에서 확인한 반도체 산업 변화와 기업의 경쟁 환경을 정리합니다."><div>유료 본문 SECRET MUST NOT REACH MODEL</div>'
class PremiumTests(unittest.TestCase):
    def test_exact_channel_urls(self):
        self.assertEqual(article_url(URL+'?tracking=1'), URL)
        for value in ['https://evil.example/x', CHANNEL+'/contents/x/other', CHANNEL+'/contents/%2e%2e', 'https://contents.premium.naver.com:444/hsacademy/hsacademy1/contents/x', CHANNEL.replace('hsacademy1','other')+'/contents/x']:
            self.assertIsNone(article_url(value))
    def test_missing_key_never_invents_summary(self):
        p = collect(HTTP(), dt.datetime.now(UTC))
        self.assertEqual(p['ai_status'],'not_configured')
        self.assertEqual(p['items'][0]['summary_kind'],'title_only')
        self.assertEqual(p['items'][0]['summary'],'')
    def test_only_public_metadata_sent_to_model(self):
        with patch('analysis.premium_insights.summarize',return_value={'summary':'공개 미리보기로 살펴본 산업 변화입니다.', 'evidence':'공개 미리보기에서 확인한'}) as mock:
            p = collect(HTTP(),dt.datetime.now(UTC),'fake-key')
            self.assertNotIn('SECRET', str(mock.call_args))
            self.assertEqual(p['items'][0]['summary_kind'],'public_preview_draft')
            self.assertEqual(p['ai_status'],'ready')
    def test_provider_failure_retains_link(self):
        with patch('analysis.premium_insights.summarize',side_effect=ValueError):
            p = collect(HTTP(),dt.datetime.now(UTC),'fake-key')
            self.assertEqual(p['ai_status'],'unavailable')
            self.assertEqual(p['items'][0]['url'],URL)
            self.assertEqual(p['items'][0]['summary'],'')
    def test_denied_crawling_has_no_articles(self):
        class Denied:
            def get(self,url): raise ValueError('robots disallow')
        self.assertEqual(collect(Denied(),dt.datetime.now(UTC))['state'],'unavailable')
