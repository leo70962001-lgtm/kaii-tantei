# pixelize.py — the pixel-art refinement pass at the sprite's native resolution (the sheets' 4 px cells: a
# standing figure is 41 px, shown ×2 in the game). Runs after cells.py and rewrites src/sprites-jk.js.
# Direction: the Gemini action sheets (pose + look), the standing picture (colours, features), and the small
# hand-drawn references (Slynyrd's sword attack, Boyle's sword combos, Munguia's skeleton): flat tones, a dark
# outline around the silhouette, one red eye pixel, the white streak in the hair.
#   1. sheet C (30 px figures) is resampled to the A/B scale (41 px) so every cell shares one pixel size;
#   2. colours: each cell is flattened to ≤ 14 tones (median cut, skin kept apart) and snapped to the standing
#      picture's palette, then a 4-neighbour majority clean-up removes JPEG speckle;
#   3. outline: silhouette edges that are not dark get an ink pixel outside them (no double outlines);
#   4. features: the face is located (skin blob under hair in the head rows); its front-top pixel becomes the
#      red eye, the hair edge in front of it the white streak;
#   5. hand work: ref/art/<tag><i>.png (RGBA, same size) replaces a cell's figure outright and
#      ref/art/patches.json { "A5": [[x, y, "#rrggbb" | null], ...] } sets single pixels (null = erase) —
#      this is where the frame-by-frame pixel refinement lives;
#   6. every cell is exported to ref/art/cells/<tag><i>.png for editing, plus ref/art/cells_sheet.png (×4).
#   python pixelize.py
import os, sys, json, base64
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw

OUT = (14, 12, 24)
EYE = (196, 44, 62)
STREAK = (214, 218, 228)
def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
def sat(p): return max(p[:3]) - min(p[:3])
def is_skin(p): return p[0] > 170 and 110 < p[1] < 215 and 80 < p[2] < 200 and p[0] - p[2] > 35 and p[0] - p[1] > 15
def is_skin_loose(p): return p[0] > 140 and p[0] > p[1] + 12 and p[1] > p[2] - 10 and p[0] - p[2] > 25 and sat(p) > 20 and lum(p) > 90
def is_hair(p): return lum(p) < 60 and sat(p) < 45

# ---- the standing picture's palette
pic = Image.open('p_jk_full2.png').convert('RGBA')
pts = [p[:3] for p in pic.getdata() if p[3] and lum(p) > 34]
strip = Image.new('RGB', (len(pts), 1)); strip.putdata(pts)
q = strip.quantize(colors=28, method=Image.Quantize.MEDIANCUT)
pal = q.getpalette()[:28 * 3]; pal = [tuple(pal[i:i + 3]) for i in range(0, len(pal), 3)]
pal = [c for c in pal if lum(c) > 34] + [OUT]
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

def resample(im, f):
    w, h = im.size; W, H = round(w * f), round(h * f)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o = out.load(); px = im.load()
    for Y in range(H):
        sy = min(h - 1, int(Y / f))
        for X in range(W): o[X, Y] = px[min(w - 1, int(X / f)), sy]
    return out

def flatten(im):
    px = im.load(); w, h = im.size
    skinpx = {(x, y) for y in range(h) for x in range(w) if px[x, y][3] and is_skin(px[x, y])}
    fpts = [px[x, y][:3] for y in range(h) for x in range(w) if px[x, y][3] and (x, y) not in skinpx]
    if len(fpts) >= 16:
        st = Image.new('RGB', (len(fpts), 1)); st.putdata(fpts)
        qz = st.quantize(colors=min(14, len(set(fpts))), method=Image.Quantize.MEDIANCUT)
        qp = qz.getpalette()[:14 * 3]; qpal = [tuple(qp[i:i + 3]) for i in range(0, len(qp), 3)]
        near = {}
        def qq(c):
            if c not in near: near[c] = min(qpal, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)
            return near[c]
        for y in range(h):
            for x in range(w):
                p = px[x, y]
                if p[3]: px[x, y] = snap(p[:3] if (x, y) in skinpx else qq(p[:3])) + (255,)
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if not p[3]: continue
            nb = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3]]
            if len(nb) >= 3 and all(n[:3] != p[:3] for n in nb):
                cc = Counter(n[:3] for n in nb).most_common(1)[0]
                if cc[1] >= 3: px[x, y] = cc[0] + (255,)
    return im

