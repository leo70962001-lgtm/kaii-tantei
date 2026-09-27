# -*- coding: utf-8 -*-
"""make_cg2.py — the character-select pictures from the two pictures the user sent (「這2張」):
 ref/cg/jk_pixel_full.jpg (an upscaled pixel-art full body on black)  → src/cg/jk_icon.png  (the round icon: the head at
   the picture's own pixel grid, 48×48, background transparent)
 ref/cg/jk_render_full.jpg (the 3D render on black)                    → src/cg/jk_bust.png  (354×540 bust, head to waist,
   background flood-filled to transparent, the bottom faded, 96 colours like the previous bust)
Also writes ref/cg/cg2_preview.png. Pure PIL."""
import collections
from PIL import Image, ImageFilter

# ---------------------------------------------------------------- the icon
src = Image.open('ref/cg/jk_pixel_full.jpg').convert('RGB'); W, H = src.size; px = src.load()
dark = lambda c: c[0] + c[1] + c[2] < 60
# the figure's bounding box
xs = [x for x in range(W) for y in range(0, H, 4) if not dark(px[x, y])]; ys = [y for y in range(H) for x in range(0, W, 4) if not dark(px[x, y])]
bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys); print('figure box', bx0, by0, bx1, by1)
# the pixel grid: the most common run length of same-colour horizontal runs inside the figure
runs = collections.Counter()
for y in range(by0, by1, 3):
    x = bx0;
    while x < bx1:
        c = px[x, y]; n = 1
        while x + n < bx1 and max(abs(px[x + n, y][i] - c[i]) for i in range(3)) < 14: n += 1
        if 2 <= n <= 12: runs[n] += 1
        x += n
best = max(runs, key=lambda k: runs[k] * (1 if k < 3 else 1.5)); print('run lengths', runs.most_common(6), '-> pixel size', best)
S = best
# sample the centre of each grid cell (phase chosen to minimise mixed cells)
def sample(ox, oy):
    w, h = (W - ox) // S, (H - oy) // S; out = Image.new('RGB', (w, h)); op = out.load(); bad = 0
    for j in range(h):
        for i in range(w):
            cx, cy = ox + i * S + S // 2, oy + j * S + S // 2; c = px[cx, cy]; op[i, j] = c
            if S >= 3 and max(abs(px[cx + 1, cy][k] - c[k]) for k in range(3)) > 40: bad += 1
    return out, bad
cands = [(sample(ox, oy), ox, oy) for ox in range(S) for oy in range(S)]
(native, bad), ox, oy = min(cands, key=lambda t: t[0][1]); print('phase', ox, oy, 'mixed cells', bad, 'native size', native.size)
npx = native.load(); nw, nh = native.size
# the head: the top of the figure down to the chin ≈ the top 17 % of the figure's height; centre on the skin pixels
fy0, fy1 = by0 // S, by1 // S; head_h = int((fy1 - fy0) * 0.17)
skin = [(x, y) for y in range(fy0 + int(head_h * 0.2), fy0 + int(head_h * 0.7)) for x in range(nw) if (lambda c: c[0] > 150 and c[1] > 100 and c[2] > 80 and c[0] > c[2] + 25 and c[0] - c[1] < 90)(npx[x, y])]   # the face, not the neck
scx = sum(p[0] for p in skin) // max(1, len(skin)); scy = sum(p[1] for p in skin) // max(1, len(skin)); print('face centre', scx, scy, 'of', len(skin), 'head rows', fy0, fy0 + head_h)
IC = 48; icon = Image.new('RGBA', (IC, IC), (0, 0, 0, 0)); ip = icon.load()
x0, y0 = scx - IC // 2 + 2, fy0 + 4   # the crown of the head 4 px below the icon's top edge, the face centred
for j in range(IC):
    for i in range(IC):
        x, y = x0 + i, y0 + j
        if 0 <= x < nw and 0 <= y < nh and not dark(npx[x, y]): ip[i, j] = npx[x, y] + (255,)
icon.save('src/cg/jk_icon.png'); print('icon saved 48x48')

# ---------------------------------------------------------------- the bust
ren = Image.open('ref/cg/jk_render_full.jpg').convert('RGB'); RW, RH = ren.size; rp = ren.load()
rxs = [x for x in range(RW) for y in range(0, RH, 4) if not dark(rp[x, y])]; rys = [y for y in range(RH) for x in range(0, RW, 4) if not dark(rp[x, y])]
rx0, rx1, ry0, ry1 = min(rxs), max(rxs), min(rys), max(rys); print('render box', rx0, ry0, rx1, ry1)
BW, BH = 354, 540
crop_h = int((ry1 - ry0) * 0.52); crop_w = int(crop_h * BW / BH)   # head to the waist: the top 52 % of the figure
top = max(0, ry0 - int(crop_h * 0.03))
# centre the crop on the head (the skin pixels in the top 15 % of the figure)
hs = [x for y in range(ry0, ry0 + int((ry1 - ry0) * 0.15)) for x in range(rx0, rx1) if (lambda c: c[0] > 120 and c[0] > c[2] + 30 and c[1] > 70)(rp[x, y])]
hcx = sum(hs) // max(1, len(hs)); left = max(0, min(RW - crop_w, hcx - crop_w // 2)); print('bust crop', left, top, crop_w, crop_h, 'head centre', hcx)
bust = ren.crop((left, top, left + crop_w, top + crop_h)).resize((BW, BH), Image.LANCZOS).convert('RGBA')
bp = bust.load()
# flood the black background from the borders to transparent (tolerance keeps the dark hair)
seen = set(); stack = [(x, 0) for x in range(BW)] + [(x, BH - 1) for x in range(BW)] + [(0, y) for y in range(BH)] + [(BW - 1, y) for y in range(BH)]
while stack:
    x, y = stack.pop()
    if (x, y) in seen or not (0 <= x < BW and 0 <= y < BH): continue
    seen.add((x, y)); c = bp[x, y]
    if c[0] + c[1] + c[2] > 54: continue
    bp[x, y] = (0, 0, 0, 0); stack.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
# soften the cut edge one pixel in, fade the bottom 70 px
for y in range(BH):
    for x in range(BW):
        if bp[x, y][3] == 255 and any(0 <= x + dx < BW and 0 <= y + dy < BH and bp[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): bp[x, y] = bp[x, y][:3] + (160,)
for y in range(BH - 70, BH):
    a = int(255 * (BH - y) / 70)
    for x in range(BW): bp[x, y] = bp[x, y][:3] + (min(bp[x, y][3], a),)
rgb = bust.convert('RGB').quantize(96, method=Image.Quantize.MEDIANCUT).convert('RGB'); alpha = bust.split()[3]
out = rgb.convert('RGBA'); out.putalpha(alpha); out.save('src/cg/jk_bust.png'); print('bust saved', out.size)

# ---------------------------------------------------------------- preview
prev = Image.new('RGB', (BW + 48 * 4 + 40, BH + 20), (40, 40, 60)); prev.paste(out, (10, 10), out)
big = icon.resize((48 * 4, 48 * 4), Image.NEAREST); prev.paste(big, (BW + 30, 10), big); prev.save('ref/cg/cg2_preview.png'); print('preview ref/cg/cg2_preview.png')
