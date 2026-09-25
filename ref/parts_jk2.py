# parts_jk2.py — puppet parts from the user's two Gemini "exploded" sheets (ref/jk_parts_a.jpg = head, torso,
# sleeves, steel arm, skirt, sheathed katana; ref/jk_parts_b.jpg = long hair, pelvis + both legs, katana):
# every part is drawn separately there, so nothing has to be inpainted. The sheets sit on a 5.76 px grid and
# come out at twice the game's world scale, so each part carries res: 2 (2 part pixels = 1 world pixel) and
# the puppet renders them at the finer density. Pivots / tips are in part pixels.
# Writes src/jk-parts.js and ref/jk2_parts_review.png.   python parts_jk2.py
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import extract as E

A = Image.open('jkp_a_native.png').convert('RGBA'); B = Image.open('jkp_b_native.png').convert('RGBA')
OUT = (14, 12, 24)
def lum(p): return E.lum(p)
def sat(p): return E.sat(p)
def opaque(p): return max(p[:3]) >= 14
def skin(p): return E.is_skin(p)
def hairc(p): return lum(p) < 60 and sat(p) < 45

def grab(src, box, keep=None):
    """copy a box of a sheet (black background → transparent)"""
    x0, y0, x1, y1 = box; w, h = x1 - x0 + 1, y1 - y0 + 1
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); px = im.load(); sp = src.load()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            p = sp[x, y]
            if not opaque(p): continue
            if keep and not keep(x, y, p): continue
            px[x - x0, y - y0] = p[:3] + (255,)
    return im

