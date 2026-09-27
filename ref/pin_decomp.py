# -*- coding: utf-8 -*-
"""pin_decomp.py <picture> <out_prefix> — 「把場景圖抓下來分析跟分解學習」: decompose a reference picture into what a
pixel stage needs: its palette (global and per depth band), layer masks (sky / blossoms / dark structure / warm light /
the rest) with their share per horizontal band, the measured proportions of the store front (sign band, lintel, glass,
door, vending machines) in metres from the door's 2 m, and a sheet of zoomed details. Pure PIL (no numpy).
Outputs <out_prefix>_sheet.png (the decomposition sheet), <out_prefix>_masks.png, <out_prefix>_measure.json."""
import sys, json, collections
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); W, H = im.size; px = im.load()
lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

# ---- layer masks by colour rules
def classify(c):
    r, g, b = c; l = lum(c)
    if l < 58: return 'dark'                                   # trunk, pole, wires, shadows
    if r > 150 and r > b + 18 and r - g > 28 and b > 90 and b >= g - 8: return 'blossom'   # pink petals and blossom masses (pink: blue not below green)
    if b > r + 18 and b >= g and l > 55: return 'sky'          # the teal-blue dusk sky and blue-lit surfaces
    if r > 170 and g > 120 and r > b + 30 and g > b + 12: return 'warm'   # the store's light on goods, floor and ground (orange: green above blue)
    if g > r + 20 and g > b + 8 and g > 90: return 'green'      # the vending machine, grass
    return 'mid'
