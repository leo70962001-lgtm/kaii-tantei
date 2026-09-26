# refine2.py — precise re-analysis of the Gemini action sheets + a "16-bit RPG sprite" clean-up of every sheet cell,
# with sheet B (ref/jk_actions3.jpg) as the drawing baseline.
#
# Findings (grid_analysis.py): the three sheets have NO true pixel grid (the gradient autocorrelation peaks at 1 px —
# they are AI "pixel-look" paintings; a figure is ~165 source px tall), so the old 4-px block average mixed
# neighbouring pseudo-pixels and left JPEG mud. Here every sprite pixel is re-derived from its own window of SOURCE
# pixels (UP = 1: 4×4 → 41-px cells; UP = 2: 2×2 → 82-px cells drawn 1:1 in the 480×270 world, i.e. the sheet's
# drawing at half size — the finest the source supports): each source pixel is classified into a MATERIAL (hair,
# skin, top, collar, scarf, skirt, chrome leg, stocking, boot, blade, hilt, guard, sheen, line) by colour + its
# height on the figure, the window takes the majority material (small features — face, scarf, guard — win at a
# quarter), the tone is the window's median luminance mapped onto that material's fixed 3-shade ramp (from the
# standing picture), the two legs are split dark / light per column. Then, after the "How to draw a 16-bit RPG
# sprite" sheet: silhouette first (from the source, inside the cutter's mask), a locked 1-px dark outline, 3 shades
# per area, cluster shading (3×3 tone majority inside a material), a consistent top-left light (rim light / rim
# shade), a simple face (red eye under a dark lash, the white streak), no half pixels. Effects (cyan / magenta /
# fire / white strokes) are re-cut from the source inside the cutter's effect mask and quantised to 3 tones.
#
#   python refine2.py            41-px cells (UP 1) → src/sprites-jk.js (A/B/C; H cells untouched), ref/art/cells/
#   python refine2.py x2         82-px cells (UP 2; the engine then needs SCALE 1 / hit boxes ×2 — tools/patch)
#   ... review                   only writes ref/art/refine2_review.png (before / after, ×6);  nolight = no rim light
# The cutter's 41-px geometry + masks are kept in each cell as 'g41' so the pass can be re-run at either scale.
import os, sys, json, base64, math
from collections import Counter
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw

SHEETS = {'A': 'jk_actions2.jpg', 'B': 'jk_actions3.jpg', 'C': 'jk_actions4.jpg'}
GRID = 4.0
CSCALE = 41 / 30                                       # sheet C's figures are 30 px on its grid; cells were resampled to 41
OUT = (20, 23, 42)                                     # the sheets' own outline colour (analyze_b.py: median of L < 30)
UP = 2 if 'x2' in sys.argv else 1
LIGHT_PASS = 'nolight' not in sys.argv
BASE_H = {'A': 164, 'B': 164, 'C': 123}               # the idle figure's source height per sheet (analyze_b.py)

