# compare_parts.py — 「每一個動作都拆開依據部位比較」: for every action cell of the V sheet, compare the sheet's drawing
# with what the game draws, PART BY PART (height bands of the figure: head / torso / hips+skirt / legs), for the
# previous 82-px flat-tone cells (ref/art/sprites-jk-82flat.js, shown ×2 as the game drew them) and the current raw
# 164-px cells (src/sprites-jk.js). Per part: mean colour error vs the sheet (L1 / 3, 0–255), number of distinct
# colours, and edge energy relative to the sheet (1.0 = as much detail). Output: ref/art/compare/V<i>.png (sheet |
# old | new | error maps) and ref/art/compare/report.json + report.md (averages per part).
import os, sys, json, base64
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import importlib.util
sys.argv = [sys.argv[0], 'raw']
spec = importlib.util.spec_from_file_location('r2', 'refine2.py'); r2 = importlib.util.module_from_spec(spec); spec.loader.exec_module(r2)
OUTD = os.path.join('art', 'compare'); os.makedirs(OUTD, exist_ok=True)
PARTS = [('head', 0.0, 0.24), ('torso', 0.24, 0.48), ('hips', 0.48, 0.62), ('legs', 0.62, 1.0)]

def load(path):
    src = open(path, encoding='utf-8').read(); h0 = 'root.SPRITES.jk = '; i = src.index(h0) + len(h0); j = src.rindex('; })')
    return json.loads(src[i:j])
def cell_image(c):
    w, h = c['w'], c['h']
    if c.get('enc') == 'prle':
        raw = base64.b64decode(c['f']); n = raw[0]; pal = [(raw[1 + k * 3], raw[2 + k * 3], raw[3 + k * 3], 255) for k in range(n)]
        px = []; p = 1 + n * 3
        while p + 1 < len(raw): run, idx = raw[p], raw[p + 1]; p += 2; px += [pal[idx - 1] if idx else (0, 0, 0, 0)] * run
        px = (px + [(0, 0, 0, 0)] * (w * h))[:w * h]
        im = Image.new('RGBA', (w, h)); im.putdata(px); return im
    return Image.frombytes('RGBA', (w, h), base64.b64decode(c['f']))

TAGS = [t for t in sys.argv[1:] if t in ('A', 'B', 'C', 'V')] or ['V', 'A', 'C']
newdata = load('../src/sprites-jk.js'); olddata = load(os.path.join('art', 'sprites-jk-82flat.js'))
sheets = {t: Image.open(r2.SHEETS[t]).convert('RGB') for t in TAGS}
def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
def edge_energy(im, box):
    px = im.load(); x0, y0, x1, y1 = box; e = 0
    for y in range(y0, y1 - 1):
        for x in range(x0, x1 - 1):
            a, b, c = px[x, y], px[x + 1, y], px[x, y + 1]
            if a[3] and b[3]: e += abs(lum(a) - lum(b))
            if a[3] and c[3]: e += abs(lum(a) - lum(c))
    return e
def stats(src, img, box):
    """mean L1/3 colour error over source-opaque pixels, colour count of img, edge energy ratio img/src"""
    sp, ip = src.load(), img.load(); x0, y0, x1, y1 = box; err = 0; n = 0; cols = set(); miss = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            a = sp[x, y]; b = ip[x, y]
            if b[3]: cols.add(b[:3])
            if not a[3]: continue
            n += 1
            if not b[3]: miss += 1; err += 96; continue
            err += sum(abs(a[k] - b[k]) for k in range(3)) / 3
    es = edge_energy(src, box); ei = edge_energy(img, box)
    return {'err': round(err / max(1, n), 1), 'colours': len(cols), 'edges': round(ei / es, 2) if es else None, 'missing': round(miss / max(1, n), 3)}

