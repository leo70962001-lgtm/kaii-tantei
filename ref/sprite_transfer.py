# -*- coding: utf-8 -*-
"""sprite_transfer.py [N] [tag:V] [dry] — 「動作的點圖也更小塊地分析精緻化」, the refinement after ref/sprite_blocks.py:
our cells (src/sprites-jk.js, 164 px, 64 colours) are duller, flatter and noisier than the pixel full-body the user sent.
Per MATERIAL (skin / red / blue cloth / white cloth / chrome / dark), the cells' Oklab statistics are moved toward the
reference's (a Reinhard-style transfer: the mean shifts 60 % of the way, the spread stretches up to 1.5×), so every action
frame gets the reference's deeper shadows, brighter highlights and bluer skirt without re-drawing; then a second, slightly
looser despeckle and a re-quantisation to N colours (default 56) keep the pixel discipline. Backup: ref/art/sprites-jk-v64.js.
Review: ref/art/sprite_transfer_review.png (before | after | reference) for V0, A5, C3."""
import os, sys, math, shutil, collections
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
sys_argv = sys.argv[1:]; sys.argv = [sys.argv[0]]
import pixelclean as pc   # helpers only (main() is guarded)
r2 = pc.r2
N = next((int(a) for a in sys_argv if a.isdigit()), 56)
ONLY = [a.split(':')[1] for a in sys_argv if a.startswith('tag:')]
DRY = 'dry' in sys_argv
SRC, BACK = '../src/sprites-jk.js', 'art/sprites-jk-v64.js'
to_oklab, from_oklab = pc.to_oklab, pc.from_oklab

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
    return min((sample(ox, oy) for ox in range(S) for oy in range(S)), key=lambda t: t[1])[0]

def material(lab):   # the classes both pictures share, by Oklab lightness / chroma / hue
    L, a, b = lab; C = math.hypot(a, b)
    if a > 0.12 and b > 0.02: return 'red'                       # the scarf, the sword's wrap, the iris
    if L > 0.5 and a > 0.025 and b > 0.02 and C < 0.14: return 'skin'
    if b < -0.03 and C > 0.03 and L > 0.25: return 'blue'        # the skirt, the collar, the hair's sheen (our skirt is desaturated, so the class is wide)
    if L < 0.33: return 'dark'                                   # hair, boots, stockings, outlines
    if C < 0.045 and L > 0.72: return 'white'                    # the blouse
    if C < 0.06: return 'chrome'                                 # the arm and leg
    return 'other'
CLASSES = ['skin', 'red', 'blue', 'white', 'chrome', 'dark', 'other']

def stats(labs_by_class):
    out = {}
    for k, labs in labs_by_class.items():
        if len(labs) < 30: continue
        n = len(labs); mu = [sum(l[i] for l in labs) / n for i in range(3)]
        sd = [math.sqrt(sum((l[i] - mu[i]) ** 2 for l in labs) / n) for i in range(3)]
        out[k] = (mu, sd, n)
    return out

ref = native_reference(); rp = ref.load(); rl = collections.defaultdict(list)
for y in range(ref.height):
    for x in range(ref.width):
        if rp[x, y][3]: l = to_oklab(rp[x, y][:3]); rl[material(l)].append(l)
RS = stats(rl)
if not os.path.exists(BACK): shutil.copy(SRC, BACK); print('backup', BACK)
head, data, tail = pc.load(SRC)
tags = [t for t in ('A', 'B', 'C', 'V') if t in data and (not ONLY or t in ONLY)]
cells = [(t, c) for t in tags for c in data[t] if c.get('enc') in ('prle', 'prla')]
ims = {id(c): pc.cell_image(c) for _, c in cells}
ol = collections.defaultdict(list)
for _, c in cells:
    im = ims[id(c)]; px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] == 255: l = to_oklab(px[x, y][:3]); ol[material(l)].append(l)
OS = stats(ol)
print('%-7s %8s %8s | %6s %6s %6s -> %6s %6s %6s | spread ours -> ref' % ('class', 'ours px', 'ref px', 'L', 'a', 'b', 'L', 'a', 'b'))
XF = {}
for k in CLASSES:
    if k not in OS or k not in RS or k == 'other': continue   # 'other' (effects, glows) is left alone
    (mo, so, no), (mr, sr, nr) = OS[k], RS[k]
    gain = [max(1.0, min(1.5, sr[i] / so[i])) if so[i] > 1e-4 else 1.0 for i in range(3)]
    XF[k] = (mo, mr, gain)
    print('%-7s %8d %8d | %6.3f %6.3f %6.3f -> %6.3f %6.3f %6.3f | %.2f %.2f %.2f' % (k, no, nr, mo[0], mo[1], mo[2], mr[0], mr[1], mr[2], gain[0], gain[1], gain[2]))
