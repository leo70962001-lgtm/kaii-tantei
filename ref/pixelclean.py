# pixelclean.py — 「把角色的點圖再精細畫，學習網站裡的點圖」: the reference pixel art (OMAR.'s uniform girl, Pokidmi's scenes)
# reads as pixel art because every pixel is a deliberate cluster on ONE grid with a small coherent palette. Our 1:1 cells
# (164 px, src/sprites-jk.js) are twice as fine as the stage's grid and carry the AI sheet's painterly noise. This pass
# makes the character share the stage's pixel grid and palette discipline:
#   half (default): each cell is properly downsampled 2×2 (premultiplied alpha, linear light) to 82 px = 1 world px per
#          sprite px = the stage's grid; then a k-means palette in Oklab (N colours, seeded with the cell's dominant colours,
#          the outline colour pinned) and a gentle despeckle (an isolated pixel joins its neighbourhood's majority colour
#          only when the two are close in Oklab — an eye, a highlight, a 1-px line stay). → src/sprites-jk-82.js (res 2).
#   full:  the same palette + despeckle on the 164-px cells → src/sprites-jk.js (res 4).
#   py -3 ref/pixelclean.py              # half, 40 colours, all sheets
#   py -3 ref/pixelclean.py 32 tag:V     # 32 colours, only the V sheet
#   py -3 ref/pixelclean.py full 48      # the 164-px variant
#   py -3 ref/pixelclean.py undo         # restore src/sprites-jk.js from ref/art/sprites-jk-raw.js
# Reports per sheet: colour error of the cleaned cell against the plain downsample (L1/3, 0–255), despeckled pixels, colours.
# Review: ref/art/pixelclean_review.png = raw 164 (×2) | plain 82 (×4) | clean 82 (×4) for the first cells of the first sheet.
import os, sys, json, base64, shutil, math, random
from collections import Counter
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import importlib.util
argv = sys.argv[1:]
sys.argv = [sys.argv[0], 'raw']
spec = importlib.util.spec_from_file_location('r2', 'refine2.py'); r2 = importlib.util.module_from_spec(spec); spec.loader.exec_module(r2)
N = next((int(a) for a in argv if a.isdigit()), 40)
ONLY = [a.split(':')[1] for a in argv if a.startswith('tag:')]
MODE = 'full' if 'full' in argv else 'half'
DE = 0.085                     # Oklab distance under which a lone pixel is noise, not a feature
SRC = '../src/sprites-jk.js'; RAW = os.path.join('art', 'sprites-jk-raw.js'); OUT82 = '../src/sprites-jk-82.js'

def load(path):
    src = open(path, encoding='utf-8').read(); h0 = 'root.SPRITES.jk = '; i = src.index(h0) + len(h0); j = src.rindex('; })')
    return src[:i], json.loads(src[i:j]), src[j:]
def save(path, head, data, tail):
    open(path, 'w', encoding='utf-8', newline='\n').write(head + json.dumps(data, separators=(',', ':')) + tail)
def cell_image(c, key='f'):
    w, h = c['w'], c['h']
    if not c.get(key): return None
    if c.get('enc') in ('prle', 'prla'): return r2.unprle(c[key], w, h, c.get('enc') == 'prla')
    return Image.frombytes('RGBA', (w, h), base64.b64decode(c[key]))

# ---- Oklab (perceptual distances: the palette merges what the eye would merge)
LIN = [ (v / 255.0) / 12.92 if v / 255.0 <= 0.04045 else (((v / 255.0) + 0.055) / 1.055) ** 2.4 for v in range(256) ]
def lin_to_srgb(v): v = max(0.0, min(1.0, v)); return 255.0 * (12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)
def to_oklab(rgb):
    r, g, b = LIN[rgb[0]], LIN[rgb[1]], LIN[rgb[2]]
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b; m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b; s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = l ** (1 / 3), m ** (1 / 3), s ** (1 / 3)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)
def from_oklab(lab):
    L, a, b = lab
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3; m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3; s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s; g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s; bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(int(round(lin_to_srgb(v))) for v in (r, g, bb))
def d2(p, q): return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2