CLASSES = ['sky', 'blossom', 'dark', 'warm', 'green', 'mid']
COLS = {'sky': (40, 120, 220), 'blossom': (255, 120, 180), 'dark': (20, 20, 40), 'warm': (255, 190, 80), 'green': (60, 200, 90), 'mid': (150, 150, 160)}
mask = Image.new('RGB', (W, H)); mp = mask.load(); cls = [[None] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        k = classify(px[x, y]); cls[y][x] = k; mp[x, y] = COLS[k]
mask.save(out + '_masks.png')

# ---- shares per horizontal band (10 bands) and overall
bands = 10; prof = []
for bi in range(bands):
    y0, y1 = H * bi // bands, H * (bi + 1) // bands; cnt = collections.Counter()
    for y in range(y0, y1):
        for x in range(W): cnt[cls[y][x]] += 1
    n = (y1 - y0) * W; prof.append({k: round(cnt[k] / n, 3) for k in CLASSES})
overall = collections.Counter()
for y in range(H):
    for x in range(W): overall[cls[y][x]] += 1
overall = {k: round(v / (W * H), 3) for k, v in overall.items()}

# ---- palettes: global 16 colours, and 8 per depth band (top third / middle / bottom)
def palette(img, n):
    q = img.quantize(n, method=Image.Quantize.MEDIANCUT); pal = q.getpalette()[:n * 3]
    cnt = collections.Counter(q.getdata()); tot = sum(cnt.values())
    return [('#%02x%02x%02x' % tuple(pal[i * 3:i * 3 + 3]), round(cnt[i] / tot, 3)) for i in sorted(cnt, key=lambda i: -cnt[i])]
pal_all = palette(im, 16)
pal_bands = {name: palette(im.crop((0, y0, W, y1)), 8) for name, (y0, y1) in [('far', (0, H // 3)), ('mid', (H // 3, 2 * H // 3)), ('near', (2 * H // 3, H))]}

# ---- the store front's proportions (rows found by colour: steel-blue sign band, coral lintel, warm glass, beige floor, green machine)
def rows_where(pred, x0, x1, minfrac):
    out_rows = []
    for y in range(H):
        n = sum(1 for x in range(x0, x1) if pred(px[x, y]))
        if n >= (x1 - x0) * minfrac: out_rows.append(y)
    return out_rows
def runs(rows, gap=3):
    rr = []
    for y in rows:
        if rr and y - rr[-1][1] <= gap: rr[-1][1] = y
        else: rr.append([y, y])
    return rr
mid_x0, mid_x1 = int(W * 0.35), int(W * 0.65)
sign = [r for r in runs(rows_where(lambda c: c[2] > c[0] + 25 and 90 < lum(c) < 185 and c[1] > c[0], mid_x0, mid_x1, 0.45)) if H * 0.2 < r[0] < H * 0.5]
lintel = [r for r in runs(rows_where(lambda c: c[0] > 180 and c[1] < 130 and c[2] < 130, mid_x0, mid_x1, 0.3)) if H * 0.25 < r[0] < H * 0.5]
warm_rows = runs(rows_where(lambda c: classify(c) == 'warm', mid_x0, mid_x1, 0.35))
def cols_where(pred, y0, y1, minfrac):
    out_cols = []
    for x in range(W):
        n = sum(1 for y in range(y0, y1) if pred(px[x, y]))
        if n >= (y1 - y0) * minfrac: out_cols.append(x)
    return out_cols
def biggest(rr): return max(rr, key=lambda r: r[1] - r[0]) if rr else None
sign_r, lintel_r = biggest(sign), biggest(lintel)
glass_top = lintel_r[1] + 1 if lintel_r else None
floor = runs(rows_where(lambda c: c[0] > 170 and c[1] > 120 and c[2] < 150 and c[0] > c[2] + 40 and abs(c[0] - c[1]) < 70, int(W * 0.45), int(W * 0.6), 0.5))
floor_r = biggest([r for r in floor if glass_top and glass_top < r[0] < H * 0.75]) if floor else None
glass_bottom = floor_r[1] if floor_r else None
door_cols = runs(cols_where(lambda c: c[0] > 170 and c[1] > 120 and c[2] < 150 and c[0] > c[2] + 40, glass_bottom - 40, glass_bottom, 0.5), 6) if glass_bottom else []
door_c = biggest(door_cols)
green_cols = runs(cols_where(lambda c: classify(c) == 'green', H // 3, 2 * H // 3, 0.25), 6)
green_c = biggest(green_cols)
green_rows = runs(rows_where(lambda c: classify(c) == 'green', green_c[0], green_c[1], 0.5)) if green_c else []
green_r = biggest(green_rows)
measure = { 'size': [W, H], 'overall': overall, 'profile': prof, 'sign_band': sign_r, 'lintel': lintel_r, 'glass': [glass_top, glass_bottom], 'door_cols': door_c, 'vending_cols': green_c, 'vending_rows': green_r }
if glass_top and glass_bottom:
    door_h = glass_bottom - glass_top; pxm = door_h / 2.0   # the doorway = 2 m
    measure['px_per_m'] = round(pxm, 1)
    measure['metres'] = { 'sign_band_h': round((sign_r[1] - sign_r[0]) / pxm, 2) if sign_r else None, 'lintel_h': round((lintel_r[1] - lintel_r[0]) / pxm, 2) if lintel_r else None,
                          'glass_h': round(door_h / pxm, 2), 'door_w': round((door_c[1] - door_c[0]) / pxm, 2) if door_c else None,
                          'vending_w': round((green_c[1] - green_c[0]) / pxm, 2) if green_c else None, 'vending_h': round((green_r[1] - green_r[0]) / pxm, 2) if green_r else None,
                          'picture_w': round(W / pxm, 1), 'store_front_from_top_frac': round(glass_top / H, 2) }
json.dump(measure, open(out + '_measure.json', 'w'), indent=1)
print(json.dumps({k: measure[k] for k in ['overall', 'sign_band', 'lintel', 'glass', 'door_cols', 'vending_cols', 'vending_rows']}))
print('px_per_m', measure.get('px_per_m'), measure.get('metres'))

# ---- the sheet: picture | masks | band profile ; palettes ; zoomed details
SW = 400; scale = SW / W; SH = int(H * scale)
sheet = Image.new('RGB', (SW * 3 + 40, SH + 420), (24, 24, 32)); d = ImageDraw.Draw(sheet)
sheet.paste(im.resize((SW, SH)), (10, 10)); sheet.paste(mask.resize((SW, SH)), (SW + 20, 10))
# band profile as stacked bars
bx = 2 * SW + 30
for bi, p in enumerate(prof):
    y0 = 10 + int(SH * bi / bands); y1 = 10 + int(SH * (bi + 1) / bands); x = bx
    for k in CLASSES:
        w = int(SW * p[k]); d.rectangle([x, y0, x + w, y1 - 2], fill=COLS[k]); x += w
    d.text((bx + 4, y0 + 2), '%d%% sky %d%% pink %d%% dark %d%% warm' % (p['sky'] * 100, p['blossom'] * 100, p['dark'] * 100, p['warm'] * 100), fill=(255, 255, 255))
# palettes
py0 = SH + 20
def strip(x, y, pal, label):
    d.text((x, y), label, fill=(230, 230, 240)); x0 = x
    for hexc, sh in pal:
        w = max(8, int(300 * sh)); c = tuple(int(hexc[i:i + 2], 16) for i in (1, 3, 5)); d.rectangle([x0, y + 12, x0 + w, y + 40], fill=c); x0 += w + 1
strip(10, py0, pal_all, 'palette 16 (global)')
for i, (name, pal) in enumerate(pal_bands.items()): strip(10, py0 + 50 + i * 50, pal, 'palette 8: ' + name)
# zoomed details: blossom + twig, bark, sign lettering, ground petals
def zoom(box, k):
    c = im.crop(box); return c.resize((c.width * k, c.height * k), Image.NEAREST)
dets = [((int(W * 0.45), int(H * 0.12), int(W * 0.62), int(H * 0.22)), 'blossom + twigs'), ((int(W * 0.05), int(H * 0.32), int(W * 0.2), int(H * 0.42)), 'bark'),
        ((int(W * 0.3), int(H * 0.30), int(W * 0.6), int(H * 0.36)), 'sign lettering'), ((int(W * 0.35), int(H * 0.86), int(W * 0.6), int(H * 0.94)), 'ground petals')]
zx = 360
for box, label in dets:
    z = zoom(box, 2); z = z.resize((min(z.width, 400), int(z.height * min(z.width, 400) / z.width)))
    sheet.paste(z, (zx, py0 + 14)); d.text((zx, py0), label, fill=(230, 230, 240)); zx += z.width + 10
    if zx > sheet.width - 200: break
sheet.save(out + '_sheet.png'); print('sheet', out + '_sheet.png')
