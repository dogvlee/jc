#!/usr/bin/env python3
from __future__ import annotations
import json, os, sys, time, urllib.request
BASE = 'https://print.niimbot.com/api'
HEADERS = {
    'User-Agent': 'niimbot/6.6.6 Android',
    'niimbot-user-agent': 'AppVersionName/6.6.6',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'lang': 'zh-cn',
}
TIMEOUT = 20
SLEEP = 0.15
PAGE_SIZE = 30
MAX_PER_SIZE = 25
HARD_CAP = 250
TARGET = 180
# Prefer sizes that return useful stock; still request listed sizes
SIZES = [(40,30),(50,30),(40,20),(50,20),(30,20),(40,60),(50,80),(60,40),(50,15),(15,30),(50,40),(70,40),(94,40)]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'research', 'online-templates')
RAW_DIR = os.path.join(OUT_DIR, 'raw')

def request_json(method, path, body=None):
    url = BASE + path
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read().decode('utf-8'))

def fetch_page(width, height, page):
    return request_json('POST', '/industryTemplate/page', {'page': page, 'pageSize': PAGE_SIZE, 'width': width, 'height': height})

def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    index, seen_ids, per_size, errors = [], set(), {}, []
    for width, height in SIZES:
        size_key = f'{width}x{height}'
        if len(index) >= HARD_CAP:
            break
        size_count, page, empty_streak = 0, 1, 0
        # API returns ~10/page; paginate deep enough for MAX_PER_SIZE uniques
        while size_count < MAX_PER_SIZE and len(index) < HARD_CAP and page <= 40:
            try:
                payload = fetch_page(width, height, page)
            except Exception as exc:
                errors.append({'sizeKey': size_key, 'page': page, 'error': str(exc)})
                print(f'  FAIL {size_key} p{page}: {exc}', file=sys.stderr)
                break
            data = (payload or {}).get('data') or {}
            items = data.get('list') or []
            total = data.get('total')
            if not items:
                break
            added = 0
            for item in items:
                tid = item.get('id')
                if tid is None: continue
                sid = str(tid)
                if sid in seen_ids: continue
                if size_count >= MAX_PER_SIZE or len(index) >= HARD_CAP: break
                w = int(item.get('width') or width)
                h = int(item.get('height') or height)
                item['width'] = w
                item['height'] = h
                with open(os.path.join(RAW_DIR, f'{sid}.json'), 'w', encoding='utf-8') as f:
                    json.dump(item, f, ensure_ascii=False, separators=(',', ':'))
                seen_ids.add(sid); size_count += 1; added += 1
                index.append({
                    'id': sid,
                    'name': item.get('name') or f'tpl{sid}',
                    'width': w,
                    'height': h,
                    'thumbnail': item.get('thumbnail') or item.get('previewImage') or '',
                    'sizeKey': f'{w}x{h}',
                    'requestSizeKey': size_key,
                    'source': 'online',
                })
            print(f'  {size_key} page {page}: +{added} (size={size_count}, total_pack={len(index)}, api_total={total}, batch={len(items)})')
            if added == 0:
                empty_streak += 1
            else:
                empty_streak = 0
            if empty_streak >= 3:
                break
            if size_count >= MAX_PER_SIZE:
                break
            page += 1
            time.sleep(SLEEP)
        per_size[size_key] = size_count
        time.sleep(SLEEP)
        if len(index) >= TARGET and len([k for k,v in per_size.items() if v>0]) >= 8:
            # still continue remaining sizes briefly for diversity
            pass
    report = {
        'fetched': len(index),
        'target': TARGET,
        'hardCap': HARD_CAP,
        'maxPerSize': MAX_PER_SIZE,
        'pageSize': PAGE_SIZE,
        'perSize': per_size,
        'errors': errors,
        'sizesRequested': [f'{w}x{h}' for w,h in SIZES],
        'actualSizeHist': {},
    }
    for row in index:
        k = row['sizeKey']
        report['actualSizeHist'][k] = report['actualSizeHist'].get(k, 0) + 1
    with open(os.path.join(OUT_DIR, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    with open(os.path.join(OUT_DIR, 'fetch-report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f'Wrote {len(index)} templates -> {OUT_DIR}')
    return 0 if index else 1

if __name__ == '__main__':
    raise SystemExit(main())
