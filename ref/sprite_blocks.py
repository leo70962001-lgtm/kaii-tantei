# -*- coding: utf-8 -*-
"""sprite_blocks.py [cell.png ...] — 「動作的點圖也更小塊地分析精緻化」: compare our sprite cells with the pixel full-body the
user sent (ref/cg/jk_pixel_full.jpg, an upscaled pixel art on a 3-px grid) block by block. The reference is brought back
to its native grid, scaled to the cell's figure height, and both are cut into the same bands (hair, face/collar, torso,
skirt, thighs, calves, boots); each band reports its dominant colours (Oklab k-means 5), mean luminance, contrast and
edge density, and the sheet ref/art/sprite_blocks.png shows ours | ref | palettes per band. Default cell: V0 (idle)."""
import os, sys, math, collections
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
sys.argv = [sys.argv[0]] + [a for a in sys.argv[1:]]
# the Oklab helpers copied from pixelclean.py (importing that module would run its main())
import random
LIN = [((v / 255) / 12.92 if v / 255 <= 0.04045 else ((v / 255 + 0.055) / 1.055) ** 2.4) for v in range(256)]
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


class pc: pass
pc.d2 = d2


def native_reference():
    src = Image.open('cg/jk_pixel_full.jpg').convert('RGB'); W, H = src.size; px = src.load(); S = 3
    dark = lambda c: c[0] + c[1] + c[2] < 60
    def sample(ox, oy):
        w, h = (W - ox) // S, (H - oy) // S; out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); op = out.load(); bad = 0
        for j in range(h):
            for i in range(w):
                cx, cy = ox + i * S + 1, oy + j * S + 1; c = px[cx, cy]
                if not dark(c): op[i, j] = c + (255,)
                if max(abs(px[cx + 1, cy][k] - c[k]) for k in range(3)) > 40: bad += 1
        return out, bad
    best = min((sample(ox, oy) for ox in range(S) for oy in range(S)), key=lambda t: t[1])[0]
    return best
def figure_box(im):
    px = im.load(); w, h = im.size
    xs = [x for y in range(h) for x in range(w) if px[x, y][3] > 0]; ys = [y for y in range(h) for x in range(w) if px[x, y][3] > 0]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1
BANDS = [('hair/head', 0.0, 0.17), ('face+collar', 0.10, 0.27), ('torso', 0.27, 0.43), ('skirt', 0.43, 0.60), ('thighs', 0.60, 0.74), ('calves', 0.74, 0.92), ('boots', 0.92, 1.0)]
def band_stats(im, box, f0, f1):
    x0, y0, x1, y1 = box; H = y1 - y0; ya, yb = y0 + int(H * f0), y0 + int(H * f1); px = im.load()
    pts = [px[x, y][:3] for y in range(ya, yb) for x in range(x0, x1) if px[x, y][3] > 0]
    if len(pts) < 10: return None
    labs = [to_oklab(p) for p in pts]; seeds = labs[:: max(1, len(labs) // 5)][:5]
    cents = kmeans(labs, 5, seeds, 8); cnt = collections.Counter(min(range(5), key=lambda i: pc.d2(l, cents[i])) for l in labs)
    pal = [(tuple(int(v) for v in from_oklab(cents[i])), cnt[i] / len(labs)) for i in sorted(cnt, key=lambda i: -cnt[i])]
    L = [l[0] for l in labs]; meanL = sum(L) / len(L); std = math.sqrt(sum((v - meanL) ** 2 for v in L) / len(L))
    edges = 0; n = 0
    for y in range(ya, yb - 1):
        for x in range(x0, x1 - 1):
            if px[x, y][3] == 0: continue
            n += 1
            for q in (px[x + 1, y], px[x, y + 1]):
                if q[3] and sum(abs(q[i] - px[x, y][i]) for i in range(3)) > 90: edges += 1; break
    widths = [sum(1 for x in range(x0, x1) if px[x, y][3] > 0) for y in range(ya, yb)]
    return {'pal': pal, 'L': round(meanL, 3), 'std': round(std, 3), 'edge': round(edges / max(1, n), 3), 'w': round(sum(widths) / len(widths) / (x1 - x0), 2), 'rows': (ya, yb)}

cells = [a for a in sys.argv[1:] if a.endswith('.png')] or ['art/cells/V0.png']
ref = native_reference(); rbox = figure_box(ref); rh = rbox[3] - rbox[1]
sheet_rows = []
for cell in cells:
    ours = Image.open(cell).convert('RGBA'); obox = figure_box(ours); oh = obox[3] - obox[1]
    k = oh / rh; ref_s = ref.crop(rbox).resize((max(1, round((rbox[2] - rbox[0]) * k)), oh), Image.LANCZOS); rsbox = (0, 0, ref_s.width, ref_s.height)
    print('==', cell, 'figure', obox, 'ref figure scaled to', ref_s.size)
    for name, f0, f1 in BANDS:
        a, b = band_stats(ours, obox, f0, f1), band_stats(ref_s, rsbox, f0, f1)
        if not a or not b: continue
        print('%-12s ours L %.2f std %.2f edge %.2f w %.2f | ref L %.2f std %.2f edge %.2f w %.2f' % (name, a['L'], a['std'], a['edge'], a['w'], b['L'], b['std'], b['edge'], b['w']))
        print('             ours %s' % ' '.join('#%02x%02x%02x %d%%' % (c[0], c[1], c[2], round(s * 100)) for c, s in a['pal'][:4]))
        print('             ref  %s' % ' '.join('#%02x%02x%02x %d%%' % (c[0], c[1], c[2], round(s * 100)) for c, s in b['pal'][:4]))
        sheet_rows.append((cell, name, ours.crop((obox[0], a['rows'][0], obox[2], a['rows'][1])), ref_s.crop((0, b['rows'][0], ref_s.width, b['rows'][1])), a['pal'], b['pal']))
# the sheet: per band, ours ×3 | ref ×3 | colour bars
Z = 3; rowh = max(r[2].height for r in sheet_rows) * Z + 8; sheet = Image.new('RGB', (900, rowh * len(sheet_rows) + 10), (24, 24, 32)); d = ImageDraw.Draw(sheet); y = 5
for cell, name, oc, rc, pa, pb in sheet_rows:
    for i, (im, pal) in enumerate(((oc, pa), (rc, pb))):
        big = im.resize((im.width * Z, im.height * Z), Image.NEAREST); x = 10 + i * 300; sheet.paste(big, (x, y), big)
        bx = x + big.width + 6
        for c, s in pal: w = max(4, int(80 * s)); d.rectangle([bx, y, bx + w, y + 14], fill=c); bx += w + 1
    d.text((610, y), '%s %s' % (os.path.basename(cell), name), fill=(230, 230, 240)); y += rowh
sheet.save('art/sprite_blocks.png'); print('sheet art/sprite_blocks.png')
