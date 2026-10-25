"""Import Instinct JSON reports into existing owner-only report storage.

No private report or image is written to the checkout or logs. Uses the existing
server-side Supabase management credential, never the browser's bearer or anon key.
"""
from __future__ import annotations
import hashlib
import json
import os
import re
import uuid
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from analysis.sync_instinct_news import FOLDER_ID, get_token, utc, url_ok
from analysis.drive_pdf_reports import upsert_sql
from analysis.instinct_images import ImageCollector

PROJECT = 'mhbcchegrbakearqptdr'
MAX_FILE = 2_000_000
NAME = re.compile(r'^Folio-Report-\d{4}-\d{2}-\d{2}(?:-[A-Za-z0-9_-]{1,60})?\.json$')


def text(value, lo=1, hi=1000):
    if not isinstance(value, str) or not lo <= len(value.strip()) <= hi:
        raise ValueError('Invalid report text')
    return value.strip()


def source_links(raw):
    if not isinstance(raw, list) or len(raw) > 100:
        raise ValueError('Invalid report sources')
    links = []
    for value in raw:
        link = value.get('url') if isinstance(value, dict) else None
        # Citations are displayed, never fetched. Preserve original public HTTP links;
        # image requests and public-news URLs retain their separate HTTPS-only gates.
        checked = 'https://' + link[7:] if isinstance(link, str) and link.startswith('http://') else link
        if not url_ok(checked):
            raise ValueError('Invalid report source URL')
        links.append({'label': text(value.get('label'), hi=500), 'url': value['url']})
    return links



def adapt_report(raw):
    """Accept the established Instinct facts/outlook export without editing the source.

    Missing discriminators are accepted only for this specific legacy shape. Explicit
    unknown versions/types are never reinterpreted. Facts and forecasts stay separate.
    """
    if not isinstance(raw, dict):
        raise ValueError('Expected version 1 report')
    if ('version' in raw and raw['version'] != 1) or ('type' in raw and raw['type'] != 'report'):
        raise ValueError('Expected version 1 report')
    legacy = isinstance(raw.get('summaries'), dict) and isinstance(raw.get('sections'), list) and bool(raw['sections']) and all(
        isinstance(section, dict) and ('facts' in section or 'outlook' in section) for section in raw['sections'])
    if not legacy and (raw.get('version') != 1 or raw.get('type') != 'report'):
        raise ValueError('Expected version 1 report')
    result = {**raw, 'version': 1, 'type': 'report'}
    if 'summary' not in raw and legacy:
        summaries = raw['summaries']
        if set(summaries) - {'market', 'industry', 'stocks'}:
            raise ValueError('Unsupported summary categories')
        result['summary'] = ['[' + label + '] ' + text(summaries[key], hi=595)
            for key, label in (('market', '시장'), ('industry', '산업'), ('stocks', '종목'))
            if key in summaries and summaries[key] != '']
    sections = raw.get('sections')
    if not isinstance(sections, list) or len(sections) > 60:
        raise ValueError('Expected bounded report sections')
    converted = []
    for section in sections:
        if not isinstance(section, dict):
            raise ValueError('Invalid section')
        item = dict(section)
        if 'body' not in item and ('facts' in item or 'outlook' in item):
            blocks = []
            for key, label in (('facts', '확인된 사실'), ('outlook', '전망 · 미확정')):
                values = item.get(key, [])
                if not isinstance(values, list) or len(values) > 100:
                    raise ValueError('Invalid fact/outlook list')
                lines = [text(value, hi=5000) for value in values]
                if lines:
                    blocks.append(label + '\n' + '\n'.join('• ' + line for line in lines))
            item['body'] = '\n\n'.join(blocks)
        converted.append(item)
    if legacy and converted and raw.get('disclaimer'):
        disclaimer = text(raw['disclaimer'], hi=2000)
        converted[0]['body'] = text(converted[0].get('body'), hi=50000) + '\n\n자료 유의사항\n' + disclaimer
    result['sections'] = converted
    return result


