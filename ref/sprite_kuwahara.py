# -*- coding: utf-8 -*-
"""sprite_kuwahara.py [N] [R] [tag:X] [dry] — 「角色照動作圖分析去精細畫」: the cells still carry the AI sheets' painterly
speckle inside every material (ref/art/sprite_blocks.png: our per-band edge density and colour count stay above the clean
pixel reference's after the material transfer). A Kuwahara filter in Oklab (radius R, default 2; radius 1 over the head so
the eyes and mouth keep their pixels) replaces each pixel by the mean of its least-varied quadrant — the noise inside a
region goes, the edges between regions stay — then pixelclean.clean re-quantises to N colours (default 56) with the
ΔE-guarded despeckle. Effect layers ('e') are untouched. Backup: ref/art/sprites-jk-smooth.js (the cells before this pass).
Review: ref/art/sprite_kuwahara_review.png = before | after | the reference, for V0, A5, C3."""
import os, sys, math, shutil
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
sys_argv = sys.argv[1:]; sys.argv = [sys.argv[0]]
import pixelclean as pc   # helpers only (its main() is guarded)
r2 = pc.r2
nums = [int(a) for a in sys_argv if a.isdigit()]
N = nums[0] if nums else 56; R = nums[1] if len(nums) > 1 else 2
ONLY = [a.split(':')[1] for a in sys_argv if a.startswith('tag:')]
DRY = 'dry' in sys_argv
SRC, BACK = '../src/sprites-jk.js', 'art/sprites-jk-smooth.js'
to_oklab, from_oklab = pc.to_oklab, pc.from_oklab

def native_reference():   # the user's pixel full-body brought back to its 3-px grid (as in sprite_blocks.py)
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

def kuwahara(im):
    """Kuwahara in Oklab over the opaque pixels; radius 1 in the head band (the top 22 % of the figure), R elsewhere."""
    w, h = im.size; px = im.load(); lab = {}
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 255: lab[(x, y)] = to_oklab(px[x, y][:3])
    if len(lab) < 20: return im, 0
    ys = [y for (_, y) in lab]; top = min(ys); head = top + int((max(ys) - top) * 0.22)
    out = im.copy(); op = out.load(); changed = 0
    for (x, y), l0 in lab.items():
        r = 1 if y < head else R; best = None
        for (dx0, dx1, dy0, dy1) in ((-r, 0, -r, 0), (0, r, -r, 0), (-r, 0, 0, r), (0, r, 0, r)):
            s0 = s1 = s2 = 0.0; q0 = q1 = q2 = 0.0; n = 0
            for dy in range(dy0, dy1 + 1):
                for dx in range(dx0, dx1 + 1):
                    l = lab.get((x + dx, y + dy))
                    if l is None: continue
                    n += 1; s0 += l[0]; s1 += l[1]; s2 += l[2]; q0 += l[0] * l[0]; q1 += l[1] * l[1]; q2 += l[2] * l[2]
            if n < 3: continue
            m0, m1, m2 = s0 / n, s1 / n, s2 / n
            var = (q0 / n - m0 * m0) + (q1 / n - m1 * m1) + (q2 / n - m2 * m2)
            if best is None or var < best[0]: best = (var, (m0, m1, m2))
        if best is None: continue
        c = from_oklab(best[1])
        if c[:3] != px[x, y][:3]: changed += 1
        op[x, y] = (c[0], c[1], c[2], 255)
    return out, changed

if not os.path.exists(BACK): shutil.copy(SRC, BACK); print('backup', BACK)
head, data, tail = pc.load(SRC)
tags = [t for t in ('A', 'B', 'C', 'V') if t in data and (not ONLY or t in ONLY)]
if DRY:
    im = pc.cell_image([c for c in data['V'] if c['i'] == 0][0]); out, n = kuwahara(im); print('dry: V0 changed', n, 'of', im.width * im.height); sys.exit(0)
pc.DE = 0.10
review = {}
for tag in tags:
    st = {'err': 0.0, 'spk': 0, 'cols': 0, 'n': 0}; kn = 0
    for c in data[tag]:
        if c.get('enc') not in ('prle', 'prla'): continue
        im = pc.cell_image(c); out, n = kuwahara(im); kn += n
        cl = pc.clean(out, N, st)
        c['f'] = r2.prle(cl); c['enc'] = 'prla'; c['clean'] = N; c['kuwa'] = R
        cl.save(os.path.join('art', 'cells', '%s%d.png' % (tag, c['i'])))
        key = '%s%d' % (tag, c['i'])
        if key in ('V0', 'A5', 'C3'): review[key] = (im, cl)
    print('%s: %d cells, kuwahara %.0f px/cell, palette err %.1f, despeckled %.1f px/cell, %.0f colours/cell' % (tag, st['n'], kn / max(1, st['n']), st['err'] / max(1, st['n']), st['spk'] / max(1, st['n']), st['cols'] / max(1, st['n'])))
pc.save(SRC, head, data, tail); print('wrote', SRC, '%.2f MB' % (os.path.getsize(SRC) / 1e6))
ref = native_reference(); Z = 3; rows = [(k, review[k][0], review[k][1]) for k in ('V0', 'A5', 'C3') if k in review]
sheet = Image.new('RGB', (10 + 3 * (80 * Z + 10), sum(r[1].height * Z + 24 for r in rows) + 10), (30, 34, 70)); d = ImageDraw.Draw(sheet); y = 5
for key, a, b in rows:
    h = a.height; k = h / ref.height; rs = ref.resize((max(1, round(ref.width * k)), h), Image.LANCZOS); x = 5
    for im in (a, b, rs):
        bg = Image.new('RGBA', im.size, (30, 34, 70, 255)); bg.alpha_composite(im); big = bg.convert('RGB').resize((im.width * Z, im.height * Z), Image.NEAREST); sheet.paste(big, (x, y + 18)); x += 80 * Z + 10
    d.text((5, y), key + ': before | after | reference', fill=(255, 230, 120)); y += h * Z + 24
sheet.save('art/sprite_kuwahara_review.png'); print('review art/sprite_kuwahara_review.png')