# ---- material ramps (shade, base, light): the sheets' OWN colours, measured by analyze_b.py (luminance
# percentiles per material with the median chroma; the shirt's base taken at its lit percentile so it reads white)
SHEET_PAL = {                                          # measured on the sheets (muted: JPEG + the sheets' grey light)
    'hair':    [(34, 34, 55), (49, 48, 68), (69, 70, 87)],
    'skin':    [(170, 122, 112), (195, 149, 137), (242, 200, 172)],
    'top':     [(150, 148, 162), (210, 212, 222), (240, 242, 246)],
    'collar':  [(41, 49, 79), (60, 70, 95), (101, 113, 135)],
    'scarf':   [(150, 45, 70), (190, 70, 90), (220, 120, 130)],
    'skirt':   [(59, 70, 108), (75, 90, 131), (101, 113, 145)],
    'chrome':  [(66, 66, 84), (98, 97, 114), (189, 185, 194)],
    'stock':   [(34, 35, 55), (41, 43, 64), (49, 52, 73)],
    'boot':    [(18, 20, 39), (23, 26, 45), (30, 32, 52)],
    'blade':   [(214, 223, 228), (238, 241, 241), (255, 254, 228)],
    'hilt':    [(167, 38, 89), (227, 64, 74), (222, 127, 139)],
    'guard':   [(170, 160, 81), (219, 200, 84), (225, 221, 93)],
    'sheen':   [(183, 157, 172), (167, 223, 162), (205, 253, 172)],
    'line':    [OUT, OUT, OUT],
}
PIC_PAL = {                                            # the standing picture's colours (cleaner, more saturated)
    'hair':    [(12, 13, 26), (28, 30, 48), (54, 58, 86)],
    'skin':    [(216, 164, 140), (242, 203, 176), (250, 226, 208)],
    'top':     [(178, 186, 206), (226, 230, 240), (250, 251, 255)],
    'collar':  [(30, 42, 88), (46, 63, 120), (88, 113, 178)],
    'scarf':   [(142, 29, 42), (214, 50, 66), (240, 96, 104)],
    'skirt':   [(48, 60, 106), (76, 92, 152), (127, 144, 200)],
    'chrome':  [(90, 98, 128), (158, 168, 192), (226, 232, 242)],
    'stock':   [(30, 32, 48), (44, 46, 64), (70, 74, 98)],
    'boot':    [(20, 22, 36), (34, 36, 54), (58, 60, 80)],
    'blade':   [(138, 146, 172), (200, 208, 224), (240, 244, 252)],
    'hilt':    [(96, 26, 46), (150, 46, 64), (208, 64, 74)],
    'guard':   [(150, 120, 60), (200, 162, 76), (236, 208, 120)],
    'sheen':   [(120, 200, 160), (142, 216, 168), (214, 144, 208)],
    'line':    [OUT, OUT, OUT],
}
RAMPS = SHEET_PAL if 'sheetpal' in sys.argv else PIC_PAL
REGIONS = 'regions' in sys.argv                        # affinity regions for materials (the per-pixel majority keeps
                                                       # the small faces crisper, so it is the default; regions flood them)