def outline(im):
    """outline against the outside only; despeckle"""
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] and lum(p) <= 34: px[x, y] = OUT + (255,)
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and not any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): px[x, y] = (0, 0, 0, 0)
    outside = [[False] * w for _ in range(h)]; st = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while st:
        x, y = st.pop()
        if x < 0 or y < 0 or x >= w or y >= h or outside[y][x] or px[x, y][3]: continue
        outside[y][x] = True; st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    edge = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] and any(not (0 <= x + dx < w and 0 <= y + dy < h) or outside[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for (x, y) in edge: px[x, y] = OUT + (255,)
    return im

def cap(im, pivot, rows=(2, 4)):
    px = im.load(); w, h = im.size; cx, cy = pivot
    span = [x for r in rows for x in range(w) if 0 <= cy + r < h and px[x, cy + r][3]]
    if not span: return
    rad = max(2, (max(span) - min(span) + 1) // 2)
    cols = [px[x, cy + r][:3] for r in rows for x in range(w) if 0 <= cy + r < h and px[x, cy + r][3] and lum(px[x, cy + r]) > 40]
    if not cols: return
    col = max(set(cols), key=cols.count); mx = (max(span) + min(span)) // 2
    for y in range(cy - rad, cy + rad + 1):
        for x in range(mx - rad, mx + rad + 1):
            if 0 <= x < w and 0 <= y < h and (x - mx) ** 2 + (y - cy) ** 2 <= rad * rad and not px[x, y][3]: px[x, y] = col + (255,)

parts = {}
def put(name, im, pivot, tip=None, capped=False):
    if capped: cap(im, pivot)
    outline(im)
    d = {'w': im.width, 'h': im.height, 'd': base64.b64encode(im.tobytes()).decode('ascii'), 'pivot': list(pivot), 'res': 2, 'name': name}
    if tip: d['tip'] = list(tip)
    parts[name] = d; im.save('part2_%s.png' % name); return im

def rel(box, pt): return [pt[0] - box[0], pt[1] - box[1]]

# ---- head (sheet A): face and the hair down to the shoulders; hangs from the neck
box = (36, 0, 92, 50); head = grab(A, box)
put('head', head, rel(box, (73, 44)))
def variant(name, paint):
    im = head.copy(); px = im.load(); paint(px)
    d = dict(parts['head']); d['d'] = base64.b64encode(im.tobytes()).decode('ascii'); d['name'] = name; parts[name] = d; im.save('part2_%s.png' % name)
def paint_hurt(px):
    # eyes shut: the eye rows (sheet y 20–25, x 62–80) become skin with a dark lash line
    sk = px[72 - 36, 28][:3] if px[72 - 36, 28][3] else (240, 192, 170)
    for y in range(19, 26):
        for x in range(60 - 36, 81 - 36):
            if px[x, y][3] and not hairc(px[x, y]): px[x, y] = sk + (255,)
    for x in range(63 - 36, 71 - 36): px[x, 23] = OUT + (255,)
    for x in range(74 - 36, 80 - 36): px[x, 23] = OUT + (255,)
def paint_shout(px):
    for x in range(69 - 36, 74 - 36):
        for y in (31, 32, 33): px[x, y] = (96, 22, 34, 255)
    for x in range(70 - 36, 73 - 36): px[x, 32] = (150, 40, 52, 255)
variant('headHurt', paint_hurt); variant('headShout', paint_shout)

# ---- back hair (sheet B): the left-flowing mass in two hanging pieces
box = (28, 42, 64, 80); im = grab(B, box, keep=lambda x, y, p: hairc(p) and not (x >= 60 and y < 52))
put('hairB1', im, rel(box, (62, 45)), rel(box, (46, 78)))
box = (26, 76, 66, 112); im = grab(B, box, keep=lambda x, y, p: hairc(p))
put('hairB2', im, rel(box, (46, 78)))

# ---- torso (sheet A): sleeveless top; the bare far arm painted on its right side is masked out
box = (44, 54, 92, 108); im = grab(A, box)
px = im.load(); w, h = im.size
for y in range(h):
    for x in range(w):
        if x + box[0] >= 82 and 60 <= y + box[1] <= 98 and px[x, y][3] and skin(px[x, y]): px[x, y] = (0, 0, 0, 0)
m = E.mask(im, lambda x, y, p: p[3] == 0 and x + box[0] >= 82 and 60 <= y + box[1] <= 98)
E.inpaint(im, m, 'left')
put('torso', im, rel(box, (70, 108)))

# ---- skirt (sheet A): the waist band and the pleats, joined across the sheet's cut gap
band = grab(A, (42, 106, 108, 122)); low = grab(A, (42, 126, 108, 150))
im = Image.new('RGBA', (67, 41), (0, 0, 0, 0)); im.alpha_composite(band, (0, 0)); im.alpha_composite(low, (0, 17))
put('skirt', im, [70 - 42, 108 - 106])

# ---- steel arm (sheet A): sleeve + upper arm, forearm, fist
box = (16, 46, 40, 88); put('uArmN', grab(A, box), rel(box, (28, 52)), rel(box, (30, 86)))
box = (12, 84, 36, 110); put('fArmN', grab(A, box), rel(box, (30, 86)), rel(box, (24, 108)), capped=True)
box = (8, 106, 30, 126); put('handN', grab(A, box), rel(box, (24, 108)))
# far arm: its sleeve (sheet A); the skin forearm and hand are drawn by the rig at run time
box = (100, 46, 124, 80); put('uArmF', grab(A, box), rel(box, (112, 52)), rel(box, (112, 82)))

# ---- legs (sheet B): complete from the pelvis; the pelvis is split between the two thighs
box = (48, 117, 74, 182); put('thighF', grab(B, box, keep=lambda x, y, p: not (y < 162 and x > 73) and not (x <= 56 and E.is_skirt(p))), rel(box, (60, 132)), rel(box, (62, 178)))
box = (48, 174, 74, 226); put('shinF', grab(B, box, keep=lambda x, y, p: not (x <= 56 and E.is_skirt(p))), rel(box, (62, 178)), rel(box, (60, 224)), capped=True)
box = (46, 220, 76, 241); put('footF', grab(B, box), rel(box, (60, 224)))
box = (72, 122, 94, 182); put('thighN', grab(B, box, keep=lambda x, y, p: not (y < 162 and x < 74)), rel(box, (82, 132)), rel(box, (84, 180)))
box = (72, 176, 96, 228); put('shinN', grab(B, box), rel(box, (84, 180)), rel(box, (84, 226)), capped=True)
box = (70, 224, 102, 241); put('footN', grab(B, box), rel(box, (84, 226)))

# ---- katana (sheet B): hilt and guard as drawn, the blade rebuilt from one clean cross-section so the
# scabbard lying across it leaves no gap; turned to point +x with the pivot at the grip
def katana(blade_rows):
    hilt = grab(B, (103, 56, 118, 100)); sec = grab(B, (103, 104, 118, 105))
    tip = grab(B, (103, 186, 118, 193))
    im = Image.new('RGBA', (16, 45 + blade_rows + (8 if blade_rows else 0)), (0, 0, 0, 0))
    im.alpha_composite(hilt, (0, 0))
    for r in range(blade_rows): im.alpha_composite(sec.crop((0, 0, 16, 1)), (0, 45 + r))
    if blade_rows: im.alpha_composite(tip, (0, 45 + blade_rows))
    im = im.transpose(Image.ROTATE_90)   # blade down → blade right
    return im
for name, rows in (('sword', 86), ('swordShort', 30), ('hilt', 0)):
    im = katana(rows)
    # pivot: the grip sat at (110, 78) on the sheet = column 7, row 22 of the upright strip; after ROTATE_90
    # (counter-clockwise) upright (x, y) → (y, W - 1 - x) with W = 16
    put(name, im, [22, 16 - 1 - 7], [im.width - 1, 16 - 1 - 7] if rows else None)

# ---- write
js = ('// jk-parts.js — cutout-puppet parts from the two Gemini exploded sheets (ref/jk_parts_a.jpg, ref/jk_parts_b.jpg,\n'
      '// cut by ref/parts_jk2.py): RGBA base64 at twice the world scale (res: 2), pivot = the joint the part hangs\n'
      '// from, tip = its far joint (limbs / the sword point), in part pixels. Facing +x.\n'
      '(function (root) { root.CAST = root.CAST || {}; root.CAST.jkParts = ' + json.dumps(parts) + '; })(typeof window !== "undefined" ? window : globalThis);\n')
open(os.path.join('..', 'src', 'jk-parts.js'), 'w', encoding='utf-8').write(js)
S = 3
ims = [(n, Image.open('part2_%s.png' % n)) for n in parts]
W = sum(im.width * S + 10 for _, im in ims) + 10; H = max(im.height for _, im in ims) * S + 30
sheet = Image.new('RGBA', (W, H), (60, 70, 85, 255)); d = ImageDraw.Draw(sheet); x = 10
for n, im in ims:
    sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, 20))
    p = parts[n]['pivot']; d.rectangle([x + p[0] * S, 20 + p[1] * S, x + p[0] * S + S, 20 + p[1] * S + S], outline=(255, 240, 0, 255), width=2)
    if 'tip' in parts[n]:
        t = parts[n]['tip']; d.rectangle([x + t[0] * S, 20 + t[1] * S, x + t[0] * S + S, 20 + t[1] * S + S], outline=(0, 240, 255, 255), width=2)
    d.text((x, 4), n, fill=(255, 255, 0, 255)); x += im.width * S + 10
sheet.save('jk2_parts_review.png')
print('parts', {n: (p['w'], p['h'], p['pivot'], p.get('tip')) for n, p in parts.items()})
print('review', sheet.size)
