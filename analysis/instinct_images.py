"""Bounded, credential-free image ingestion. Never fetch arbitrary HTML or trust rights claims.

Commons rights are checked against its API. Other publishers require an operator-reviewed
policy in analysis/instinct-image-policies.json. Unknown rights retain the fallback.
"""
from __future__ import annotations
import base64
import hashlib
import http.client
import io
import ipaddress
import json
import re
import socket
import ssl
import time
import warnings
from pathlib import Path
from urllib.parse import urlsplit, urljoin, urlencode, unquote

MAX_BYTES = 5_000_000
POLICY = Path('analysis/instinct-image-policies.json')
RIGHTS = {'CC0', 'Public domain', 'CC BY 4.0', 'CC BY-SA 4.0', 'CC BY 3.0', 'CC BY-SA 3.0', 'CC BY 2.0', 'CC BY-SA 2.0', 'CC BY 2.5', 'CC BY-SA 2.5'}


def public_url(value):
    if not isinstance(value, str) or len(value) > 2048 or any(ord(c) < 33 for c in value):
        raise ValueError('Invalid image URL')
    p = urlsplit(value)
    if p.scheme != 'https' or not p.hostname or p.username or p.password or p.port not in (None, 443):
        raise ValueError('Expected public HTTPS URL')
    host = p.hostname.lower()
    if '.' not in host or host.endswith(('.local', '.internal', '.localhost')):
        raise ValueError('Non-public host')
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return p
    raise ValueError('Literal address forbidden')


