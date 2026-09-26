# pixelclean.py — 「把角色的點圖再精細畫，學習網站裡的點圖」: turn the 1:1-sampled cells (src/sprites-jk.js, 'prla') into
# deliberate pixel art the way the reference pieces are drawn — a small coherent palette per cell (k-means in Oklab, seeded
# with the cell's dominant colours, the outline colour pinned), clusters instead of speckle (isolated pixels take the
# majority colour of their 3×3 neighbourhood; 1-px lines and 2-px details are left alone), the un-blended alpha rim kept.
#   py -3 ref/pixelclean.py            # all sheets, 40 colours per cell → src/sprites-jk.js (+ ref/art/cells/, review)
#   py -3 ref/pixelclean.py 32 tag:V   # 32 colours, only the V sheet
#   py -3 ref/pixelclean.py undo       # restore the raw cells from ref/art/sprites-jk-raw.js
# The raw cells are kept in ref/art/sprites-jk-raw.js so the pass can be re-tuned or undone; compare with
#   py -3 ref/compare_parts.py V A C   (the per-part numbers) and ref/art/pixelclean_review.png (raw | clean, ×3).
import os, sys, json, base64, shutil, math, random
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import importlib.util
argv = sys.argv[1:]
sys.argv = [sys.argv[0], 'raw']
spec = importlib.util.spec_from_file_location('r2', 'refine2.py'); r2 = importlib.util.module_from_spec(spec); spec.loader.exec_module(r2)
N = next((int(a) for a in argv if a.isdigit()), 40)
ONLY = [a.split(':')[1] for a in argv if a.startswith('tag:')]
SRC = '../src/sprites-jk.js'; RAW = os.path.join('art', 'sprites-jk-raw.js')

def load(path):
    src = open(path, encoding='utf-8').read(); h0 = 'root.SPRITES.jk = '; i = src.index(h0) + len(h0); j = src.rindex('; })')
    return src[:i], json.loads(src[i:j]), src[j:]
def save(path, head, data, tail):
    open(path, 'w', encoding='utf-8', newline='\n').write(head + json.dumps(data, separators=(',', ':')) + tail)
def cell_image(c):
    w, h = c['w'], c['h']
    if c.get('enc') in ('prle', 'prla'): return r2.unprle(c['f'], w, h, c.get('enc') == 'prla')
    return Image.frombytes('RGBA', (w, h), base64.b64decode(c['f']))

# ---- Oklab (perceptual distances: the palette merges what the eye would merge)
def srgb_to_lin(v): v /= 255.0; return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
def lin_to_srgb(v): v = max(0.0, min(1.0, v)); return 255.0 * (12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)
def to_oklab(rgb):
    r, g, b = (srgb_to_lin(v) for v in rgb)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b; m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b; s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = l ** (1 / 3), m ** (1 / 3), s ** (1 / 3)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)
def from_oklab(lab):
    L, a, b = lab
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3; m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3; s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s; g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s; bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(int(round(lin_to_srgb(v))) for v in (r, g, bb))

def kmeans(points, k, seeds, iters=12):
    """points: list of oklab tuples (with weights via repetition); seeds: initial centres"""
    cents = list(seeds)[:k]
    rnd = random.Random(7)
    while len(cents) < k: cents.append(points[rnd.randrange(len(points))])
    for _ in range(iters):
        sums = [[0.0, 0.0, 0.0, 0] for _ in cents]
        for p in points:
            bi = min(range(len(cents)), key=lambda i: (p[0] - cents[i][0]) ** 2 + (p[1] - cents[i][1]) ** 2 + (p[2] - cents[i][2]) ** 2)
            s = sums[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3] += 1
        new = []
        for i, s in enumerate(sums):
            new.append((s[0] / s[3], s[1] / s[3], s[2] / s[3]) if s[3] else cents[i])
        if all(abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2]) < 1e-4 for a, b in zip(new, cents)): cents = new; break
        cents = new
    return cents