# ---- per-cell analysis (art/analysis_b.json): source heights → a per-cell scale that removes the sheets' size drift
# (the walk figures are drawn 8 % smaller than the idle ones), and the measured eye position
ANALYSIS = json.load(open(os.path.join('art', 'analysis_b.json'))) if os.path.exists(os.path.join('art', 'analysis_b.json')) else {'cells': {}}
def cell_scale(tag, c):
    """upright cells (narrow, full height) are scaled to the sheet's idle height; the others take their row's median"""
    a = ANALYSIS['cells'].get('%s%d' % (tag, c['i']))
    if not a or 'noscale' in sys.argv: return 1.0
    def upright(v): return v['w'] / max(1, v['h']) < 0.62 and v['h'] >= BASE_H[tag] * 0.8
    if upright(a): return BASE_H[tag] / a['h']
    row = [BASE_H[tag] / v['h'] for k, v in ANALYSIS['cells'].items() if k[0] == tag and v['row'] == a['row'] and upright(v)]
    if not row: return 1.0
    row.sort(); return row[len(row) // 2]
FX_RAMPS = {
    'cyan':    [(70, 160, 200), (110, 226, 240), (220, 250, 255)],
    'magenta': [(150, 60, 160), (232, 90, 220), (255, 200, 250)],
    'fire':    [(214, 96, 40), (255, 150, 60), (255, 230, 120)],
    'white':   [(160, 190, 230), (200, 220, 245), (240, 248, 255)],
}
def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
def sat(p): return max(p[:3]) - min(p[:3])

def classify(p, hy):
    """material of a SOURCE pixel; hy = its height on the figure 0 (top) .. 1 (feet)"""
    r, g, b = p[:3]; L = lum(p); S = sat(p)
    if L < 18: return 'line'
    if L < 30: return 'boot' if hy > 0.86 else 'line'
    # energy / fire effects
    if (g > r + 60 and b > r + 40 and g > 140) or (g > r + 35 and b > r + 25 and g > 100 and L < 200 and b > 120): return 'cyan'
    if r > g + 50 and b > g + 50 and b > 150 and r > 120: return 'magenta'
    if (r > 200 and g > 110 and b < 90 and r > g + 40) or (r > 225 and g > 205 and b < 120): return 'fire'
    # skin
    if r > 165 and r > g + 18 and g > b and r - b > 40 and L > 110 and S < 130: return 'skin'
    # reds
    if r > 110 and r > g + 55 and r > b + 45:
        return 'scarf' if hy < 0.55 else 'hilt'
    # golds (guard) / sheen
    if r > 150 and g > 120 and b < 100 and r > b + 70: return 'guard'
    if g > r + 30 and g > b + 10 and g > 150: return 'sheen'
    if r > 180 and b > 170 and g < 160 and r > g + 25: return 'sheen'
    # blues
    if b > r + 28 and b > g + 8 and b > 70:
        if L > 150: return 'skirt' if hy > 0.36 else 'top'
        if hy < 0.30: return 'collar'
        return 'skirt' if L > 58 else ('collar' if hy < 0.5 else 'stock')
    # greys / whites / darks
    if L > 214 and S < 40: return 'top' if hy < 0.52 else ('blade' if hy > 0.78 else 'chrome')
    if L > 130 and S < 60: return ('top' if hy < 0.42 else 'chrome')
    if L > 96 and S < 60: return 'chrome' if hy > 0.42 else 'top'
    if L > 56: return 'chrome' if hy > 0.5 else ('hair' if b >= r else 'skin')
    if L > 36: return 'stock' if hy > 0.55 else 'hair'
    return 'boot' if hy > 0.88 else ('stock' if hy > 0.6 else 'hair')
def is_fx(cls): return cls in FX_RAMPS

def load_cells():
    src = open('../src/sprites-jk.js', encoding='utf-8').read()
    h0 = 'root.SPRITES.jk = '; i = src.index(h0) + len(h0); j = src.rindex('; })')
    return src, i, j, json.loads(src[i:j])

# ---- the cutter's 41-px geometry and masks, kept per cell as 'g41' (packed bits)
def pack(bits):
    out = bytearray((len(bits) + 7) // 8)
    for k, b in enumerate(bits):
        if b: out[k >> 3] |= 1 << (k & 7)
    return base64.b64encode(bytes(out)).decode('ascii')
def unpack(s, n):
    raw = base64.b64decode(s); return [(raw[k >> 3] >> (k & 7)) & 1 == 1 for k in range(n)]
def geom(c):
    if 'g41' not in c:
        w, h = c['w'], c['h']
        fig = Image.frombytes('RGBA', (w, h), base64.b64decode(c['f']))
        eff = Image.frombytes('RGBA', (w, h), base64.b64decode(c['e'])) if c['e'] else None
        c['g41'] = {'w': w, 'h': h, 'ax': c['ax'], 'ay': c['ay'], 'sX': c['sX'], 'sY': c['sY'],
                    'm': pack([p[3] > 0 for p in fig.getdata()]), 'e': pack([p[3] > 0 for p in eff.getdata()]) if eff else None}
    g = c['g41']; n = g['w'] * g['h']
    m = unpack(g['m'], n); e = unpack(g['e'], n) if g['e'] else [False] * n
    return g, [m[y * g['w']:(y + 1) * g['w']] for y in range(g['h'])], [e[y * g['w']:(y + 1) * g['w']] for y in range(g['h'])]

BG = {}
def sheet_bg(tag, sheet):
    if tag not in BG:
        small = sheet.resize((sheet.width // 4, sheet.height // 4))
        BG[tag] = Counter(small.getdata()).most_common(1)[0][0]
    return BG[tag]
def window(sheet, tag, g, X, Y, s=1.0):
    """the source pixels behind sprite pixel (X, Y) (UP-scale coordinates, cell scale s), background dropped"""
    f = CSCALE if tag == 'C' else 1.0
    nx0 = (g['sX'] - g['ax']) / f; ny0 = (g['sY'] - g['ay']) / f
    cx = (nx0 + (X + 0.5) / (f * UP * s)) * GRID; cy = (ny0 + (Y + 0.5) / (f * UP * s)) * GRID
    half = GRID / f / UP / s / 2
    xs = range(max(0, int(cx - half + 0.5)), min(sheet.width, int(cx + half + 0.5)))
    ys = range(max(0, int(cy - half + 0.5)), min(sheet.height, int(cy + half + 0.5)))
    bg = sheet_bg(tag, sheet); keep = []; nbg = 0
    for y in ys:
        for x in xs:
            p = sheet.getpixel((x, y))
            if abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) >= 48: keep.append((x, y, p))
            else: nbg += 1
    return keep, nbg

# ---- affinity segmentation of the source (「學習 affinity」): neighbouring source pixels with a high colour affinity
# (L1 distance ≤ AFF_T) are united into regions (union-find), tiny regions are absorbed by their most similar
# neighbour, and each REGION — not each pixel — gets a material from its mean colour and height, and a tone from
# its mean luminance. Regions are the sheet's own colour clusters, so borders are clean and the shading is the
# cluster shading of the drawing itself.
AFF_T = 34; AFF_MIN = 8
def segment(sheet, tag, coords):
    """coords: the set of source (x, y) the cell's windows touch → {(x, y): region id}, {id: (meanRGB, size, cy)}"""
    if not coords: return {}, {}
    bg = sheet_bg(tag, sheet)
    xs = [q[0] for q in coords]; ys = [q[1] for q in coords]
    X0, Y0, X1, Y1 = max(0, min(xs) - 1), max(0, min(ys) - 1), min(sheet.width - 1, max(xs) + 1), min(sheet.height - 1, max(ys) + 1)
    W = X1 - X0 + 1; H = Y1 - Y0 + 1
    col = {}; ok = {}
    for y in range(Y0, Y1 + 1):
        for x in range(X0, X1 + 1):
            p = sheet.getpixel((x, y)); col[(x, y)] = p
            ok[(x, y)] = abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) >= 48 and lum(p) >= 26 and not is_fx(classify(p, 0.5))
    parent = {}
    def find(a):
        while parent[a] != a: parent[a] = parent[parent[a]]; a = parent[a]
        return a
    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb: parent[rb] = ra
    for q in ok:
        if ok[q]: parent[q] = q
    for (x, y) in list(parent):
        p = col[(x, y)]
        for nb in ((x + 1, y), (x, y + 1)):
            if nb in parent:
                r = col[nb]
                if abs(p[0] - r[0]) + abs(p[1] - r[1]) + abs(p[2] - r[2]) <= AFF_T: union((x, y), nb)
    members = {}
    for q in parent: members.setdefault(find(q), []).append(q)
    # absorb tiny regions into the most similar neighbouring region (by mean colour)
    def mean(ps): return tuple(sum(col[q][k] for q in ps) / len(ps) for k in range(3))
    means = {r: mean(ps) for r, ps in members.items()}
    changed = True
    while changed:
        changed = False
        for r, ps in sorted(members.items(), key=lambda kv: len(kv[1])):
            if len(ps) >= AFF_MIN or r not in members: continue
            nbrs = Counter()
            for (x, y) in ps:
                for nb in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nb in parent:
                        rr = find(nb)
                        if rr != r and rr in members: nbrs[rr] += 1
            if not nbrs: continue
            m = means[r]
            best = min(nbrs, key=lambda rr: sum(abs(means[rr][k] - m[k]) for k in range(3)) - nbrs[rr] * 0.5)
            parent[r] = best; members[best] += ps; del members[r]
            means[best] = mean(members[best]); changed = True
    label = {}; info = {}
    for r, ps in members.items():
        cy = sum(q[1] for q in ps) / len(ps)
        info[r] = (means[r], len(ps), cy)
        for q in ps: label[q] = r
    return label, info

def upscale_mask(m41, w41, h41, s=1.0):
    w, h = max(1, round(w41 * UP * s)), max(1, round(h41 * UP * s))
    return [[m41[min(h41 - 1, int(y / (UP * s)))][min(w41 - 1, int(x / (UP * s)))] for x in range(w)] for y in range(h)], w, h
def to_cell(tag, g, s, sx, sy):
    """source px → cell px (UP-scale coordinates, cell scale s)"""
    f = CSCALE if tag == 'C' else 1.0
    nx0 = (g['sX'] - g['ax']) / f; ny0 = (g['sY'] - g['ay']) / f
    return (sx / GRID - nx0) * f * UP * s - 0.5, (sy / GRID - ny0) * f * UP * s - 0.5
def dilate(m, w, h):
    out = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if any(0 <= x + dx < w and 0 <= y + dy < h and m[y + dy][x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)): out[y][x] = True
    return out

def refine_cell(tag, c, sheet):
    g, m41, e41 = geom(c); w41, h41 = g['w'], g['h']; s = cell_scale(tag, c)
    base, w, h = upscale_mask(m41, w41, h41, s); ebase, _, _ = upscale_mask(e41, w41, h41, s)
    cand = dilate(base, w, h) if UP > 1 else base
    ecand = dilate(ebase, w, h) if UP > 1 else ebase
    # the silhouette from the source: inside the (dilated) cutter mask, a pixel is figure when its window is mostly
    # non-background and not an effect stroke; effect pixels come from the (dilated) effect mask the same way
    win = {}; mask = [[False] * w for _ in range(h)]; emask = [[False] * w for _ in range(h)]; ecls = {}
    for y in range(h):
        for x in range(w):
            if not (cand[y][x] or ecand[y][x]): continue
            keep, nbg = window(sheet, tag, g, x, y, s); win[(x, y)] = keep
            n = len(keep) + nbg
            if n == 0: continue
            fx = Counter(classify(q[2], 0.5) for q in keep if is_fx(classify(q[2], 0.5)))
            nfx = sum(fx.values())
            if ecand[y][x] and nfx >= max(1, n * 0.5) and nfx >= len(keep) * 0.5:
                emask[y][x] = True; ecls[(x, y)] = fx.most_common(1)[0][0]; continue
            if cand[y][x] and len(keep) - nfx >= n * 0.5: mask[y][x] = True
            elif ecand[y][x] and keep and nfx == 0 and len(keep) >= n * 0.5 and base[y][x]: mask[y][x] = True
            elif cand[y][x] and UP == 1 and base[y][x] and keep: mask[y][x] = True
    # the white smear strokes (pale, low saturation) inside the effect mask that the effect classes miss
    for y in range(h):
        for x in range(w):
            if ecand[y][x] and not mask[y][x] and not emask[y][x] and win.get((x, y)):
                pale = [q for q in win[(x, y)] if lum(q[2]) > 150 and sat(q[2]) < 60]
                if len(pale) >= len(win[(x, y)]) * 0.5 and ebase[y][x]: emask[y][x] = True; ecls[(x, y)] = 'white'
    ys = [y for y in range(h) if any(mask[y])]
    if not ys: return None
    top, bot = min(ys), max(ys)
    # affinity regions of the source under the figure; each region → one material (mean colour + centroid height)
    coords = set(q[:2] for (x, y) in win if mask[y][x] for q in win[(x, y)])
    label, info = segment(sheet, tag, coords) if REGIONS else ({}, {})
    src_ys = [q[1] for q in coords]; stop, sbot = (min(src_ys), max(src_ys)) if src_ys else (0, 1)
    rmat = {}
    for r, (mean, size, cy) in info.items():
        hy = (cy - stop) / max(1, sbot - stop)
        rmat[r] = classify(tuple(int(v) for v in mean), min(1, max(0, hy)))
        if is_fx(rmat[r]): rmat[r] = 'line'
    mat = [[None] * w for _ in range(h)]; tone = [[1] * w for _ in range(h)]; lums = {}
    for y in range(h):
        hy = (y - top) / max(1, bot - top)
        for x in range(w):
            if not mask[y][x]: continue
            qs = win.get((x, y), [])
            n = len(qs)
            if not REGIONS:                               # per-pixel majority (the earlier pass)
                blk = [q[2] for q in qs if not is_fx(classify(q[2], hy))]
                if not blk: mat[y][x] = 'line'; lums[(x, y)] = 0; continue
                cls = Counter(classify(p, hy) for p in blk); m = None
                for small in ('skin', 'scarf', 'guard', 'sheen', 'hilt'):
                    if cls.get(small, 0) >= max(2, len(blk) * 0.25): m = small; break
                if m is None: m = cls.most_common(1)[0][0]
                mat[y][x] = m; ls = sorted(lum(p) for p in blk if classify(p, hy) == m)
                lums[(x, y)] = ls[len(ls) // 2] if ls else lum(blk[0]); continue
            regs = Counter(label[q[:2]] for q in qs if q[:2] in label)
            if not regs:                                  # only dark line pixels (or nothing) under this sprite pixel
                blk = [q[2] for q in qs if not is_fx(classify(q[2], hy))]
                mat[y][x] = 'line'; lums[(x, y)] = sorted(lum(p) for p in blk)[len(blk) // 2] if blk else 0; continue
            # small features win at a quarter of the window, otherwise the region covering most of it
            r = None
            for small in ('skin', 'scarf', 'guard', 'sheen', 'hilt'):
                cnt = sum(k for rr, k in regs.items() if rmat[rr] == small)
                if cnt >= max(1, n * 0.25): r = max((rr for rr in regs if rmat[rr] == small), key=lambda rr: regs[rr]); break
            if r is None: r = regs.most_common(1)[0][0]
            # a dark line pixel majority still reads as a line (the sheet's inner outlines)
            dark = sum(1 for q in qs if lum(q[2]) < 26)
            if dark > n * 0.5: mat[y][x] = 'line'; lums[(x, y)] = 0; continue
            mat[y][x] = rmat[r]; lums[(x, y)] = lum(info[r][0])
    # the two legs: split dark (stocking) / light (chrome) per COLUMN of the cell's leg pixels
    legs = [(x, y) for y in range(h) for x in range(w) if mat[y][x] in ('chrome', 'stock')]
    if len(legs) >= 6 * UP:
        colL = {}
        for (x, y) in legs: colL.setdefault(x, []).append(lums[(x, y)])
        colmean = {x: sum(v) / len(v) for x, v in colL.items()}
        vals = sorted(colmean.values()); med = vals[len(vals) // 2]
        if vals[-1] - vals[0] > 16:
            dark = {x: colmean[x] < med for x in colmean}; xs = sorted(dark)
            for _ in range(UP):
                for k in range(1, len(xs) - 1):
                    if dark[xs[k - 1]] == dark[xs[k + 1]] != dark[xs[k]]: dark[xs[k]] = dark[xs[k - 1]]
            for (x, y) in legs: mat[y][x] = 'stock' if dark[x] else 'chrome'
    # tones per material: shade / base / light by the material's own luminance distribution in the cell
    for m in set(v for row in mat for v in row if v):
        if m == 'line': continue
        vals = sorted(lums[(x, y)] for y in range(h) for x in range(w) if mat[y][x] == m)
        if not vals: continue
        lo = vals[int(len(vals) * 0.30)]; hi = vals[int(len(vals) * 0.82)]
        for y in range(h):
            for x in range(w):
                if mat[y][x] == m:
                    L = lums[(x, y)]; tone[y][x] = 0 if L < lo - 1 else (2 if L > hi + 1 else 1)
    # specks: an isolated material pixel takes the majority of its neighbours
    def neigh(x, y):
        return [mat[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < h and mask[y + dy][x + dx]]
    for _ in range(2):
        for y in range(h):
            for x in range(w):
                if not mask[y][x]: continue
                nb = [n for n in neigh(x, y) if n]
                if len(nb) >= 3:
                    cnt = Counter(nb); top_m, n = cnt.most_common(1)[0]
                    if top_m != mat[y][x] and n >= 3 and cnt[mat[y][x]] == 0: mat[y][x] = top_m
    # cluster shading: tone majority inside the material (3×3)
    for _ in range(2):
        nt = [row[:] for row in tone]
        for y in range(h):
            for x in range(w):
                if not mask[y][x] or mat[y][x] == 'line': continue
                same = [tone[y + dy][x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                        if 0 <= x + dx < w and 0 <= y + dy < h and mask[y + dy][x + dx] and mat[y + dy][x + dx] == mat[y][x]]
                if len(same) >= 4:
                    cnt = Counter(same); t, n = cnt.most_common(1)[0]
                    if n >= len(same) * 0.6: nt[y][x] = t
        tone = nt
    # consistent light from the top-left: rim light on the upper / left edge of a region, rim shade lower / right
    if LIGHT_PASS:
        def other(x, y, m):
            return not (0 <= x < w and 0 <= y < h and mask[y][x]) or mat[y][x] != m or mat[y][x] == 'line'
        nt = [row[:] for row in tone]
        for y in range(h):
            for x in range(w):
                m = mat[y][x]
                if not mask[y][x] or m in ('line', 'boot', 'hilt', 'guard', 'sheen'): continue
                lit = other(x - 1, y, m) or other(x, y - 1, m)
                shd = other(x + 1, y, m) or other(x, y + 1, m)
                if lit and not shd and tone[y][x] == 1: nt[y][x] = 2
                elif shd and not lit and tone[y][x] == 1: nt[y][x] = 0
        tone = nt
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); op = out.load()
    for y in range(h):
        for x in range(w):
            if mask[y][x]: op[x, y] = RAMPS[mat[y][x] or 'line'][tone[y][x]] + (255,)
    # the locked outline: 1 px of OUT around the silhouette
    for y in range(h):
        for x in range(w):
            if op[x, y][3]: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and op[nx, ny][3] and op[nx, ny][:3] != OUT:
                    op[x, y] = OUT + (255,); break
    # effects: 3 tones per family, from the source
    eff = None
    if any(any(r) for r in emask):
        eff = Image.new('RGBA', (w, h), (0, 0, 0, 0)); ep = eff.load()
        for y in range(h):
            for x in range(w):
                if not emask[y][x]: continue
                fam = ecls[(x, y)]; ps = win.get((x, y), [])
                L = sorted(lum(q[2]) for q in ps)[len(ps) // 2] if ps else 200
                ramp = FX_RAMPS[fam]; ep[x, y] = ramp[0 if L < 130 else (2 if L > 215 else 1)] + (255,)
    return out, eff, s

def features(im, eye=None):
    """the face: red eye under a dark lash at the measured eye position (analyze_b.py: the dark blob in the sheet's
    face) or, without a measurement, at the front-top of the skin blob; the white streak in the hair in front"""
    px = im.load(); w, h = im.size
    skin = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] and px[x, y][:3] in RAMPS['skin']]
    if len(skin) < 4 * UP: return
    ys = sorted(set(y for _, y in skin)); ytop = ys[0]
    ex = ey = None
    if eye:
        cx, cy = int(round(eye[0])), int(round(eye[1]))
        near = [(x, y) for (x, y) in skin if abs(x - cx) <= 2 * UP and abs(y - cy) <= 2 * UP]
        if near:
            ey = min(near, key=lambda q: abs(q[1] - cy))[1]
            ex = max(x for (x, y) in near if y == ey)
    if ex is None:
        ey = min(ytop + 2 * UP, ys[-1])
        row = [x for (x, y) in skin if y == ey and y <= ytop + 4 * UP]
        if not row: return
        ex = max(row)
    if UP == 1:
        px[ex, ey] = (196, 44, 62, 255)
        if ey - 1 >= 0 and px[ex, ey - 1][3] and px[ex, ey - 1][:3] in RAMPS['skin']: px[ex, ey - 1] = OUT + (255,)
        streak = ((ex + 1, ey - 2), (ex, ey - 3), (ex + 1, ey - 3))
    else:   # 82 px: a 2-px lash, the iris (red) with a dark pupil behind it, a 2-px streak
        for x in (ex - 1, ex):
            if x >= 0 and px[x, ey - 1][3]: px[x, ey - 1] = OUT + (255,)
        px[ex, ey] = (196, 44, 62, 255)
        if ex - 1 >= 0 and px[ex - 1, ey][3]: px[ex - 1, ey] = OUT + (255,)
        streak = ((ex + 1, ey - 3), (ex + 2, ey - 3), (ex + 1, ey - 4), (ex, ey - 5), (ex + 1, ey - 5))
    for (x, y) in streak:
        if 0 <= x < w and 0 <= y < h and px[x, y][3] and px[x, y][:3] in RAMPS['hair']: px[x, y] = (214, 218, 228, 255)

def main():
    review_only = 'review' in sys.argv
    src, i, j, data = load_cells()
    sheets = {t: Image.open(SHEETS[t]).convert('RGB') for t in SHEETS}
    before, after = [], []
    for tag in ('A', 'B', 'C'):
        for c in data[tag]:
            g = geom(c)[0]
            res = refine_cell(tag, c, sheets[tag])
            if not res: continue
            out, eff, s = res
            a = ANALYSIS['cells'].get('%s%d' % (tag, c['i'])); eye = None
            if a and a.get('eye'):
                eye = to_cell(tag, g, s, a['srcBox'][0] + a['eye']['x'], a['srcBox'][1] + a['eye']['y'])
            features(out, eye)
            w, h = out.size
            before.append(Image.frombytes('RGBA', (c['w'], c['h']), base64.b64decode(c['f'])))
            after.append(out)
            if not review_only:
                c['w'], c['h'] = w, h
                c['ax'] = int(round((g['ax'] + 0.5) * UP * s - 0.5)); c['ay'] = int(round((g['ay'] + 1) * UP * s - 1))
                c['sX'] = int(round(g['sX'] * UP * s)); c['sY'] = int(round(g['sY'] * UP * s)); c['scale'] = round(s, 4)
                c['f'] = base64.b64encode(out.tobytes()).decode('ascii')
                c['e'] = base64.b64encode(eff.tobytes()).decode('ascii') if eff else None
                c['refined'] = 2; c['res'] = UP
                op = out.load()
                xs = [x for y in range(h) for x in range(w) if op[x, y][3]]; ys = [y for y in range(h) for x in range(w) if op[x, y][3]]
                c['fig'] = [min(xs) - c['ax'], min(ys) - c['ay'], max(xs) - c['ax'], max(ys) - c['ay']] if xs else None
                if eff:
                    ep = eff.load()
                    xs = [x for y in range(h) for x in range(w) if ep[x, y][3]]; ys = [y for y in range(h) for x in range(w) if ep[x, y][3]]
                    c['eff'] = [min(xs) - c['ax'], min(ys) - c['ay'], max(xs) - c['ax'], max(ys) - c['ay']] if xs else None
                    c['ne'] = len(xs)
                else: c['eff'] = None; c['ne'] = 0
                out.save(os.path.join('art', 'cells', '%s%d.png' % (tag, c['i'])))
    if not review_only:
        open('../src/sprites-jk.js', 'w', encoding='utf-8', newline='\n').write(src[:i] + json.dumps(data) + src[j:])
        print('rewrote src/sprites-jk.js', sum(len(data[t]) for t in ('A', 'B', 'C')), 'cells refined at UP', UP)
    S = 6 // UP * 2 if UP > 1 else 6
    sel = list(range(0, len(after), max(1, len(after) // 40)))[:40]
    W = sum(after[k].width * S + 6 for k in sel) + 6
    H = max(before[k].height * S * (UP if before[k].height * UP <= after[k].height else 1) for k in sel) + max(after[k].height for k in sel) * S + 30
    sheet = Image.new('RGBA', (W, H), (121, 139, 141, 255)); x = 6
    for k in sel:
        b, a = before[k], after[k]; sb = S * max(1, a.height // b.height)
        sheet.alpha_composite(b.resize((b.width * sb, b.height * sb), Image.NEAREST), (x, 6))
        sheet.alpha_composite(a.resize((a.width * S, a.height * S), Image.NEAREST), (x, 18 + b.height * sb))
        x += a.width * S + 6
    sheet.save(os.path.join('art', 'refine2_review.png')); print('review', sheet.size)

if __name__ == '__main__': main()
