# affinity_pack.py — an Affinity / Photopea-ready analysis package of sheet B (the baseline) in ref/art/affinity/:
#   sheetB_grid.png     the sheet with the 4-px sampling grid (every 8 px stronger) and each cell's box + index
#   sheetB_materials.png the per-pixel material classification of the sheet (one flat colour per material)
#   sheetB_regions.png  the affinity regions (segment(): random colour per region) for the cells
#   palette.png         the material ramps used in the game (shade / base / light) with hex values, plus the measured ones
#   cells_82.png        every refined 82-px cell laid out with its index (what the game draws)
# Open these as layers in Affinity (File → Place / drag onto the sheet, set the layer blend to Normal, 100 %) to
# inspect the grid alignment, the material borders and the colours, or to paint corrections; PNG is lossless.
import os, sys, json, base64, random
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import importlib.util
sys.argv = [sys.argv[0], 'x2']
spec = importlib.util.spec_from_file_location('r2', 'refine2.py'); r2 = importlib.util.module_from_spec(spec); spec.loader.exec_module(r2)
OUTD = os.path.join('art', 'affinity'); os.makedirs(OUTD, exist_ok=True)
src, i, j, data = r2.load_cells()
sheet = Image.open(r2.SHEETS['B']).convert('RGB'); W, H = sheet.size
MAT_COL = {'hair': (40, 40, 80), 'skin': (240, 200, 170), 'top': (240, 240, 250), 'collar': (60, 80, 150), 'scarf': (220, 50, 70),
           'skirt': (90, 110, 180), 'chrome': (180, 190, 210), 'stock': (70, 70, 90), 'boot': (30, 30, 50), 'blade': (255, 255, 230),
           'hilt': (200, 60, 90), 'guard': (230, 200, 90), 'sheen': (160, 240, 170), 'line': (10, 10, 20),
           'cyan': (90, 230, 240), 'magenta': (240, 100, 230), 'fire': (255, 160, 60), 'white': (200, 220, 255)}
# 1. grid + cell boxes
g = sheet.copy(); d = ImageDraw.Draw(g, 'RGBA')
for x in range(0, W, 4): d.line([(x, 0), (x, H)], fill=(255, 255, 255, 70 if x % 8 else 130))
for y in range(0, H, 4): d.line([(0, y), (W, y)], fill=(255, 255, 255, 70 if y % 8 else 130))
for c in data['B']:
    a = r2.ANALYSIS['cells'].get('B%d' % c['i'])
    if not a: continue
    x0, y0, x1, y1 = a['srcBox']; d.rectangle([x0, y0, x1, y1], outline=(255, 80, 80, 255)); d.text((x0 + 2, y0 + 2), 'B%d %.2f' % (c['i'], a['rel']), fill=(255, 255, 0, 255))
    d.line([(x0, a['feetY']), (x1, a['feetY'])], fill=(80, 255, 120, 255))
    if a.get('eye'): d.ellipse([x0 + a['eye']['x'] - 2, y0 + a['eye']['y'] - 2, x0 + a['eye']['x'] + 2, y0 + a['eye']['y'] + 2], outline=(255, 0, 0, 255))
g.save(os.path.join(OUTD, 'sheetB_grid.png'))
# 2. material map of the whole sheet (height fraction from each cell's box; outside the cells: 0.5)
bg = r2.sheet_bg('B', sheet); px = sheet.load(); m = Image.new('RGB', (W, H), bg); mp = m.load()
boxes = [(v['srcBox']) for k, v in r2.ANALYSIS['cells'].items() if k[0] == 'B']
for y in range(H):
    for x in range(W):
        p = px[x, y]
        if abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) < 48: continue
        hy = 0.5
        for (x0, y0, x1, y1) in boxes:
            if x0 <= x <= x1 and y0 <= y <= y1: hy = (y - y0) / max(1, y1 - y0); break
        mp[x, y] = MAT_COL.get(r2.classify(p, hy), (255, 0, 255))
m.save(os.path.join(OUTD, 'sheetB_materials.png'))
# 3. affinity regions per cell
rg = Image.new('RGB', (W, H), bg); rp = rg.load(); random.seed(7)
for c in data['B']:
    a = r2.ANALYSIS['cells'].get('B%d' % c['i'])
    if not a: continue
    x0, y0, x1, y1 = a['srcBox']
    coords = set((x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1))
    label, info = r2.segment(sheet, 'B', coords)
    cols = {}
    for q, r in label.items():
        if r not in cols: cols[r] = tuple(random.randint(60, 250) for _ in range(3))
        rp[q] = cols[r]
rg.save(os.path.join(OUTD, 'sheetB_regions.png'))
# 4. palette swatches
names = [k for k in r2.PIC_PAL if k != 'line']; SW = 46; pal = Image.new('RGB', (SW * 3 * 2 + 200, SW * len(names) + 30), (40, 40, 48)); d = ImageDraw.Draw(pal)
d.text((6, 6), 'game (picture) ramps        measured on the sheets', fill=(255, 255, 255))
for r, nm in enumerate(names):
    y = 30 + r * SW; d.text((6, y + 14), nm, fill=(255, 255, 255))
    for k, col in enumerate(r2.PIC_PAL[nm]):
        d.rectangle([80 + k * SW, y, 80 + (k + 1) * SW - 2, y + SW - 2], fill=col); d.text((80 + k * SW + 2, y + SW - 14), '#%02x%02x%02x' % col, fill=(0, 0, 0) if sum(col) > 380 else (255, 255, 255))
    for k, col in enumerate(r2.SHEET_PAL[nm]):
        x = 100 + SW * 3 + k * SW; d.rectangle([x, y, x + SW - 2, y + SW - 2], fill=col); d.text((x + 2, y + SW - 14), '#%02x%02x%02x' % col, fill=(0, 0, 0) if sum(col) > 380 else (255, 255, 255))
pal.save(os.path.join(OUTD, 'palette.png'))
# 5. the refined cells atlas
cells = [(t, c) for t in ('A', 'B', 'C') for c in data[t]]
cw = max(c['w'] for _, c in cells) + 6; ch = max(c['h'] for _, c in cells) + 14; cols_n = 12; rows_n = (len(cells) + cols_n - 1) // cols_n
atlas = Image.new('RGBA', (cw * cols_n, ch * rows_n), (121, 139, 141, 255)); d = ImageDraw.Draw(atlas)
for k, (t, c) in enumerate(cells):
    im = Image.frombytes('RGBA', (c['w'], c['h']), base64.b64decode(c['f']))
    if c.get('e'):
        ef = Image.frombytes('RGBA', (c['w'], c['h']), base64.b64decode(c['e'])); im.alpha_composite(ef)
    x = (k % cols_n) * cw + 3; y = (k // cols_n) * ch + 12
    atlas.alpha_composite(im, (x, y)); d.text((x, y - 11), '%s%d' % (t, c['i']), fill=(255, 255, 0, 255))
    d.line([(x + c['ax'] - 3, y + c['ay']), (x + c['ax'] + 3, y + c['ay'])], fill=(255, 60, 60, 255))
atlas.save(os.path.join(OUTD, 'cells_82.png'))
print('affinity package written to', OUTD, [f for f in os.listdir(OUTD)])