def clean(im, n):
    w, h = im.size; px = im.load()
    opaque = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] == 255]
    if len(opaque) < 20: return im
    # 1. the palette: k-means in Oklab over the opaque pixels; seeds = the most common colours (quantised to 5 bits) so the
    #    big flat areas keep their exact tone; the outline colour is pinned
    from collections import Counter
    cnt = Counter((px[x, y][0] >> 3, px[x, y][1] >> 3, px[x, y][2] >> 3) for x, y in opaque)
    seeds = [to_oklab(((r << 3) + 4, (g << 3) + 4, (b << 3) + 4)) for (r, g, b), _ in cnt.most_common(n)]
    outline = to_oklab(r2.OUT)
    pts = [to_oklab(px[x, y][:3]) for x, y in opaque]
    cents = kmeans(pts, n, [outline] + seeds)
    pal = [from_oklab(c) for c in cents]
    def nearest(rgb):
        p = to_oklab(rgb)
        return min(range(len(cents)), key=lambda i: (p[0] - cents[i][0]) ** 2 + (p[1] - cents[i][1]) ** 2 + (p[2] - cents[i][2]) ** 2)
    idx = {}
    cache = {}
    for x, y in opaque:
        key = px[x, y][:3]
        if key not in cache: cache[key] = nearest(key)
        idx[(x, y)] = cache[key]
    # 2. clusters: a pixel whose palette index differs from at least 6 of its 8 opaque neighbours is speckle → the
    #    majority index of the neighbourhood (a 1-px line keeps 2 like neighbours, a 2-px detail more, so they survive)
    for _ in range(2):
        changes = []
        for (x, y), i in idx.items():
            nb = [idx[(x + dx, y + dy)] for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and (x + dx, y + dy) in idx]
            if len(nb) < 5: continue
            same = sum(1 for j in nb if j == i)
            if same <= len(nb) - 6 or (len(nb) >= 7 and same <= 1):
                maj = Counter(nb).most_common(1)[0][0]
                # never turn an outline-coloured pixel into skin/cloth (it may be a 1-px feature) unless it is truly alone
                if i == 0 and same >= 1: continue
                changes.append(((x, y), maj))
        for k, v in changes: idx[k] = v
        if not changes: break
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); op = out.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] == 255: c = pal[idx[(x, y)]]; op[x, y] = (c[0], c[1], c[2], 255)
            elif p[3]: c = pal[cache.get(p[:3], nearest(p[:3]))]; op[x, y] = (c[0], c[1], c[2], p[3])
    return out

def main():
    if 'undo' in argv:
        shutil.copy(RAW, SRC); print('restored', SRC, 'from', RAW); return
    if not os.path.exists(RAW): shutil.copy(SRC, RAW); print('raw cells saved to', RAW)
    head, data, tail = load(RAW)
    tags = [t for t in ('A', 'B', 'C', 'V') if t in data and (not ONLY or t in ONLY)]
    review = []; total = 0
    for tag in tags:
        for c in data[tag]:
            if c.get('enc') not in ('prle', 'prla'): continue
            im = cell_image(c); cl = clean(im, N)
            c['f'] = r2.prle(cl); c['enc'] = 'prla'; c['clean'] = N; total += 1
            cl.save(os.path.join('art', 'cells', '%s%d.png' % (tag, c['i'])))
            if tag == tags[0] and len(review) < 12: review.append((im, cl))
    if ONLY:   # keep the other sheets as they are in the current file
        _, cur, _ = load(SRC)
        for t in cur:
            if t not in tags: data[t] = cur[t]
    save(SRC, head, data, tail)
    print('cleaned', total, 'cells with', N, 'colours each ->', SRC, '%.2f MB' % (os.path.getsize(SRC) / 1e6))
    if review:
        S = 3; hh = max(a.height for a, _ in review) * S; ww = sum(a.width * S * 2 + 12 for a, _ in review)
        pic = Image.new('RGB', (ww, hh + 20), (30, 34, 70)); d = ImageDraw.Draw(pic); x = 0
        for a, b in review:
            for k, im in enumerate((a, b)):
                bg = Image.new('RGBA', im.size, (30, 34, 70, 255)); bg.alpha_composite(im)
                pic.paste(bg.convert('RGB').resize((im.width * S, im.height * S), Image.NEAREST), (x + k * (a.width * S + 4), 20))
            d.text((x, 4), 'raw | clean', fill=(255, 230, 120)); x += a.width * S * 2 + 12
        pic.save(os.path.join('art', 'pixelclean_review.png')); print('review', pic.size)
main()