def validation_code(error):
    """Public CI diagnostics contain field categories, never report content or URLs."""
    if isinstance(error, json.JSONDecodeError):
        return 'json_syntax'
    if isinstance(error, KeyError):
        return 'missing_required_field'
    return {
        'Expected version 1 report': 'report_version_or_type',
        'Unsupported summary categories': 'summary_categories',
        'Expected 1-5 factual summary items': 'summary_count',
        'Invalid report text': 'text_type_or_length',
        'Expected bounded report sections': 'sections_count',
        'Invalid section': 'section_shape',
        'Invalid fact/outlook list': 'fact_outlook_shape',
        'Invalid report source URL': 'source_url',
        'Invalid report sources': 'sources_shape',
        'Invalid related instrument': 'ticker_identity',
        'Invalid related instruments': 'tickers_shape',
        'Inconsistent report timestamps': 'timestamp_order',
        'Future report timestamp': 'timestamp_future',
        'Timestamp requires UTC offset': 'timestamp_timezone',
        'Invalid report identity': 'report_id',
        'Invalid image list': 'images_shape',
        'Invalid tables': 'tables_shape',
        'Invalid table': 'table_shape',
        'Table exceeds budget': 'table_budget',
        'Table shape mismatch': 'table_columns',
        'Report exceeds text budget': 'text_budget',
        'Report exceeds payload budget': 'payload_budget',
    }.get(str(error), 'invalid_structure')


def normalize(raw, *, file_id, modified_at, images):
    source = raw
    raw = adapt_report(raw)
    if not re.fullmatch(r'[A-Za-z0-9_-]{10,100}', file_id):
        raise ValueError('Invalid Drive identity')
    if not isinstance(raw, dict) or raw.get('version') != 1 or raw.get('type') != 'report':
        raise ValueError('Expected version 1 report')
    images.pending = False
    images.used_bytes = 0
    report_id = text(raw.get('id'), hi=100)
    if not re.fullmatch(r'[A-Za-z0-9_-]+', report_id):
        raise ValueError('Invalid report identity')
    title = text(raw.get('title'), hi=250)
    published, updated, modified = utc(raw['published_at']), utc(raw['updated_at']), utc(modified_at)
    if published > updated or (updated - modified).total_seconds() > 300:
        raise ValueError('Inconsistent report timestamps')
    if updated > datetime.now(timezone.utc) and (updated - datetime.now(timezone.utc)).total_seconds() > 3600:
        raise ValueError('Future report timestamp')
    summary = raw.get('summary')
    if not isinstance(summary, list) or not 1 <= len(summary) <= 5:
        raise ValueError('Expected 1-5 factual summary items')
    summary = [text(s, hi=600) for s in summary]
    sections = raw.get('sections')
    if not isinstance(sections, list) or not 1 <= len(sections) <= 60:
        raise ValueError('Expected bounded report sections')
    links, pages, total = source_links(raw.get('sources', [])), [], 0
    tickers = raw.get('tickers', [])
    if not isinstance(tickers, list) or len(tickers) > 30:
        raise ValueError('Invalid related instruments')
    for item in tickers:
        if not isinstance(item, dict) or item.get('market') not in ('US', 'KR') or not re.fullmatch(r'\d{6}' if item['market'] == 'KR' else r'[A-Z][A-Z0-9.-]{0,11}', str(item.get('ticker', ''))):
            raise ValueError('Invalid related instrument')
    image_count = 0
    for i, section in enumerate(sections, 1):
        if not isinstance(section, dict):
            raise ValueError('Invalid section')
        heading, body = text(section.get('heading'), hi=250), text(section.get('body'), hi=50000)
        total += len(body)
        tables = section.get('tables', [])
        if not isinstance(tables, list) or len(tables) > 5:
            raise ValueError('Invalid tables')
        clean_tables = []
        for table in tables:
            if not isinstance(table, dict):
                raise ValueError('Invalid table')
            columns, rows = table.get('columns'), table.get('rows')
            if not isinstance(columns, list) or not 1 <= len(columns) <= 12 or not isinstance(rows, list) or len(rows) > 100:
                raise ValueError('Table exceeds budget')
            columns = [text(c, hi=200) for c in columns]
            if any(not isinstance(r, list) or len(r) != len(columns) for r in rows):
                raise ValueError('Table shape mismatch')
            rows = [[text(c, lo=0, hi=500) for c in r] for r in rows]
            clean_tables.append({'caption': text(table.get('caption'), hi=300), 'columns': columns, 'rows': rows})
        candidates = section.get('images', [])
        if not isinstance(candidates, list):
            raise ValueError('Invalid image list')
        collected = images.collect(candidates[:max(0, min(3, 60 - image_count))])
        image_count += len(collected)
        pages.append({'number': i, 'heading': heading, 'text': body, 'images': [v['url'] for v in collected],
                      'image_meta': [{k: v for k, v in image.items() if k != 'url'} | {'image_index': j} for j, image in enumerate(collected)], 'tables': clean_tables})
    if total > 500000:
        raise ValueError('Report exceeds text budget')
    request_keys = {images.key(v) for section in sections for v in section.get('images', [])[:3] if isinstance(v, dict)}
    pages[0].update(pending_images=images.pending, image_rejections=sorted(images.rejected & request_keys), format='instinct-json-v1', report_id=report_id, published_at=raw['published_at'],
                    updated_at=raw['updated_at'], tickers=tickers,
                    original_url=f'https://drive.google.com/file/d/{file_id}/view')
    payload = dict(drive_file_id=file_id, folder_id=FOLDER_ID, title=title,
                   source_url=f'https://drive.google.com/file/d/{file_id}/view', source_modified_at=modified_at,
                   content_hash=hashlib.sha256(json.dumps(source, ensure_ascii=False, sort_keys=True).encode()).hexdigest(),
                   summary=summary, pages=pages, links=links)
    if len(json.dumps(payload, ensure_ascii=False).encode()) > 12_000_000:
        raise ValueError('Report exceeds payload budget')
    return payload