def outline(im):
    """an ink pixel outside every silhouette edge whose inner pixel is not already dark"""
    px = im.load(); w, h = im.size; add = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3]: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] and lum(px[nx, ny]) > 70: add.append((x, y)); break
    for (x, y) in add: px[x, y] = OUT + (255,)
    return im

def face_of(im, fb):
    """the face: a skin blob starting 2–6 rows under the figure's top with hair above it → (x0, y0, x1, y1)"""
    px = im.load(); w, h = im.size
    fx0, fy0, fx1, fy1 = fb
    top = fy0 + (fy1 - fy0) * 0.45
    skin = [(x, y) for y in range(max(0, fy0), min(h, int(top) + 1)) for x in range(max(0, fx0), min(w, fx1 + 1)) if px[x, y][3] and is_skin_loose(px[x, y])]
    if len(skin) < 3: return None
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
        return sum(1 for y in range(max(0, y0 - 5), y0) for x in range(min(xs), max(xs) + 1) if px[x, y][3] and is_hair(px[x, y]))
    cands = [b for b in blobs if len(b) >= 3 and 2 <= (min(p[1] for p in b) - fy0) <= 6 and hair_above(b) >= 2]
    if not cands: return None
    face = min(cands, key=lambda b: min(p[1] for p in b))
    xs = [p[0] for p in face]; ys = [p[1] for p in face]
    if max(xs) - min(xs) + 1 > 9 or max(ys) - min(ys) + 1 > 11: return None
    return (min(xs), min(ys), max(xs), max(ys))

def features(im, fb):
    box = face_of(im, fb)
    if not box: return False
    px = im.load(); w, h = im.size
    x0, y0, x1, y1 = box
    # the eye: the front-most (right) skin pixel of the face's second row
    ey = min(y1, y0 + 1)
    row = [x for x in range(x0, x1 + 1) if px[x, ey][3] and is_skin_loose(px[x, ey])]
    if row: px[max(row), ey] = EYE + (255,)
    # the white streak: the hair pixel just left of the face at eye level and the one above it
    for (x, y) in ((x0 - 1, ey), (x0 - 1, ey - 1)):
        if 0 <= x < w and 0 <= y < h and px[x, y][3] and is_hair(px[x, y]): px[x, y] = STREAK + (255,)
    return True

# ---- cells
path = os.path.join('..', 'src', 'sprites-jk.js')
src = open(path, encoding='utf-8').read(); h0 = 'root.SPRITES.jk = '
data = json.loads(src[src.index(h0) + len(h0): src.rindex('; })')])
data.pop('heads', None)
os.makedirs(os.path.join('art', 'cells'), exist_ok=True)
patches = {}
if os.path.exists(os.path.join('art', 'patches.json')): patches = json.load(open(os.path.join('art', 'patches.json'), encoding='utf-8'))
stats = Counter(); exported = []
for tag, cells in data.items():
    f = 41 / 30 if tag == 'C' else 1
    for c in cells:
        name = '%s%d' % (tag, c['i'])
        fig = Image.frombytes('RGBA', (c['w'], c['h']), base64.b64decode(c['f']))
        eff = Image.frombytes('RGBA', (c['w'], c['h']), base64.b64decode(c['e'])) if c['e'] else None
        if f != 1 and not c.get('refined'):
            fig = resample(fig, f); eff = resample(eff, f) if eff else None
            sc = lambda v: round(v * f)
            c['ax'], c['ay'] = sc(c['ax'] + 0.5), sc(c['ay'] + 1) - 1
            for k in ('fig', 'eff'):
                if c.get(k): c[k] = [sc(c[k][0]), sc(c[k][1]), sc(c[k][2] + 1) - 1, sc(c[k][3] + 1) - 1]
            c['sX'], c['sY'] = sc(c['sX']), sc(c['sY'])
            c['w'], c['h'] = fig.size
        ov = os.path.join('art', name + '.png')
        if os.path.exists(ov):
            fig = Image.open(ov).convert('RGBA'); stats['override'] += 1
        elif c.get('refined'):
            stats['kept'] += 1
        else:
            flatten(fig); outline(fig)
            if c.get('fig'):
                fb = (c['fig'][0] + c['ax'], c['fig'][1] + c['ay'], c['fig'][2] + c['ax'], c['fig'][3] + c['ay'])
                if features(fig, fb): stats['faces'] += 1
        for (x, y, col) in patches.get(name, []):
            if 0 <= x < fig.width and 0 <= y < fig.height:
                fig.putpixel((x, y), (0, 0, 0, 0) if col is None else tuple(int(col[i:i + 2], 16) for i in (1, 3, 5)) + (255,)); stats['patched px'] += 1
        # the figure box follows the outline growth
        px = fig.load(); xs = [x for y in range(fig.height) for x in range(fig.width) if px[x, y][3]]; ys = [y for y in range(fig.height) for x in range(fig.width) if px[x, y][3]]
        if xs: c['fig'] = [min(xs) - c['ax'], min(ys) - c['ay'], max(xs) - c['ax'], max(ys) - c['ay']]
        c['f'] = base64.b64encode(fig.tobytes()).decode('ascii')
        c['e'] = base64.b64encode(eff.tobytes()).decode('ascii') if eff else None
        c['refined'] = 1
        fig.save(os.path.join('art', 'cells', name + '.png')); exported.append((name, fig, c))
        stats['cells'] += 1
