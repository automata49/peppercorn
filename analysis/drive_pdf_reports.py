"""Extract private Drive PDFs locally. Never write report contents into the public repo.

The caller supplies authenticated Drive metadata and downloads the original file.
Generated JSON/SQL belong in private scratch, not dist/ or a git commit.
"""
import argparse
import base64
import hashlib
import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

FOLDER_ID = '1HdM3uXO3_cAnJS0igLlDIsCylch6KMey'


def extract(pdf, *, file_id, title, modified_at, summary=None):
    import fitz
    if not re.fullmatch(r'[A-Za-z0-9_-]{10,100}', file_id):
        raise ValueError('Invalid Drive id')
    if not title or len(title) > 250:
        raise ValueError('Invalid title')
    parsed = datetime.fromisoformat(modified_at.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Modification time must include timezone')
    raw = Path(pdf).read_bytes()
    if not raw.startswith(b'%PDF-') or len(raw) > 20_000_000:
        raise ValueError('Expected a PDF no larger than 20 MB')
    pages, links, seen, count = [], [], set(), 0
    with fitz.open(stream=raw, filetype='pdf') as doc:
        if doc.needs_pass or not 1 <= len(doc) <= 60:
            raise ValueError('Encrypted or oversized document')
        for number, page in enumerate(doc, 1):
            text = page.get_text(sort=True).strip()
            images = []
            # Render vector charts too, splitting exceptionally tall web-export PDFs.
            # A hard slice budget prevents huge raster allocations from malicious PDFs.
            for top in range(0, int(page.rect.height) + 1, 1000):
                bottom = min(top + 1000, page.rect.height)
                if bottom <= top:
                    continue
                count += 1
                if count > 60 or not 50 <= page.rect.width <= 5000:
                    raise ValueError('Rendering budget exceeded')
                scale = min(1.5, 900 / page.rect.width)
                clip = fitz.Rect(0, top, page.rect.width, bottom)
                pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip, alpha=False)
                img = pix.pil_tobytes(format='WEBP', quality=85)
                images.append('data:image/webp;base64,' + base64.b64encode(img).decode('ascii'))
            pages.append({'number': number, 'text': text, 'images': images})
            for link in page.get_links():
                url = link.get('uri', '')
                try:
                    parsed_url = urlsplit(url)
                    allowed = parsed_url.scheme in ('https', 'http') and parsed_url.hostname and not parsed_url.username and not parsed_url.password
                except ValueError:
                    allowed = False
                if allowed and url not in seen:
                    seen.add(url)
                    label = page.get_textbox(link['from']).strip()[:500]
                    links.append({'label': label, 'url': url})
    text = '\n\n'.join(p['text'] for p in pages)
    if len(text) < 50:
        raise ValueError('Scanned PDF: OCR required before publishing a text summary')
    if len(text) > 500_000 or len(links) > 500:
        raise ValueError('Document exceeds text/link budget')
    if summary is None:
        # Cheap extractive fallback. No invented facts, recommendations or live model call.
        paragraphs = [re.sub(r'\s+', ' ', p).strip() for p in re.split(r'\n\s*\n', text)]
        summary = [p for p in paragraphs if 40 <= len(p) <= 580][:3]
        if not summary:
            summary = [re.sub(r'\s+', ' ', text[:500])]
    if not isinstance(summary, list) or not 1 <= len(summary) <= 5 or any(not isinstance(s, str) or not s.strip() or len(s) > 600 for s in summary):
        raise ValueError('Summary must contain 1–5 bounded source-grounded strings')
    payload = dict(drive_file_id=file_id, folder_id=FOLDER_ID, title=title,
                   source_url=f'https://drive.google.com/file/d/{file_id}/view',
                   source_modified_at=modified_at, content_hash=hashlib.sha256(raw).hexdigest(),
                   summary=summary, pages=pages, links=links)
    if len(json.dumps(payload, ensure_ascii=False).encode()) > 12_000_000:
        raise ValueError('Report exceeds payload budget')
    return payload


def upsert_sql(payload, user_id):
    user_id = str(uuid.UUID(user_id))
    if payload.get('folder_id') != FOLDER_ID:
        raise ValueError('Unregistered folder')
    literal = json.dumps({**payload, 'user_id': user_id}, ensure_ascii=False).replace("'", "''")
    return """insert into public.private_source_reports as previous
(user_id,drive_file_id,folder_id,title,source_url,source_modified_at,content_hash,summary,pages,links)
select user_id,drive_file_id,folder_id,title,source_url,source_modified_at,content_hash,summary,pages,links
from jsonb_to_record('""" + literal + """'::jsonb) as r(user_id uuid,drive_file_id text,folder_id text,title text,source_url text,source_modified_at timestamptz,content_hash text,summary jsonb,pages jsonb,links jsonb)
on conflict (user_id,drive_file_id) do update set title=excluded.title,source_url=excluded.source_url,
source_modified_at=excluded.source_modified_at,content_hash=excluded.content_hash,summary=excluded.summary,
pages=excluded.pages,links=excluded.links,imported_at=now()
where excluded.source_modified_at >= previous.source_modified_at and (excluded.content_hash <> previous.content_hash or excluded.title <> previous.title or excluded.source_modified_at <> previous.source_modified_at or excluded.summary is distinct from previous.summary or excluded.pages is distinct from previous.pages or excluded.links is distinct from previous.links)
returning drive_file_id,source_modified_at,content_hash;
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ('pdf', 'file-id', 'title', 'modified-at', 'output'):
        parser.add_argument('--' + arg, required=True)
    parser.add_argument('--summary-file')
    parser.add_argument('--user-id')
    parser.add_argument('--sql-output')
    args = parser.parse_args()
    summary = json.loads(Path(args.summary_file).read_text()) if args.summary_file else None
    payload = extract(args.pdf, file_id=args.file_id, title=args.title, modified_at=args.modified_at, summary=summary)
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False))
    if args.sql_output:
        if not args.user_id:
            parser.error('--sql-output requires --user-id')
        Path(args.sql_output).write_text(upsert_sql(payload, args.user_id))
    print(json.dumps({'pages': len(payload['pages']), 'links': len(payload['links']), 'content_hash': payload['content_hash']}))


if __name__ == '__main__':
    main()
