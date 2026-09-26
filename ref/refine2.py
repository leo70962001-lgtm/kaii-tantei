# refine2.py — precise re-analysis of the Gemini action sheets + a "16-bit RPG sprite" clean-up of every sheet cell.
#
# Findings (grid_analysis.py): the three sheets have NO true pixel grid (the gradient autocorrelation peaks at 1 px —
# they are AI "pixel-look" paintings), so the 4-px block average that cells.py/pixelize.py used mixes neighbouring
# pseudo-pixels and leaves JPEG mud. Here every sprite pixel is re-derived from its 4×4 (C: 2.9×2.9) block of SOURCE
# pixels: each source pixel is first classified into a MATERIAL (hair, skin, top, collar, scarf, skirt, chrome leg,
# stocking, boot, blade, hilt, guard, line) using colour + the pixel's height on the figure, the block takes the
# majority material, and its tone is the block's median luminance mapped onto that material's fixed 3-shade ramp
# (light source top-left; ramps from the standing picture). Then, after the infographic the user sent
# ("How to draw a 16-bit RPG sprite"): silhouette first (the cell's figure mask), 1-px locked dark outline, 3–5 shades
# per area, cluster shading (a 3×3 majority pass on tones inside each material — no dithering / gradients), simple
# face (red eye 1 px under a dark lash, the white streak), no half pixels. Effects (the sheet's cyan / magenta / fire
# strokes) are re-quantised to 3 tones each and kept on their own layer.
#
#   python refine2.py            rewrites src/sprites-jk.js (A/B/C cells; H cells untouched), exports ref/art/cells/
#   python refine2.py review     only writes ref/art/refine2_review.png (a strip of cells before / after, ×6)
import os, sys, json, base64, math
from collections import Counter
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw

SHEETS = {'A': 'jk_actions2.jpg', 'B': 'jk_actions3.jpg', 'C': 'jk_actions4.jpg'}
GRID = 4.0
CSCALE = 41 / 30                                       # sheet C's figures are 30 px on its grid; cells were resampled to 41
OUT = (14, 12, 24)
LIGHT_PASS = 'nolight' not in sys.argv                 # consistent top-left rim light / bottom-right shade (see below)

