# refine.py — first refinement pass of the sprite cells, with the standing picture (ref/p_jk_full2.png, the black-
# background solo picture, 110 px) as the base:
#   1. palette: every figure pixel of every cell is snapped to the picture's own palette (28 tones from the
#      picture + the outline ink), so the muted, JPEG-noisy sheet colours become the picture's colours;
#   2. head: the face / head region of each upright cell is located (the skin cluster in the figure's top rows)
#      and its chin point stored, so the runtime (src/sprite.js) can erase the 8-px sheet head and draw the
#      picture's 27-px head (normal / hurt / shout faces, stored here too) at the same place;
#   3. the effect layer is left untouched.
# Re-runs are idempotent (it reads the cutter's output and rewrites src/sprites-jk.js).   python refine.py
import os, sys, json, base64
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image

OUT = (14, 12, 24)
def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
def sat(p): return max(p[:3]) - min(p[:3])
def is_skin(p): return p[0] > 170 and 110 < p[1] < 215 and 80 < p[2] < 200 and p[0] - p[2] > 35 and p[0] - p[1] > 15
def is_skin_loose(p): return p[0] > 140 and p[0] > p[1] + 12 and p[1] > p[2] - 10 and p[0] - p[2] > 25 and sat(p) > 20 and lum(p) > 90

pic = Image.open('p_jk_full2.png').convert('RGBA')
# ---- the picture's palette
pts = [p[:3] for p in pic.getdata() if p[3] and lum(p) > 34]
strip = Image.new('RGB', (len(pts), 1)); strip.putdata(pts)
q = strip.quantize(colors=28, method=Image.Quantize.MEDIANCUT)
pal = q.getpalette()[:28 * 3]; pal = [tuple(pal[i:i + 3]) for i in range(0, len(pal), 3)]
pal = [c for c in pal if lum(c) > 34] + [OUT]
# make sure the key materials are represented exactly (most common colour of each class in the picture)
def common(fn):
    c = Counter(p for p in pts if fn(p)); return c.most_common(1)[0][0] if c else None
for fn in (is_skin, lambda p: lum(p) > 200 and sat(p) < 30, lambda p: p[2] > p[0] + 25 and p[2] > 80, lambda p: p[0] > p[1] + 45 and p[0] > 90):
    c = common(fn)
    if c and c not in pal: pal.append(c)
cache = {}
def snap(c):
    if c in cache: return cache[c]
    r = OUT if lum(c) <= 40 else min(pal, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)
    cache[c] = r; return r

# ---- the picture's head (with the closed-eyes and open-mouth faces), chin point in part px
head = pic.crop((11, 0, 31, 27)); hp = head.load()
for y in range(head.height):
    for x in range(head.width):
        p = hp[x, y]
        if p[3] and y >= 22 and ((lum(p) > 165 and sat(p) < 45) or (p[2] > p[0] + 25 and y > 23)): hp[x, y] = (0, 0, 0, 0)
def variant(paint):
    im = head.copy(); px = im.load(); paint(px); return im
def paint_hurt(px):
    skinc = px[12, 17][:3] if px[12, 17][3] else (236, 188, 168)
    for y in range(12, 16):
        for x in range(13, 18):
            if px[x, y][3]: px[x, y] = skinc + (255,)
    for x in range(13, 17): px[x, 14] = OUT + (255,)
    px[16, 13] = OUT + (255,)
def paint_shout(px):
    for x, y in ((14, 19), (15, 19), (14, 20), (15, 20)): px[x, y] = (96, 22, 34, 255)
    px[15, 19] = (150, 40, 52, 255)
HEADS = {'normal': head, 'hurt': variant(paint_hurt), 'shout': variant(paint_shout)}
CHIN = [10, 25]   # bottom centre of the face in the head part