def kmeans(points, k, seeds, iters=10):
    cents = list(seeds)[:k]; rnd = random.Random(7)
    while len(cents) < k: cents.append(points[rnd.randrange(len(points))])
    for _ in range(iters):
        sums = [[0.0, 0.0, 0.0, 0] for _ in cents]
        for p in points:
            bi = min(range(len(cents)), key=lambda i: d2(p, cents[i]))
            s = sums[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3] += 1
        new = [((s[0] / s[3], s[1] / s[3], s[2] / s[3]) if s[3] else cents[i]) for i, s in enumerate(sums)]
        if all(abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2]) < 1e-4 for a, b in zip(new, cents)): cents = new; break
        cents = new
    return cents

CRISP = 'crisp' in argv       # pick one real pixel per 2×2 block (the one nearest the block's mean) instead of blending
def downsample(im):
    """2×2 → 1: the block's mean with premultiplied alpha in linear light (soft) or, with `crisp`, the block pixel nearest
    that mean (hard edges, no invented in-between colours — how a pixel artist would reduce it); alpha → the 4 rim levels"""
    w, h = im.size; W, H = w // 2, h // 2; px = im.load()
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); op = out.load()
    for y in range(H):
        for x in range(W):
            sr = sg = sb = sa = 0.0; block = []
            for dy in (0, 1):
                for dx in (0, 1):
                    r, g, b, a = px[2 * x + dx, 2 * y + dy]; block.append((r, g, b, a)); a /= 255.0
                    sr += LIN[r] * a; sg += LIN[g] * a; sb += LIN[b] * a; sa += a
            if sa <= 0: continue
            r, g, b = (lin_to_srgb(v / sa) for v in (sr, sg, sb)); a = sa / 4
            a4 = 255 if a > 0.9 else 191 if a > 0.62 else 127 if a > 0.37 else 63 if a > 0.14 else 0
            if not a4: continue
            if CRISP:
                mean = to_oklab((int(round(r)), int(round(g)), int(round(b))))
                cand = [q for q in block if q[3] == max(t[3] for t in block)]
                r, g, b, _ = min(cand, key=lambda q: d2(to_oklab(q[:3]), mean))
            op[x, y] = (int(round(r)), int(round(g)), int(round(b)), a4)
    return out

def clean(im, n, stats):
    w, h = im.size; px = im.load()
    opaque = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] == 255]
    if len(opaque) < 20: return im
    cnt = Counter((px[x, y][0] >> 3, px[x, y][1] >> 3, px[x, y][2] >> 3) for x, y in opaque)
    seeds = [to_oklab(((r << 3) + 4, (g << 3) + 4, (b << 3) + 4)) for (r, g, b), _ in cnt.most_common(n)]
    cents = kmeans([to_oklab(px[x, y][:3]) for x, y in opaque], n, [to_oklab(r2.OUT)] + seeds)
    pal = [from_oklab(c) for c in cents]; cache = {}
    def nearest(rgb):
        if rgb not in cache: p = to_oklab(rgb); cache[rgb] = min(range(len(cents)), key=lambda i: d2(p, cents[i]))
        return cache[rgb]
    idx = {(x, y): nearest(px[x, y][:3]) for x, y in opaque}
    # despeckle: a lone pixel joins the neighbourhood majority only if the two colours are close (noise, not a feature)
    changed = 0
    for _ in range(2):
        changes = []
        for (x, y), i in idx.items():
            nb = [idx[(x + dx, y + dy)] for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and (x + dx, y + dy) in idx]
            if len(nb) < 5: continue
            same = sum(1 for j in nb if j == i)
            if same > 1: continue
            maj, cm = Counter(nb).most_common(1)[0]
            if cm < 4 or maj == i: continue
            if math.sqrt(d2(cents[i], cents[maj])) < DE: changes.append(((x, y), maj))
        for k, v in changes: idx[k] = v
        changed += len(changes)
        if not changes: break
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); op = out.load(); err = 0.0
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] == 255: c = pal[idx[(x, y)]]; op[x, y] = (c[0], c[1], c[2], 255); err += sum(abs(p[k] - c[k]) for k in range(3)) / 3
            elif p[3]: c = pal[nearest(p[:3])]; op[x, y] = (c[0], c[1], c[2], p[3])
    stats['err'] += err / len(opaque); stats['spk'] += changed; stats['cols'] += len(set(idx.values())); stats['n'] += 1
    return out

