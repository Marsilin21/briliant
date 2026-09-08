"""Read the supplied Tilda export and optionally inspect its public URLs."""
from pathlib import Path
from html.parser import HTMLParser
import json, re, urllib.request, urllib.error, concurrent.futures

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '_redesign'

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta = {}; self.links = []; self.images = []; self.headings = []
        self.text = []; self.skip = 0; self.capture = None; self.title = ''; self.schema = 0
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style'):
            self.skip += 1
            if a.get('type') == 'application/ld+json': self.schema += 1
        if tag == 'meta': self.meta[a.get('name', a.get('property', ''))] = a.get('content', '')
        if tag == 'link' and a.get('rel') == 'canonical': self.meta['canonical'] = a.get('href')
        if tag == 'a' and a.get('href'): self.links.append(a['href'])
        if tag == 'img': self.images.append({'src': a.get('data-original', a.get('src')), 'alt': a.get('alt', '')})
        if tag == 'title' or re.fullmatch('h[1-6]', tag): self.capture = [tag, '']
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.skip = max(0, self.skip - 1)
        if self.capture and tag == self.capture[0]:
            t = ' '.join(self.capture[1].split())
            if tag == 'title': self.title = t
            else: self.headings.append({'tag': tag, 'text': t})
            self.capture = None
    def handle_data(self, data):
        if self.skip: return
        if self.capture: self.capture[1] += data + ' '
        t = ' '.join(data.split())
        if t: self.text.append(t)

def extract(file):
    p = Page(); p.feed(file.read_text(encoding='utf-8'))
    return {'file': file.name, 'bytes': file.stat().st_size, 'title': p.title, 'meta': p.meta,
            'headings': p.headings, 'schema_blocks': p.schema, 'images': p.images,
            'links': list(dict.fromkeys(p.links)), 'text': p.text}

def fetch(path):
    url = 'https://brilliant-monolit.ru' + path
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (site audit)'})
        with urllib.request.urlopen(req, timeout=18) as r:
            body = r.read().decode('utf-8', errors='replace')
            result = {'url': url, 'status': r.status, 'final_url': r.url,
                      'content_type': r.headers.get('Content-Type'), 'body': body}
            if 'text/html' in result['content_type']:
                p = Page(); p.feed(body)
                result.update(title=p.title, meta=p.meta, headings=p.headings, schema_blocks=p.schema)
            return result
    except urllib.error.HTTPError as e: return {'url': url, 'status': e.code}
    except Exception as e: return {'url': url, 'error': str(e)}

if __name__ == '__main__':
    pages = [extract(p) for p in sorted(ROOT.glob('*.html'))]
    (OUT / 'export-audit.json').write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding='utf-8')
    for p in pages:
        (OUT / (p['file'] + '.txt')).write_text('\n'.join(p['text']), encoding='utf-8')
        print(json.dumps({k:p[k] for k in ('file','title','headings','schema_blocks')}, ensure_ascii=False))
    paths = ['/', '/design', '/contacts', '/kosmeticheskiy-remont', '/kap-remont', '/robots.txt', '/sitemap.xml', '/audit-missing-page-20260906']
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: live = list(pool.map(fetch, paths))
    (OUT / 'live-audit.json').write_text(json.dumps(live, ensure_ascii=False, indent=2), encoding='utf-8')
    for p in live: print(json.dumps({k:v for k,v in p.items() if k != 'body'}, ensure_ascii=False))
