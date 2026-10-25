import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from analysis.instinct_images import ImageCollector, metadata, read_public

IMAGE = {'image_url':'https://upload.wikimedia.org/wikipedia/commons/image.png',
         'source_url':'https://commons.wikimedia.org/wiki/File:Image.png',
         'caption':'검증된 자료 이미지', 'credit':'Submitted credit', 'usage_rights':'CC BY 4.0', 'kind':'chart'}


def reader(url, **kwargs):
    if kwargs.get('image'):
        from PIL import Image
        output = io.BytesIO()
        Image.new('RGB',(12,10),'white').save(output,'PNG')
        return output.getvalue()
    return json.dumps({'query':{'pages':{'1':{'imageinfo':[{'url':IMAGE['image_url'],'extmetadata':{
        'LicenseShortName':{'value':'CC BY 4.0'}, 'LicenseUrl':{'value':'https://creativecommons.org/licenses/by/4.0/'},
        'Artist':{'value':'<b>Verified creator</b>'}}}]}}}}).encode()


class ImageTests(unittest.TestCase):
    def test_commons_verification_and_webp(self):
        self.assertEqual(metadata(IMAGE,reader)['credit'],'Verified creator')
        with tempfile.TemporaryDirectory() as tmp:
            collector=ImageCollector(assets=Path(tmp),read=reader)
            first=collector.collect([IMAGE])[0]
            self.assertRegex(first['url'],r'external-[a-f0-9]{64}\.webp$')
            self.assertEqual(len(list(Path(tmp).iterdir())),1)
            cached=ImageCollector(assets=Path(tmp),cached=[first],read=lambda *a,**k:self.fail('cache refetched'))
            self.assertEqual(cached.collect([IMAGE]),[first])
    def test_private_image_is_not_public_asset(self):
        image=ImageCollector(read=reader).collect([IMAGE])[0]
        self.assertTrue(image['url'].startswith('data:image/webp;base64,'))
    def test_unreviewed_rights_never_download(self):
        self.assertEqual(ImageCollector(read=lambda *a,**k:self.fail('unreviewed fetch')).collect([
            {**IMAGE,'source_url':'https://publisher.example/article','usage_rights':'unknown'}]),[])
    def test_claimed_license_cannot_override_provider(self):
        def no_license(url,**kwargs):
            return json.dumps({'query':{'pages':{'1':{'imageinfo':[{'url':IMAGE['image_url'],'extmetadata':{'LicenseShortName':{'value':'All rights reserved'}}}]}}}}).encode()
        self.assertEqual(ImageCollector(read=no_license).collect([IMAGE]),[])
    def test_private_dns_mixed_answers_blocked_before_connect(self):
        answers=[(2,1,6,'',('8.8.8.8',443)),(2,1,6,'',('127.0.0.1',443))]
        with patch('analysis.instinct_images.socket.getaddrinfo',return_value=answers),patch('analysis.instinct_images.socket.create_connection') as connect:
            with self.assertRaises(ValueError):read_public('https://images.example/image.png',image=True)
            connect.assert_not_called()
    def test_malformed_and_decode_failure_fallback(self):
        c=ImageCollector(read=lambda url,**k:b'not an image' if k else reader(url))
        self.assertEqual(c.collect([None,'bad',IMAGE]),[])
    def test_budget_and_dedup(self):
        c=ImageCollector(read=reader,max_fetches=1)
        self.assertEqual(len(c.collect([IMAGE,IMAGE])),2)
        self.assertEqual(c.remaining,0)