def main():
    if 'undo' in argv:
        shutil.copy(RAW, SRC); print('restored', SRC, 'from', RAW); return
    if not os.path.exists(RAW): shutil.copy(SRC, RAW); print('raw cells saved to', RAW)
    head, data, tail = load(RAW)
    tags = [t for t in ('A', 'B', 'C', 'V') if t in data and (not ONLY or t in ONLY)]
    review = []
    for tag in tags:
        st = {'err': 0.0, 'spk': 0, 'cols': 0, 'n': 0}
        for c in data[tag]:
            if c.get('enc') not in ('prle', 'prla'): continue
            im = cell_image(c); ef = cell_image(c, 'e')
            if MODE == 'half':
                raw = im; im = downsample(im); ef = downsample(ef) if ef else None
                for k in ('w', 'h', 'ax', 'ay', 'sX', 'sY'): c[k] = c[k] // 2 if k in ('w', 'h') else int(round(c[k] / 2))
                for k in ('fig', 'eff'):
                    if c.get(k): c[k] = [int(math.floor(v / 2)) if j < 2 else int(math.ceil(v / 2)) for j, v in enumerate(c[k])]
                c['res'] = 2
            cl = clean(im, N, st)
            c['f'] = r2.prle(cl); c['enc'] = 'prla'; c['clean'] = N
            if ef is not None: c['e'] = r2.prle(ef)
            if tag == tags[0] and len(review) < 8: review.append((raw if MODE == 'half' else im, im, cl))
            cl.save(os.path.join('art', 'cells', '%s%d%s.png' % (tag, c['i'], '_82' if MODE == 'half' else '')))
        if st['n']: print('%s: %d cells, palette err %.1f, despeckled %.1f px/cell, %.0f colours/cell' % (tag, st['n'], st['err'] / st['n'], st['spk'] / st['n'], st['cols'] / st['n']))
    if MODE == 'half':
        data['res'] = 2
        for t in ('H',):
            if t in data: pass   # the hand-drawn reserve keeps its own scale
        save(OUT82, head, data, tail); out = OUT82
    else:
        if ONLY:
            _, cur, _ = load(SRC)
            for t in cur:
                if t not in tags: data[t] = cur[t]
        save(SRC, head, data, tail); out = SRC
    print('wrote', out, '%.2f MB' % (os.path.getsize(out) / 1e6))
    if review:
        S = 4 if MODE == 'half' else 3; hh = max(a.height * (2 if MODE == 'half' else S) for a, _, _ in review); ww = sum((a.width * 2 if MODE == 'half' else a.width * S) + 2 * (b.width * S + 4) + 12 for a, b, _ in review)
        pic = Image.new('RGB', (ww, hh + 20), (30, 34, 70)); d = ImageDraw.Draw(pic); x = 0
        for a, b, cl in review:
            for im, s in ((a, 2 if MODE == 'half' else S), (b, S), (cl, S)):
                bg = Image.new('RGBA', im.size, (30, 34, 70, 255)); bg.alpha_composite(im)
                pic.paste(bg.convert('RGB').resize((im.width * s, im.height * s), Image.NEAREST), (x, 20)); x += im.width * s + 4
            d.text((x - 300, 4), 'raw 164 | plain 82 | clean 82' if MODE == 'half' else 'raw | clean', fill=(255, 230, 120)); x += 8
        name = 'pixelclean_review_%s%s.png' % (MODE, '_crisp' if CRISP else '')
        pic.save(os.path.join('art', name)); print('review', name, pic.size)
main()