def drive(url, token, *, media=False):
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = response.read(MAX_FILE + 1)
    if len(data) > MAX_FILE:
        raise ValueError('Drive JSON exceeds budget')
    return data if media else json.loads(data)


def query(sql):
    token = os.environ.get('SUPABASE_ACCESS_TOKEN')
    if not token:
        raise RuntimeError('Private report sync requires SUPABASE_ACCESS_TOKEN')
    req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{PROJECT}/database/query',
        data=json.dumps({'query': sql}).encode(), headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.load(response)


def owner_id(rows, configured=''):
    if configured:
        candidate = str(uuid.UUID(configured))
        if candidate not in [r['user_id'] for r in rows]:
            raise ValueError('Configured owner has no existing registered-folder report')
        return candidate
    owners = {str(uuid.UUID(r['user_id'])) for r in rows}
    if len(owners) != 1:
        raise ValueError('Set FOLIO_REPORT_USER_ID to an existing folder owner; never infer from auth.users')
    return owners.pop()



def stored_utc(value):
    """Management SQL serializes timestamptz as `YYYY-MM-DD HH:MM:SS+00`.

    Keep export/Drive timestamp validation strict; only database values use this parser.
    """
    if not isinstance(value, str):
        raise ValueError('Invalid stored report timestamp')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError('Invalid stored report timestamp')
    return parsed.astimezone(timezone.utc)