def read_public(url, *, image=False):
    """Resolve and pin public IP for each redirect; TLS verifies the original hostname.

    No OAuth, cookies, proxy credentials or ambient authorization are sent to publishers.
    """
    deadline = time.monotonic() + 20
    for _ in range(4):
        p = public_url(url)
        addresses = socket.getaddrinfo(p.hostname, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise ValueError('Non-public destination')
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Image fetch budget')
        connection = http.client.HTTPSConnection(p.hostname, timeout=min(8, remaining))
        # Pin the socket; HTTPSConnection must not resolve the hostname a second time.
        raw = socket.create_connection((addresses[0][4][0], 443), timeout=min(8, remaining))
        try:
            connection.sock = ssl.create_default_context().wrap_socket(raw, server_hostname=p.hostname)
            connection.request('GET', (p.path or '/') + ('?' + p.query if p.query else ''), headers={
                'User-Agent': 'FolioResearch/1.0 (+https://github.com/automata49/peppercorn)',
                'Accept': 'image/png,image/jpeg,image/webp' if image else 'application/json',
                'Accept-Encoding': 'identity'})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                url = urljoin(url, response.getheader('Location', ''))
                continue
            if response.status != 200:
                raise ValueError('Image source unavailable')
            mime = response.getheader('Content-Type', '').split(';')[0].lower()
            allowed = {'image/jpeg', 'image/png', 'image/webp'} if image else {'application/json'}
            if mime not in allowed or int(response.getheader('Content-Length', '0')) > MAX_BYTES:
                raise ValueError('Image type/size rejected')
            body = bytearray()
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError('Image read budget')
                part = response.read1(min(65536, MAX_BYTES + 1 - len(body)))
                if not part:
                    break
                body.extend(part)
                if len(body) > MAX_BYTES:
                    raise ValueError('Image exceeds budget')
            return bytes(body)
        finally:
            connection.close()
            raw.close()
    raise ValueError('Redirect limit')


def metadata(raw, read=read_public):
    if not isinstance(raw, dict) or raw.get('kind') not in ('photo', 'chart', 'illustration'):
        raise ValueError('Invalid image metadata')
    for key, limit in (('caption', 500), ('credit', 200), ('usage_rights', 100)):
        if not isinstance(raw.get(key), str) or not 1 <= len(raw[key].strip()) <= limit:
            raise ValueError('Missing image provenance')
    public_url(raw.get('image_url'))
    source = public_url(raw.get('source_url'))
    credit, license_name, license_url = raw['credit'], raw['usage_rights'], raw.get('license_url', '')
    if source.hostname == 'commons.wikimedia.org' and source.path.startswith('/wiki/File:'):
        title = unquote(source.path[len('/wiki/'):])
        endpoint = 'https://commons.wikimedia.org/w/api.php?' + urlencode({
            'action': 'query', 'format': 'json', 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'titles': title})
        pages = json.loads(read(endpoint)).get('query', {}).get('pages', {})
        info = next(iter(pages.values())).get('imageinfo', [{}])[0] if pages else {}
        ext = info.get('extmetadata', {})
        license_name = ext.get('LicenseShortName', {}).get('value')
        license_url = ext.get('LicenseUrl', {}).get('value', '')
        if license_name not in RIGHTS or raw['image_url'] != info.get('url'):
            raise ValueError('Image or license does not match Commons')
        # Strip provider markup; React also escapes this plain text when rendered.
        credit = re.sub('<[^>]+>', '', ext.get('Artist', {}).get('value', '')).strip()[:200]
        if not license_url and license_name in ('CC0', 'Public domain'):
            license_url = 'https://creativecommons.org/publicdomain/zero/1.0/' if license_name == 'CC0' else 'https://commons.wikimedia.org/wiki/Commons:Public_domain'
        if license_url.startswith('http://creativecommons.org/'):
            license_url = 'https://' + license_url[7:]
        if public_url(license_url).hostname not in ('creativecommons.org', 'commons.wikimedia.org'):
            raise ValueError('Invalid license evidence')
    else:
        policies = json.loads(POLICY.read_text()) if POLICY.exists() else []
        origin = 'https://' + source.hostname
        image_host = public_url(raw['image_url']).hostname
        match = next((p for p in policies if p['source_origin'] == origin and image_host in p['image_hosts']
                      and p['usage_rights'] == license_name and p['license_url'] == license_url), None)
        if not match:
            raise ValueError('Publisher permission has not been reviewed')
        public_url(license_url)
        credit = match['credit']
    if not credit:
        raise ValueError('Missing verified credit')
    return {k: raw[k] for k in ('image_url', 'source_url', 'caption', 'kind')} | {
        'credit': credit, 'usage_rights': license_name, 'license_url': license_url}


def optimize(blob):
    from PIL import Image, ImageOps
    Image.MAX_IMAGE_PIXELS = 20_000_000
    with warnings.catch_warnings():
        warnings.simplefilter('error', Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(blob)) as image:
            if image.format not in ('PNG', 'JPEG', 'WEBP') or image.width * image.height > 20_000_000 or getattr(image, 'n_frames', 1) != 1:
                raise ValueError('Unsupported image')
            image.load()
            image = ImageOps.exif_transpose(image).convert('RGB')
            image.thumbnail((1600, 2400))
            output = io.BytesIO()
            image.save(output, 'WEBP', quality=85)
            if output.tell() > 1_000_000:
                raise ValueError('Optimized image exceeds budget')
            return output.getvalue()


class ImageCollector:
    def __init__(self, *, assets=None, cached=(), max_fetches=12, read=read_public):
        self.assets = assets
        self.cache = {x.get('request_hash') or self.key(x): x for x in cached if isinstance(x, dict) and x.get('url')}
        self.remaining = max_fetches
        self.pending = False
        self.rejected = set()
        self.used_bytes = 0
        self.read = read

    @staticmethod
    def key(raw):
        return hashlib.sha256(json.dumps([raw.get(k) for k in ('image_url', 'source_url', 'caption', 'credit', 'usage_rights', 'license_url', 'kind')], ensure_ascii=False).encode()).hexdigest()

    def collect(self, values):
        result = []
        for raw in values[:3] if isinstance(values, list) else []:
            try:
                if not isinstance(raw, dict):
                    continue
                key = self.key(raw)
                if key in self.rejected:
                    continue
                cached = self.cache.get(key)
                # Public cache must still have its actual local asset.
                if cached and (self.assets is None or (self.assets / Path(cached['url']).name).is_file()):
                    cost = len(cached['url']) * 3 // 4 if self.assets is None else 0
                    if self.used_bytes + cost <= 5_000_000:
                        self.used_bytes += cost
                        result.append(cached)
                    continue
                # Unreviewed publisher rights are a cheap permanent rejection,
                # and must not starve later licensed images of the network budget.
                source = public_url(raw.get('source_url'))
                meta = None if source.hostname == 'commons.wikimedia.org' else metadata(raw, self.read)
                if self.remaining <= 0:
                    self.pending = True
                    continue
                self.remaining -= 1
                meta = meta or metadata(raw, self.read)
                try:
                    data = optimize(self.read(meta['image_url'], image=True))
                except Exception as error:
                    if type(error).__name__ in ('DecompressionBombError', 'DecompressionBombWarning'):
                        raise ValueError('Image decompression budget') from None
                    raise
                if self.assets is None and self.used_bytes + len(data) > 5_000_000:
                    self.rejected.add(key)
                    continue
                self.used_bytes += len(data) if self.assets is None else 0
                name = 'external-' + hashlib.sha256(data).hexdigest() + '.webp'
                if self.assets is not None:
                    self.assets.mkdir(parents=True, exist_ok=True)
                    (self.assets / name).write_bytes(data)
                    url = 'data/news-assets/' + name
                else:
                    url = 'data:image/webp;base64,' + base64.b64encode(data).decode()
                value = {**meta, 'url': url, 'request_hash': key}
                # Key the cache on submitted metadata; the output uses verified metadata.
                self.cache[key] = value
                result.append(value)
            except (OSError, http.client.HTTPException):
                self.pending = True
            except (ValueError, KeyError, TypeError, StopIteration, IndexError) as error:
                if str(error) == 'Image source unavailable':
                    self.pending = True
                elif isinstance(raw, dict):
                    self.rejected.add(self.key(raw))
                # No source URLs, raw body, credentials or private titles in CI logs.
                continue
        return result