# ---- the hand-drawn frames (ref/hand.py) as sheet 'H'
hj = os.path.join('art', 'hand.json')
if os.path.exists(hj):
    meta = json.load(open(hj, encoding='utf-8')); cells = []
    for key in sorted(meta, key=lambda k: int(k[1:])):
        m = meta[key]; n = int(key[1:])
        fig = Image.open(os.path.join('art', key + '.png')).convert('RGBA')
        effp = os.path.join('art', key + 'e.png'); eff = Image.open(effp).convert('RGBA') if os.path.exists(effp) else None
        def bbox(im):
            px = im.load(); xs = [x for y in range(im.height) for x in range(im.width) if px[x, y][3]]; ys = [y for y in range(im.height) for x in range(im.width) if px[x, y][3]]
            return [min(xs) - m['ax'], min(ys) - m['ay'], max(xs) - m['ax'], max(ys) - m['ay']] if xs else None
        cells.append({'i': n, 'row': 0, 'w': fig.width, 'h': fig.height, 'f': base64.b64encode(fig.tobytes()).decode('ascii'),
                      'e': base64.b64encode(eff.tobytes()).decode('ascii') if eff else None, 'ax': m['ax'], 'ay': m['ay'],
                      'fig': bbox(fig), 'eff': bbox(eff) if eff else None, 'ne': 0, 'sX': 0, 'sY': 0, 'refined': 1, 'name': m['name']})
        fig.save(os.path.join('art', 'cells', key + '.png'))
    data['H'] = cells; print('hand-drawn cells', len(cells))
js = src[:src.index(h0) + len(h0)] + json.dumps(data) + src[src.rindex('; })'):]
open(path, 'w', encoding='utf-8').write(js)
# contact sheet at ×4 with names, 12 per row
S = 4; per = 12
rows = [exported[i:i + per] for i in range(0, len(exported), per)]
W = max(sum(im.width * S + 10 for _, im, _ in r) for r in rows) + 10; H = sum(max(im.height for _, im, _ in r) * S + 26 for r in rows) + 10
sheet = Image.new('RGBA', (W, H), (124, 150, 163, 255)); d = ImageDraw.Draw(sheet); y = 10
for r in rows:
    x = 10; rh = max(im.height for _, im, _ in r) * S
    for name, im, c in r:
        sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, y + 16))
        gy = y + 16 + (c['ay'] + 1) * S; d.line([(x, gy), (x + im.width * S, gy)], fill=(255, 240, 80, 255))
        d.text((x, y + 2), name, fill=(255, 255, 0, 255)); x += im.width * S + 10
    y += rh + 26
sheet.save(os.path.join('art', 'cells_sheet.png'))
print('cells', stats['cells'], 'faces', stats['faces'], 'overrides', stats['override'], 'kept', stats['kept'], 'patched px', stats['patched px'], 'sheet', sheet.size)