def main():
    token = get_token()
    files, cursor = [], None
    for _ in range(5):
        params = {'q': f"'{FOLDER_ID}' in parents and trashed = false and name contains 'Folio-Report-'",
                  'fields': 'nextPageToken,files(id,name,mimeType,size,modifiedTime)', 'pageSize': '100'}
        if cursor:
            params['pageToken'] = cursor
        result = drive('https://www.googleapis.com/drive/v3/files?' + urllib.parse.urlencode(params), token)
        files.extend(f for f in result.get('files', []) if NAME.fullmatch(f.get('name', '')) and f.get('mimeType') == 'application/json' and int(f.get('size', MAX_FILE + 1)) <= MAX_FILE)
        cursor = result.get('nextPageToken')
        if not cursor:
            break
    else:
        raise ValueError('Report folder exceeds listing budget')
    if not files:
        print('No Instinct report JSON files; existing private reports retained')
        return
    if len(files) > 100:
        raise ValueError('Report sync exceeds 100-file budget')
    # Only the existing registered-folder owner can receive this folder's reports.
    owners = query(f"select distinct user_id::text from public.private_source_reports where folder_id='{FOLDER_ID}'")
    owner = owner_id(owners, os.environ.get('FOLIO_REPORT_USER_ID', ''))
    headers = query(f"select drive_file_id,source_modified_at,pages->0->>'report_id' as report_id,pages->0->>'pending_images' as pending_images from public.private_source_reports where user_id='{owner}' and folder_id='{FOLDER_ID}'")
    by_file = {r['drive_file_id']: r for r in headers}
    by_id = {r['report_id']: r for r in headers if r.get('report_id')}
    imported, unchanged, skipped = 0, 0, 0
    images = ImageCollector(max_fetches=8)
    for index, file in enumerate(sorted(files, key=lambda f: utc(f['modifiedTime']), reverse=True), 1):
        fid = file['id']
        if not re.fullmatch(r'[A-Za-z0-9_-]{10,100}', fid):
            skipped += 1
            continue
        old = by_file.get(fid)
        if old and utc(file['modifiedTime']) <= stored_utc(old['source_modified_at']) and old.get('pending_images') != 'true':
            unchanged += 1
            continue
        try:
            raw = json.loads(drive(f'https://www.googleapis.com/drive/v3/files/{fid}?alt=media', token, media=True))
            # Retain the first real Drive identity for a stable Instinct report id.
            previous = by_id.get(raw.get('id')) if isinstance(raw, dict) else None
            storage_id = previous['drive_file_id'] if previous else fid
            if previous and (utc(file['modifiedTime']) < stored_utc(previous['source_modified_at']) or (utc(file['modifiedTime']) == stored_utc(previous['source_modified_at']) and previous.get('pending_images') != 'true')):
                unchanged += 1
                continue
            cached = query(f"select pages from public.private_source_reports where user_id='{owner}' and drive_file_id='{storage_id}'")
            images.cache.update({m.get('request_hash') or images.key(m): {**m, 'url': p['images'][m['image_index']]} for r in cached for p in r['pages'] for m in p.get('image_meta', [])})
            images.rejected.update(k for r in cached for k in r['pages'][0].get('image_rejections', []))
            payload = normalize(raw, file_id=fid, modified_at=file['modifiedTime'], images=images)
            payload['drive_file_id'] = storage_id
            payload['source_url'] = f'https://drive.google.com/file/d/{storage_id}/view'
            query(upsert_sql(payload, owner))
            snapshot = {'drive_file_id': storage_id, 'source_modified_at': file['modifiedTime'], 'report_id': raw['id'], 'pending_images': str(payload['pages'][0]['pending_images']).lower()}
            by_id[raw['id']] = snapshot
            by_file[fid] = snapshot
            imported += 1
        except (ValueError, KeyError, TypeError) as error:
            skipped += 1
            print(f'Private report index={index} rejected: {validation_code(error)}')
    print(f'Private reports imported={imported} unchanged={unchanged} invalid={skipped}; no private payload published')
    if skipped:
        raise ValueError('Invalid report JSON detected; check the documented schema')


if __name__ == '__main__':
    main()
