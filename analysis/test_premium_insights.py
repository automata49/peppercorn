import datetime as dt
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from analysis.premium_insights import CHANNEL, article_url, collect
from analysis.leader_insights import UTC

URL = CHANNEL + '/contents/261012083419860vz'
class HTTP:
    def get(self, url):
        if url == CHANNEL + "/contents":
            return f'<a href="{URL}?tracking=1">article</a><a href="https://evil.example/x">bad</a>'
        return '<head><meta property="og:title" content="반도체 산업 변화"><meta property="og:description" content="공개 미리보기에서 확인한 반도체 산업 변화와 기업의 경쟁 환경을 정리합니다."></head><div>유료 본문 SECRET MUST NOT REACH MODEL</div>'
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
        with patch('analysis.premium_insights.summarize',side_effect=HTTPError('https://generativelanguage.googleapis.com',429,'quota',None,None)):
            p = collect(HTTP(),dt.datetime.now(UTC),'fake-key')
            self.assertEqual(p['ai_status'],'unavailable')
            self.assertEqual(p['items'][0]['url'],URL)
            self.assertEqual(p['items'][0]['summary'],'')
    def test_denied_crawling_has_no_articles(self):
        class Denied:
            def get(self,url): raise ValueError('robots disallow')
        self.assertEqual(collect(Denied(),dt.datetime.now(UTC))['state'],'unavailable')

    def test_rejected_preview_does_not_cancel_other_articles(self):
        class Multiple(HTTP):
            def get(self, url):
                if url == CHANNEL + "/contents":
                    return ''.join(f'<a href="{URL}{n}">article</a>' for n in range(3))
                return super().get(url)
        with patch('analysis.premium_insights.summarize',side_effect=[ValueError('ungrounded draft'), {'summary':'검증된 공개 미리보기의 요약입니다.', 'evidence':'공개 미리보기에서 확인한'}, {'summary':'검증된 다른 공개 미리보기의 요약입니다.', 'evidence':'공개 미리보기에서 확인한'}]) as mock:
            p = collect(Multiple(),dt.datetime.now(UTC),'fake-key')
            self.assertEqual(mock.call_count,3)
            self.assertEqual([i['summary_kind'] for i in p['items']],['title_only','public_preview_draft','public_preview_draft'])

    def test_body_metadata_cannot_be_sent_as_public_preview(self):
        class BodyOnly(HTTP):
            def get(self, url):
                if url == CHANNEL + "/contents":
                    return super().get(url)
                return '<head><meta property="og:title" content="공개 제목"></head><body><head><meta property="og:description" content="본문에 삽입된 정보가 모델로 보내지면 안 됩니다."></body>'
        with patch('analysis.premium_insights.summarize') as mock:
            p = collect(BodyOnly(),dt.datetime.now(UTC),'fake-key')
            mock.assert_not_called()
            self.assertEqual(p['items'][0]['summary_kind'],'title_only')

    def test_legal_boilerplate_is_not_an_insight(self):
        with patch('analysis.premium_insights.summarize',return_value={'summary':'투자 관련 정보는 참고사항이며 모든 결정은 투자자 본인의 책임입니다.', 'evidence':'공개 미리보기에서 확인한'}):
            p = collect(HTTP(),dt.datetime.now(UTC),'fake-key')
            self.assertEqual(p['ai_status'],'no_drafts')
            self.assertEqual(p['items'][0]['summary_kind'],'title_only')
            self.assertEqual(p['items'][0]['summary'],'')