SMOOTH = 'smooth' in sys_argv
BLEND = 0.0 if SMOOTH else 0.6
if SMOOTH: XF = {k: (mo, mr, [1.0, 1.0, 1.0]) for k, (mo, mr, g) in XF.items()}   # identity: the transfer already happened
def class_median(im):   # inside one material, a pixel that differs from its 3×3 neighbours of the same class takes their median colour
    px = im.load(); w, h = im.size; labs = {}; cls = {}
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 255: l = to_oklab(px[x, y][:3]); labs[(x, y)] = l; cls[(x, y)] = material(l)
    out = im.copy(); op = out.load(); changed = 0
    for (x, y), l in labs.items():
        k = cls[(x, y)]; nb = [labs[(x + dx, y + dy)] for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and (x + dx, y + dy) in labs and cls[(x + dx, y + dy)] == k]
        if len(nb) < 5: continue
        med = tuple(sorted(v[i] for v in nb)[len(nb) // 2] for i in range(3))
        dist = math.sqrt(pc.d2(l, med)); same = sum(1 for v in nb if math.sqrt(pc.d2(l, v)) < 0.03)
        if same <= 1 and 0.03 < dist < 0.16: op[x, y] = from_oklab(med) + (255,); changed += 1
    return out, changed
def transfer(rgb):
    l = to_oklab(rgb); k = material(l)
    if k not in XF: return rgb
    mo, mr, g = XF[k]
    out = [mo[i] + (l[i] - mo[i]) * g[i] + (mr[i] - mo[i]) * BLEND for i in range(3)]
    out[0] = max(0.0, min(1.0, out[0]))
    return from_oklab(out)
if DRY: sys.exit(0)
pc.DE = 0.11   # the second despeckle a little looser than the first pass (0.085)
review = {}
for tag in tags:
    st = {'err': 0.0, 'spk': 0, 'cols': 0, 'n': 0}; cache = {}
    for c in data[tag]:
        if c.get('enc') not in ('prle', 'prla'): continue
        im = ims[id(c)]; px = im.load(); out = Image.new('RGBA', im.size, (0, 0, 0, 0)); op = out.load()
        for y in range(im.height):
            for x in range(im.width):
                p = px[x, y]
                if not p[3]: continue
                if p[:3] not in cache: cache[p[:3]] = transfer(p[:3])
                op[x, y] = cache[p[:3]] + (p[3],)
        if SMOOTH: out, nch = class_median(out); st['med'] = st.get('med', 0) + nch
        cl = pc.clean(out, N, st)
        c['f'] = r2.prle(cl); c['enc'] = 'prla'; c['clean'] = N; c['xfer'] = 1
        cl.save(os.path.join('art', 'cells', '%s%d.png' % (tag, c['i'])))
        key = '%s%d' % (tag, c['i'])
        if key in ('V0', 'A5', 'C3'): review[key] = (im, cl)
    print('%s: %d cells, palette err %.1f, despeckled %.1f px/cell, median %.1f px/cell, %.0f colours/cell' % (tag, st['n'], st['err'] / max(1, st['n']), st['spk'] / max(1, st['n']), st.get('med', 0) / max(1, st['n']), st['cols'] / max(1, st['n'])))
pc.save(SRC, head, data, tail); print('wrote', SRC, '%.2f MB' % (os.path.getsize(SRC) / 1e6))
# the review sheet: before | after | the reference scaled to the cell's figure height
Z = 3; rows = []
for key in ('V0', 'A5', 'C3'):
    if key not in review: continue
    a, b = review[key]; rows.append((key, a, b))
rh = ref.height
sheet = Image.new('RGB', (10 + 3 * (80 * Z + 10), sum(r[1].height * Z + 24 for r in rows) + 10), (30, 34, 70)); d = ImageDraw.Draw(sheet); y = 5
for key, a, b in rows:
    h = a.height; k = h / rh; rs = ref.resize((max(1, round(ref.width * k)), h), Image.LANCZOS)
    x = 5
    for im in (a, b, rs):
        bg = Image.new('RGBA', im.size, (30, 34, 70, 255)); bg.alpha_composite(im); big = bg.convert('RGB').resize((im.width * Z, im.height * Z), Image.NEAREST); sheet.paste(big, (x, y + 18)); x += 80 * Z + 10
    d.text((5, y), key + ': before | after | reference', fill=(255, 230, 120)); y += h * Z + 24
sheet.save('art/sprite_transfer_review%s.png' % ('_smooth' if SMOOTH else '')); print('review art/sprite_transfer_review.png')
