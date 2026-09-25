# parts_jk5.py — refine every part to the finer density (「精緻化所有點圖」): the standing-picture parts (1x,
# from parts_jk.py + parts_jk4.py supplements) are doubled with Scale2x (EPX: diagonals become steps of half
# size, flat areas stay flat) to res 2; the parts that exist natively at 2x on the exploded sheets (the far
# sleeve from sheet A, the katana from sheet B) are taken at their native 2x instead. Writes src/jk-parts.js.
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw

def decode(d):
    return Image.frombytes('RGBA', (d['w'], d['h']), base64.b64decode(d['d']))
def scale2x(im):
    px = im.load(); w, h = im.size
    out = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0)); o = out.load()
    def at(x, y): return px[x, y] if 0 <= x < w and 0 <= y < h and px[x, y][3] else (0, 0, 0, 0)
    for y in range(h):
        for x in range(w):
            E = at(x, y); B = at(x, y - 1); D = at(x - 1, y); F = at(x + 1, y); H = at(x, y + 1)
            e0 = e1 = e2 = e3 = E
            if B != H and D != F:
                if D == B: e0 = D
                if B == F: e1 = F
                if D == H: e2 = D
                if H == F: e3 = F
            o[x * 2, y * 2] = e0; o[x * 2 + 1, y * 2] = e1; o[x * 2, y * 2 + 1] = e2; o[x * 2 + 1, y * 2 + 1] = e3
    return out
OUT = (14, 12, 24)
def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
def opaque(p): return max(p[:3]) >= 14
def grab(src, box):
    x0, y0, x1, y1 = box; w, h = x1 - x0 + 1, y1 - y0 + 1
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); px = im.load(); sp = src.load()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            p = sp[x, y]
            if opaque(p): px[x - x0, y - y0] = p[:3] + (255,)
    return im
def outline(im):
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] and lum(p) <= 34: px[x, y] = OUT + (255,)
    outside = [[False] * w for _ in range(h)]; st = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while st:
        x, y = st.pop()
        if x < 0 or y < 0 or x >= w or y >= h or outside[y][x] or px[x, y][3]: continue
        outside[y][x] = True; st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    edge = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] and any(not (0 <= x + dx < w and 0 <= y + dy < h) or outside[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for (x, y) in edge: px[x, y] = OUT + (255,)
    return im

src = open(os.path.join('..', 'src', 'jk-parts.js'), encoding='utf-8').read()
head = 'root.CAST.jkParts = '
data = json.loads(src[src.index(head) + len(head): src.rindex('; })')])
A = Image.open('jkp_a_native.png').convert('RGBA'); B = Image.open('jkp_b_native.png').convert('RGBA')
out = {}
def put(name, im, pivot, tip=None):
    d = {'w': im.width, 'h': im.height, 'd': base64.b64encode(im.tobytes()).decode('ascii'), 'pivot': list(pivot), 'res': 2, 'name': name}
    if tip: d['tip'] = list(tip)
    out[name] = d; im.save('part5_%s.png' % name)
for name, d in data.items():
    if (d.get('res') or 1) == 2 and name in ('uArmF', 'sword', 'swordShort', 'hilt'): continue
    im = scale2x(decode(d)); outline(im)
    put(name, im, [d['pivot'][0] * 2, d['pivot'][1] * 2], [d['tip'][0] * 2, d['tip'][1] * 2] if d.get('tip') else None)
# native 2x supplements
box = (100, 46, 124, 80); put('uArmF', outline(grab(A, box)), [112 - 100, 52 - 46], [112 - 100, 82 - 46])
def katana(rows):
    hilt = grab(B, (103, 56, 118, 100)); sec = grab(B, (103, 104, 118, 105)); tip = grab(B, (103, 186, 118, 193))
    im = Image.new('RGBA', (16, 45 + rows + (8 if rows else 0)), (0, 0, 0, 0)); im.alpha_composite(hilt, (0, 0))
    for r in range(rows): im.alpha_composite(sec.crop((0, 0, 16, 1)), (0, 45 + r))
    if rows: im.alpha_composite(tip, (0, 45 + rows))
    return outline(im.transpose(Image.ROTATE_90))
for name, rows in (('sword', 100), ('swordShort', 36), ('hilt', 0)):
    im = katana(rows); put(name, im, [22, 16 - 1 - 7], [im.width - 1, 16 - 1 - 7] if rows else None)
js = src[:src.index(head) + len(head)] + json.dumps(out) + src[src.rindex('; })'):]
open(os.path.join('..', 'src', 'jk-parts.js'), 'w', encoding='utf-8').write(js)
S = 3
ims = [(n, Image.open('part5_%s.png' % n)) for n in out]
W = sum(im.width * S + 10 for _, im in ims) + 10; H = max(im.height for _, im in ims) * S + 30
sheet = Image.new('RGBA', (W, H), (60, 70, 85, 255)); dd = ImageDraw.Draw(sheet); x = 10
for n, im in ims:
    sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, 20))
    p = out[n]['pivot']; dd.rectangle([x + p[0] * S, 20 + p[1] * S, x + p[0] * S + S, 20 + p[1] * S + S], outline=(255, 240, 0, 255), width=2)
    if 'tip' in out[n]:
        t = out[n]['tip']; dd.rectangle([x + t[0] * S, 20 + t[1] * S, x + t[0] * S + S, 20 + t[1] * S + S], outline=(0, 240, 255, 255), width=2)
    dd.text((x, 4), n, fill=(255, 255, 0, 255)); x += im.width * S + 10
sheet.save('jk5_parts_review.png')
print('parts', {n: (p['w'], p['h'], p['res']) for n, p in out.items()}); print('review', sheet.size)
