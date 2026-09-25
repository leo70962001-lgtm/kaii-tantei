# parts_x2.py — refine the puppet parts: every part of src/jk-parts.js that is still at the picture's density is
# doubled with Scale2x (EPX — diagonal stair-steps become half-size steps, flat areas stay flat, colours
# unchanged) and marked res: 2; pivots / tips are doubled with it. Parts already at res 2 are left alone.
# Run after the cutter (parts_jk6.py → parts_x2.py). Writes src/jk-parts.js and ref/jk_x2_review.png.
import os, json, base64
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw

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

path = os.path.join('..', 'src', 'jk-parts.js')
src = open(path, encoding='utf-8').read()
head = 'root.CAST.jkParts = '
data = json.loads(src[src.index(head) + len(head): src.rindex('; })')])
done = []
for name, d in data.items():
    if (d.get('res') or 1) >= 2: continue
    im = scale2x(Image.frombytes('RGBA', (d['w'], d['h']), base64.b64decode(d['d'])))
    d['w'], d['h'] = im.size; d['d'] = base64.b64encode(im.tobytes()).decode('ascii'); d['res'] = 2
    d['pivot'] = [d['pivot'][0] * 2, d['pivot'][1] * 2]
    if d.get('tip'): d['tip'] = [d['tip'][0] * 2, d['tip'][1] * 2]
    im.save('partx2_%s.png' % name); done.append(name)
js = src[:src.index(head) + len(head)] + json.dumps(data) + src[src.rindex('; })'):]
open(path, 'w', encoding='utf-8').write(js)
S = 3
ims = [(n, Image.frombytes('RGBA', (data[n]['w'], data[n]['h']), base64.b64decode(data[n]['d']))) for n in data]
W = sum(im.width * S + 10 for _, im in ims) + 10; H = max(im.height for _, im in ims) * S + 30
sheet = Image.new('RGBA', (W, H), (60, 70, 85, 255)); dd = ImageDraw.Draw(sheet); x = 10
for n, im in ims:
    sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, 20))
    p = data[n]['pivot']; dd.rectangle([x + p[0] * S, 20 + p[1] * S, x + p[0] * S + S, 20 + p[1] * S + S], outline=(255, 240, 0, 255), width=2)
    if 'tip' in data[n]:
        t = data[n]['tip']; dd.rectangle([x + t[0] * S, 20 + t[1] * S, x + t[0] * S + S, 20 + t[1] * S + S], outline=(0, 240, 255, 255), width=2)
    dd.text((x, 4), n, fill=(255, 255, 0, 255)); x += im.width * S + 10
sheet.save('jk_x2_review.png')
print('doubled', done); print('review', sheet.size)