# ---- material ramps (shade, base, light) from the standing picture / hand.py palette
RAMPS = {
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

def load_cells():
    src = open('../src/sprites-jk.js', encoding='utf-8').read()
    h0 = 'root.SPRITES.jk = '; i = src.index(h0) + len(h0); j = src.rindex('; })')
    return src, i, j, json.loads(src[i:j])

BG = {}
def sheet_bg(tag, sheet):
    """the sheet's background colour (its most common colour)"""
    if tag not in BG:
        small = sheet.resize((sheet.width // 4, sheet.height // 4))
        BG[tag] = Counter(small.getdata()).most_common(1)[0][0]
    return BG[tag]
def block_source(sheet, tag, c, X, Y):
    """the source pixels behind sprite pixel (X, Y) of the cell, background pixels dropped"""
    f = CSCALE if tag == 'C' else 1.0
    nx0 = (c['sX'] - c['ax']) / f; ny0 = (c['sY'] - c['ay']) / f
    cx = (nx0 + (X + 0.5) / f) * GRID; cy = (ny0 + (Y + 0.5) / f) * GRID
    half = GRID / f / 2
    xs = range(max(0, int(cx - half + 0.5)), min(sheet.width, int(cx + half + 0.5)))
    ys = range(max(0, int(cy - half + 0.5)), min(sheet.height, int(cy + half + 0.5)))
    bg = sheet_bg(tag, sheet)
    return [p for p in (sheet.getpixel((x, y)) for y in ys for x in xs) if abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) >= 48]

def refine_cell(tag, c, sheet):
    w, h = c['w'], c['h']
    fig = Image.frombytes('RGBA', (w, h), base64.b64decode(c['f'])); fp = fig.load()
    eff = Image.frombytes('RGBA', (w, h), base64.b64decode(c['e'])) if c['e'] else None
    ep = eff.load() if eff else None
    # the silhouette = the cell's figure mask (from the cutter); its vertical extent gives the height fraction
    mask = [[fp[x, y][3] > 0 for x in range(w)] for y in range(h)]
    ys = [y for y in range(h) if any(mask[y])]
    if not ys: return None
    top, bot = min(ys), max(ys)
    mat = [[None] * w for _ in range(h)]; tone = [[1] * w for _ in range(h)]; lums = {}
    for y in range(h):
        hy = (y - top) / max(1, bot - top)
        for x in range(w):
            if not mask[y][x]: continue
            blk = block_source(sheet, tag, c, x, y)
            if not blk: mat[y][x] = 'line'; continue
            cls = Counter(classify(p, hy) for p in blk)
            n = sum(cls.values())
            # small features win the block when they hold a quarter of it (the face, the scarf, the guard, the sheen)
            m = None
            for small in ('skin', 'scarf', 'guard', 'sheen', 'hilt'):
                if cls.get(small, 0) >= max(2, n * 0.25): m = small; break
            if m is None:
                nonfx = [k for k in cls if k not in FX_RAMPS]
                m = max(nonfx, key=lambda k: cls[k]) if nonfx else 'line'
            mat[y][x] = m
            ls = sorted(lum(p) for p in blk if classify(p, hy) == m)
            lums[(x, y)] = ls[len(ls) // 2] if ls else lum(blk[0])
    # the two legs: the sheet draws the stocking leg dark and the chrome leg light, but both sit in the same grey-blue
    # band, so split the cell's leg pixels at their own luminance median (dark half → stocking, light half → chrome)
    # — decided per COLUMN (the legs stand side by side; a kicking chrome leg spans its own columns), smoothed
    legs = [(x, y) for y in range(h) for x in range(w) if mat[y][x] in ('chrome', 'stock')]
    if len(legs) >= 6:
        colL = {}
        for (x, y) in legs: colL.setdefault(x, []).append(lums[(x, y)])
        colmean = {x: sum(v) / len(v) for x, v in colL.items()}
        vals = sorted(colmean.values()); med = vals[len(vals) // 2]
        if vals[-1] - vals[0] > 16:
            dark = {x: colmean[x] < med for x in colmean}
            xs = sorted(dark)
            for k in range(1, len(xs) - 1):                      # a lone column between two of the other kind joins them
                if dark[xs[k - 1]] == dark[xs[k + 1]] != dark[xs[k]]: dark[xs[k]] = dark[xs[k - 1]]
            for (x, y) in legs: mat[y][x] = 'stock' if dark[x] else 'chrome'
    # tones: per material, split the block luminances into shade / base / light by the material's own distribution
    for m in set(v for row in mat for v in row if v):
        if m == 'line': continue
        vals = sorted(lums[(x, y)] for y in range(h) for x in range(w) if mat[y][x] == m)
        if not vals: continue
        lo = vals[int(len(vals) * 0.30)]; hi = vals[int(len(vals) * 0.82)]
        for y in range(h):
            for x in range(w):
                if mat[y][x] == m:
                    L = lums[(x, y)]; tone[y][x] = 0 if L < lo - 1 else (2 if L > hi + 1 else 1)
    # lines that came out as single dark specks inside a material become that material (the sheet's JPEG noise);
    # materials that are isolated single pixels take the majority of their 4 neighbours (silhouette-first, no specks)
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
    # cluster shading: a tone majority inside the material (3×3), so shades form clusters instead of dithering
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
    # consistent light from the top-left (2D game art 101): inside each material region a pixel whose upper or left
    # neighbour is another material / the outline / outside is lit (base → light), one whose lower or right neighbour
    # is gets the shade (base → shade); pixels the sheet already shaded keep their tone. Only for regions ≥ 3 px wide.
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
                inner = not other(x - 1, y, m) and not other(x + 1, y, m)
                if lit and not shd and tone[y][x] == 1: nt[y][x] = 2
                elif shd and not lit and tone[y][x] == 1: nt[y][x] = 0
        tone = nt
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); op = out.load()
    for y in range(h):
        for x in range(w):
            if not mask[y][x]: continue
            m = mat[y][x] or 'line'
            op[x, y] = RAMPS[m][tone[y][x]] + (255,)
    # the locked outline: 1 px of OUT around the silhouette (outside), plus a line between hair/skin and the face's
    # front edge where the sheet had dark pixels (already 'line' material)
    for y in range(h):
        for x in range(w):
            if op[x, y][3]: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and op[nx, ny][3] and op[nx, ny][:3] != OUT:
                    op[x, y] = OUT + (255,); break
    # effects: 3 tones per family
    if eff:
        for y in range(h):
            for x in range(w):
                p = ep[x, y]
                if not p[3]: continue
                fam = classify(p, 0.5)
                if fam not in FX_RAMPS: fam = 'white' if lum(p) > 150 else 'cyan'
                L = lum(p); ramp = FX_RAMPS[fam]
                ep[x, y] = ramp[0 if L < 130 else (2 if L > 215 else 1)] + (255,)
    return out, eff

def features(im, c):
    """the face: red eye under a dark lash at the front-top of the skin blob, the streak in the hair in front of it"""
    px = im.load(); w, h = im.size
    skin = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] and px[x, y][:3] in RAMPS['skin']]
    if len(skin) < 4: return
    ys = sorted(set(y for _, y in skin)); ytop = ys[0]
    face = [(x, y) for (x, y) in skin if y <= ytop + 4]
    if not face: return
    # the eye: the front-most skin pixel 2 rows under the skin top
    row = [x for (x, y) in face if y == min(ytop + 2, ys[-1])]
    if not row: return
    ex, ey = max(row), min(ytop + 2, ys[-1])
    px[ex, ey] = (196, 44, 62, 255)
    if ey - 1 >= 0 and px[ex, ey - 1][3] and px[ex, ey - 1][:3] in RAMPS['skin']: px[ex, ey - 1] = OUT + (255,)
    # the streak: the hair pixels just in front / above the eye
    for (x, y) in ((ex + 1, ey - 2), (ex, ey - 3), (ex + 1, ey - 3)):
        if 0 <= x < w and 0 <= y < h and px[x, y][3] and px[x, y][:3] in RAMPS['hair']: px[x, y] = (214, 218, 228, 255)

def main():
    review_only = 'review' in sys.argv
    src, i, j, data = load_cells()
    sheets = {t: Image.open(SHEETS[t]).convert('RGB') for t in SHEETS}
    before, after = [], []
    for tag in ('A', 'B', 'C'):
        for c in data[tag]:
            res = refine_cell(tag, c, sheets[tag])
            if not res: continue
            out, eff = res
            features(out, c)
            w, h = c['w'], c['h']
            before.append(Image.frombytes('RGBA', (w, h), base64.b64decode(c['f'])))
            after.append(out)
            if not review_only:
                c['f'] = base64.b64encode(out.tobytes()).decode('ascii')
                c['e'] = base64.b64encode(eff.tobytes()).decode('ascii') if eff else None
                c['refined'] = 2
                xs = [x for y in range(h) for x in range(w) if out.getpixel((x, y))[3]]
                ys = [y for y in range(h) for x in range(w) if out.getpixel((x, y))[3]]
                if xs: c['fig'] = [min(xs) - c['ax'], min(ys) - c['ay'], max(xs) - c['ax'], max(ys) - c['ay']]
                out.save(os.path.join('art', 'cells', '%s%d.png' % (tag, c['i'])))
    if not review_only:
        open('../src/sprites-jk.js', 'w', encoding='utf-8', newline='\n').write(src[:i] + json.dumps(data) + src[j:])
        print('rewrote src/sprites-jk.js', sum(len(data[t]) for t in ('A', 'B', 'C')), 'cells refined')
    # review strip: before (top) / after (bottom), ×6, the first 24 cells of each sheet
    S = 6; sel = list(range(0, len(after), max(1, len(after) // 40)))[:40]
    W = sum(after[k].width * S + 6 for k in sel) + 6; H = max(after[k].height for k in sel) * S * 2 + 30
    sheet = Image.new('RGBA', (W, H), (121, 139, 141, 255)); x = 6
    for k in sel:
        b, a = before[k], after[k]
        sheet.alpha_composite(b.resize((b.width * S, b.height * S), Image.NEAREST), (x, 6))
        sheet.alpha_composite(a.resize((a.width * S, a.height * S), Image.NEAREST), (x, 18 + b.height * S))
        x += a.width * S + 6
    sheet.save(os.path.join('art', 'refine2_review.png')); print('review', sheet.size)

if __name__ == '__main__': main()