report = {}
todo = [(tag, idx) for tag in TAGS for idx in sorted(c['i'] for c in newdata[tag])]
for tag, idx in todo:
    new = {c['i']: c for c in newdata[tag]}; old = {c['i']: c for c in olddata.get(tag, [])}; sheet = sheets[tag]
    c = new[idx]; g = c['g41']; s = c.get('scale', 1.0)
    newim = cell_image(c); w, h = newim.size
    # the sheet's drawing on the same canvas: source pixel per cell pixel via the same mapping as the refinement
    srcim = Image.new('RGBA', (w, h), (0, 0, 0, 0)); sp = srcim.load(); np_ = newim.load()
    for y in range(h):
        for x in range(w):
            keep, nbg = r2.window(sheet, tag, g, x, y, s)
            if keep and np_[x, y][3]: p = keep[0][2]; sp[x, y] = (p[0], p[1], p[2], 255)
            elif keep and not np_[x, y][3] and nbg == 0: p = keep[0][2]; sp[x, y] = (p[0], p[1], p[2], 255)
    # the old 82-px flat cell, drawn ×2 (as the game showed it), anchored at the same feet point
    oc = old.get(idx); oldim = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    if oc:
        o = cell_image(oc).resize((oc['w'] * 2, oc['h'] * 2), Image.NEAREST)
        oldim.alpha_composite(o, (max(0, c['ax'] - oc['ax'] * 2 - 1), max(0, c['ay'] - oc['ay'] * 2 - 1)))
    # figure extent from the source
    ys = [y for y in range(h) if any(sp[x, y][3] for x in range(w))]
    if not ys: continue
    top, bot = min(ys), max(ys); H = bot - top + 1
    rep = {}
    for name, a, b in PARTS:
        box = (0, top + int(H * a), w, top + int(H * b))
        rep[name] = {'old': stats(srcim, oldim, box), 'new': stats(srcim, newim, box), 'sheetColours': len(set(p[:3] for p in srcim.crop(box).getdata() if p[3]))}
    report['%s%d' % (tag, idx)] = rep
    # the picture: sheet | old | new | error maps (old, new), ×3, with the part bands
    S = 3; W = w * S; Hh = h * S
    pic = Image.new('RGB', (W * 5 + 40, Hh + 30), (121, 139, 141)); d = ImageDraw.Draw(pic)
    def err_map(img):
        m = Image.new('RGB', (w, h), (121, 139, 141)); mp = m.load(); ip = img.load()
        for y in range(h):
            for x in range(w):
                a = sp[x, y]; b = ip[x, y]
                if not a[3] and not b[3]: continue
                e = 96 if (a[3] != b[3]) else sum(abs(a[k] - b[k]) for k in range(3)) / 3
                v = min(255, int(e * 3)); mp[x, y] = (v, 255 - v if a[3] else 0, 0) if a[3] else (255, 0, 255)
        return m
    for k, (label, im) in enumerate((('sheet', srcim), ('old 82 flat ×2', oldim), ('new raw 164', newim), ('error old', err_map(oldim)), ('error new', err_map(newim)))):
        x = 4 + k * (W + 8); pic.paste(im.convert('RGB').resize((W, Hh), Image.NEAREST) if im.mode == 'RGB' else Image.alpha_composite(Image.new('RGBA', (w, h), (121, 139, 141, 255)), im).convert('RGB').resize((W, Hh), Image.NEAREST), (x, 24))
        d.text((x, 6), label, fill=(255, 255, 0))
        for name, a, b in PARTS:
            yy = 24 + (top + int(H * a)) * S; d.line([(x, yy), (x + W, yy)], fill=(255, 255, 255))
            if k == 0: d.text((x + 2, yy + 1), name, fill=(255, 255, 255))
    pic.save(os.path.join(OUTD, '%s%d.png' % (tag, idx)))
# summary
avg = {}
for name, _, _ in PARTS:
    for which in ('old', 'new'):
        vals = [r[name][which] for r in report.values()]
        avg['%s_%s' % (name, which)] = {'err': round(sum(v['err'] for v in vals) / len(vals), 1), 'colours': round(sum(v['colours'] for v in vals) / len(vals)),
                                        'edges': round(sum(v['edges'] or 0 for v in vals) / len(vals), 2), 'missing': round(sum(v['missing'] for v in vals) / len(vals), 3)}
    avg[name + '_sheetColours'] = round(sum(r[name]['sheetColours'] for r in report.values()) / len(report))
json.dump({'cells': report, 'average': avg}, open(os.path.join(OUTD, 'report.json'), 'w'), indent=0)
lines = ['| part | sheet colours | old: err / colours / edges / missing | new: err / colours / edges / missing |', '|---|---|---|---|']
for name, _, _ in PARTS:
    o = avg[name + '_old']; n = avg[name + '_new']
    lines.append('| %s | %d | %.1f / %d / %.2f / %.1f%% | %.1f / %d / %.2f / %.1f%% |' % (name, avg[name + '_sheetColours'], o['err'], o['colours'], o['edges'], o['missing'] * 100, n['err'], n['colours'], n['edges'], n['missing'] * 100))
open(os.path.join(OUTD, 'report.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print('\n'.join(lines)); print('cells compared', len(report))