# ---- cells
path = os.path.join('..', 'src', 'sprites-jk.js')
src = open(path, encoding='utf-8').read(); h0 = 'root.SPRITES.jk = '
data = json.loads(src[src.index(h0) + len(h0): src.rindex('; })')])
stats = Counter()
for tag, cells in data.items():
    if tag == 'heads': continue
    for c in cells:
        im = Image.frombytes('RGBA', (c['w'], c['h']), base64.b64decode(c['f'])); px = im.load(); w, h = im.size
        # 1. head (on the sheet's own colours): the skin cluster of the top 45 % of the figure with hair above it
        fb = c.get('fig'); c['head'] = None
        if fb:
            fx0, fy0, fx1, fy1 = fb[0] + c['ax'], fb[1] + c['ay'], fb[2] + c['ax'], fb[3] + c['ay']
            top = fy0 + (fy1 - fy0) * 0.45
            skin = [(x, y) for y in range(max(0, fy0), min(h, int(top) + 1)) for x in range(max(0, fx0), min(w, fx1 + 1)) if px[x, y][3] and is_skin_loose(px[x, y])]
            std = 41 if tag in ('A', 'B') else 30   # the sheet's standing height (cell px)
            upright_fig = (fy1 - fy0 + 1) >= 0.72 * std
            if len(skin) >= 3:
                # the largest 8-connected skin blob = the face
                S = set(skin); seen = set(); blobs = []
                for p0 in skin:
                    if p0 in seen: continue
                    st = [p0]; seen.add(p0); blob = []
                    while st:
                        x, y = st.pop(); blob.append((x, y))
                        for dx in (-1, 0, 1):
                            for dy in (-1, 0, 1):
                                q2 = (x + dx, y + dy)
                                if q2 in S and q2 not in seen: seen.add(q2); st.append(q2)
                    blobs.append(blob)
                def hair_above(b):
                    xs = [p[0] for p in b]; y0 = min(p[1] for p in b)
                    return sum(1 for y in range(max(0, y0 - 5), y0) for x in range(min(xs), max(xs) + 1) if px[x, y][3] and lum(px[x, y]) < 60 and sat(px[x, y]) < 45)
                lim = 6 if std == 41 else 5
                cands = [b for b in blobs if len(b) >= 3 and 2 <= (min(p[1] for p in b) - fy0) <= lim and hair_above(b) >= 2]
                face = min(cands, key=lambda b: min(p[1] for p in b)) if cands else []
                xs = [p[0] for p in face] or [0]; ys = [p[1] for p in face] or [0]
                bx0, by0, bx1, by1 = min(xs), min(ys), max(xs), max(ys)
                fw, fh = bx1 - bx0 + 1, by1 - by0 + 1
                upright = len(face) >= 3 and fh >= 2 and fw <= 9 and fh <= 11
                if upright:
                    chin = [round((bx0 + bx1) / 2), by1]
                    hair = [x for y in range(max(0, fy0), by1 + 1) for x in range(max(0, bx0 - 8), min(w, bx1 + 9)) if px[x, y][3] and lum(px[x, y]) < 60 and sat(px[x, y]) < 45]
                    hx0, hx1 = (min(hair), max(hair)) if hair else (bx0, bx1)
                    box = [max(fx0 - 1, min(bx0 - 3, hx0)), fy0 - 1, min(fx1 + 1, max(bx1 + 3, hx1)), by1 + 1]
                    c['head'] = {'chin': [chin[0] - c['ax'], chin[1] - c['ay']], 'box': [box[0] - c['ax'], box[1] - c['ay'], box[2] - c['ax'], box[3] - c['ay']]}
                    stats['heads'] += 1
        # 2. flatten the cell to its own few tones (median cut), map those to the picture's palette, then a
        #    majority clean-up so lone speckles join their neighbours
        skinpx = {(x, y) for y in range(h) for x in range(w) if px[x, y][3] and is_skin(px[x, y])}
        fpts = [px[x, y][:3] for y in range(h) for x in range(w) if px[x, y][3] and (x, y) not in skinpx]
        if len(fpts) >= 16:
            st = Image.new('RGB', (len(fpts), 1)); st.putdata(fpts)
            qz = st.quantize(colors=min(14, len(set(fpts))), method=Image.Quantize.MEDIANCUT)
            qp = qz.getpalette()[:14 * 3]; qpal = [tuple(qp[i:i + 3]) for i in range(0, len(qp), 3)]
            near = {}
            def q(c):
                if c not in near: near[c] = min(qpal, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)
                return near[c]
            for y in range(h):
                for x in range(w):
                    p = px[x, y]
                    if p[3]: px[x, y] = snap(p[:3] if (x, y) in skinpx else q(p[:3])) + (255,)
            for y in range(h):
                for x in range(w):
                    p = px[x, y]
                    if not p[3]: continue
                    nb = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3]]
                    if len(nb) >= 3 and all(n[:3] != p[:3] for n in nb):
                        cc = Counter(n[:3] for n in nb).most_common(1)[0]
                        if cc[1] >= 3: px[x, y] = cc[0] + (255,)
            if c['head'] is None and upright_fig:
                zone = list(range(fy0 + 3, min(h, fy0 + (8 if std == 41 else 6) + 1)))
                rights = [max((x for x in range(max(0, fx0), min(w, fx1 + 1)) if px[x, y][3]), default=None) for y in zone]
                rights = [r for r in rights if r is not None]
                if rights:
                    cx = max(rights) - 2; cy = fy0 + (8 if std == 41 else 6)
                    hair = [x for y in range(max(0, fy0), cy + 1) for x in range(max(0, cx - 12), min(w, cx + 6)) if px[x, y][3] and lum(px[x, y]) < 60 and sat(px[x, y]) < 45]
                    hx0 = min(hair) if hair else cx - 4
                    box = [max(fx0 - 1, min(cx - 4, hx0)), fy0 - 1, min(fx1 + 1, cx + 4), cy + 1]
                    c['head'] = {'chin': [cx - c['ax'], cy - c['ay']], 'box': [box[0] - c['ax'], box[1] - c['ay'], box[2] - c['ax'], box[3] - c['ay']], 'guess': True}
                    stats['heads (guessed)'] += 1
        c['f'] = base64.b64encode(im.tobytes()).decode('ascii'); stats['cells'] += 1
data['heads'] = {k: {'w': v.width, 'h': v.height, 'd': base64.b64encode(v.tobytes()).decode('ascii'), 'chin': CHIN} for k, v in HEADS.items()}
js = src[:src.index(h0) + len(h0)] + json.dumps(data) + src[src.rindex('; })'):]
open(path, 'w', encoding='utf-8').write(js)
print('palette', len(pal), 'cells', stats['cells'], 'heads located', stats['heads'], 'guessed', stats['heads (guessed)'])
