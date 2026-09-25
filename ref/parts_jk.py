# parts_jk.py — cut the JK standing picture (ref/p_jk_full2.png, mirrored, facing +x) into cutout-puppet parts
# for the bone rig in src/puppet.js: head, front / back hair, torso, skirt, near thigh / shin (the boot leg),
# far thigh / shin (the chrome leg), near upper arm / forearm (the steel arm). Each part carries its pivot
# (the joint it hangs from) and, for limbs, the far joint, both in part pixels. Legs are extended up under
# the skirt so a kick shows a full thigh; the far (skin) arm and the sword are drawn by the rig at run time.
# Writes src/jk-parts.js and ref/jk_parts_review.png.   python parts_jk.py
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import extract as E

full = Image.open('p_jk_full2.png').convert('RGBA')
FP = full.load()
def lum(p): return E.lum(p)
def sat(p): return E.sat(p)
def hair(p): return p[3] > 0 and lum(p) < 52 and sat(p) < 40
def skin(p): return E.is_skin(p)
def white(p): return p[3] > 0 and lum(p) > 165 and sat(p) < 45
def blade(p): return p[3] > 0 and lum(p) > 188 and sat(p) < 34
def skirt(p): return E.is_skirt(p) and not hair(p)
def red(p): return E.is_reddish(p)
def chrome(p):
    # the steel arm's pale metal and its rainbow sheen
    return p[3] > 0 and not hair(p) and not skin(p) and not red(p) and not skirt(p) and (sat(p) > 60 or (lum(p) > 120 and sat(p) < 60))

def cut(box, pivot, tip=None, keep=None, clear=None, extend_top=None, inpaint=None, name=''):
    x0, y0, x1, y1 = box
    top = extend_top if extend_top is not None else y0
    w, h = x1 - x0 + 1, y1 - top + 1
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); px = im.load()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            p = FP[x, y]
            if p[3] == 0: continue
            if keep and not keep(x, y, p): continue
            if clear and clear(x, y, p): continue
            px[x - x0, y - top] = p
    if extend_top is not None:
        # the thigh under the skirt: a solid skin column between two outline columns, as wide as the leg's top row
        span = [x for x in range(x0, x1 + 1) if px[x - x0, y0 + 2 - top][3]]
        skins = [FP[x, y][:3] for y in range(y0, y0 + 4) for x in range(x0, x1 + 1) if skin(FP[x, y])]
        col = tuple(sum(c[i] for c in skins) // len(skins) for i in range(3)) if skins else (236, 188, 168)
        shade = tuple(max(0, v - 34) for v in col)
        for y in range(y0 - 1, top - 1, -1):
            for x in span:
                px[x - x0, y - top] = (14, 12, 24, 255) if x in (span[0], span[-1]) else (shade + (255,) if x == span[-2] else col + (255,))
    if inpaint:
        m = E.mask(im, lambda x, y, p: inpaint(x + x0, y + top, p))
        E.inpaint(im, m, 'left')
    d = {'w': w, 'h': h, 'd': base64.b64encode(im.tobytes()).decode('ascii'), 'pivot': [pivot[0] - x0, pivot[1] - top], 'name': name}
    if tip: d['tip'] = [tip[0] - x0, tip[1] - top]
    im.save('part_%s.png' % name)
    return d, im

parts = {}
def add(name, *a, **k):
    d, im = cut(*a, name=name, **k); parts[name] = d; return im

# head with the face and the top of the hair; hangs from the neck
add('head', (11, 0, 30, 26), (21, 25), clear=lambda x, y, p: y >= 22 and (white(p) or (skirt(p) and y > 23)))
# front strands (over the near shoulder) and the big back mass (behind everything)
add('hairF', (11, 22, 19, 46), (16, 23), keep=lambda x, y, p: hair(p))
add('hairB', (27, 18, 47, 64), (28, 22), keep=lambda x, y, p: hair(p) and not (x <= 30 and y <= 22))
# torso: collar, sailor top, scarf, midriff — the steel arm, its sleeve and the back hair are not part of it
add('torso', (7, 21, 34, 50), (20, 50),
    clear=lambda x, y, p: (x <= 19 and y >= 40 and chrome(p)) or (x <= 18 and 26 <= y <= 47 and not (x >= 14 and y <= 27)) or (x >= 30 and y >= 24 and hair(p)) or (x <= 12 and hair(p)),
    inpaint=lambda x, y, p: p[3] == 0 and x <= 18 and 27 <= y <= 46 and x >= 12)
# skirt over the hips
add('skirt', (7, 47, 37, 72), (20, 50),
    clear=lambda x, y, p: (x <= 18 and chrome(p)) or (x <= 17 and y >= 55) or hair(p) or red(p) or (y >= 66 and skin(p)) or (x >= 34 and y <= 60))
# legs: near = the boot leg (image left), far = the chrome leg (image right)
add('thighN', (8, 68, 22, 88), (15, 50), tip=(15, 84), extend_top=50, clear=lambda x, y, p: skirt(p) or blade(p) or skin(p) and y < 70)
add('shinN', (8, 82, 22, 110), (15, 84), tip=(13, 108), clear=lambda x, y, p: blade(p))
add('thighF', (22, 68, 36, 88), (25, 50), tip=(28, 84), extend_top=50, clear=lambda x, y, p: skirt(p) or hair(p))
add('shinF', (22, 82, 36, 110), (28, 84), tip=(28, 108))
# steel arm: the sleeve puff goes with the upper arm, the forearm ends in the fist
add('uArmN', (7, 26, 19, 46), (12, 30), tip=(13, 43), clear=lambda x, y, p: hair(p) or red(p) or (y >= 44 and not chrome(p)), inpaint=lambda x, y, p: p[3] == 0 and 28 <= y <= 42 and 9 <= x <= 17)
add('fArmN', (9, 42, 19, 64), (13, 43), tip=(14, 56), clear=lambda x, y, p: hair(p) or skirt(p) or (y <= 45 and white(p)) or (x >= 17 and y >= 50 and not chrome(p)))

js = ('// jk-parts.js — the JK standing picture cut into cutout-puppet parts (ref/parts_jk.py): RGBA base64,\n'
      '// pivot = the joint the part hangs from, tip = its far joint (limbs), in part pixels. Facing +x.\n'
      '(function (root) { root.CAST = root.CAST || {}; root.CAST.jkParts = ' + json.dumps(parts) + '; })(typeof window !== "undefined" ? window : globalThis);\n')
open(os.path.join('..', 'src', 'jk-parts.js'), 'w', encoding='utf-8').write(js)

# review: every part at 6x with pivot (yellow) and tip (cyan), then the parts reassembled at rest over the picture
S = 6
ims = [(n, Image.open('part_%s.png' % n)) for n in parts]
W = sum(im.width * S + 12 for _, im in ims) + 12; H = max(im.height for _, im in ims) * S + 40
sheet = Image.new('RGBA', (W, H), (70, 80, 92, 255)); d = ImageDraw.Draw(sheet); x = 12
for n, im in ims:
    sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, 24))
    p = parts[n]['pivot']; d.rectangle([x + p[0] * S, 24 + p[1] * S, x + p[0] * S + S - 1, 24 + p[1] * S + S - 1], outline=(255, 240, 0, 255), width=2)
    if 'tip' in parts[n]:
        t = parts[n]['tip']; d.rectangle([x + t[0] * S, 24 + t[1] * S, x + t[0] * S + S - 1, 24 + t[1] * S + S - 1], outline=(0, 240, 255, 255), width=2)
    d.text((x, 6), n, fill=(255, 255, 0, 255)); x += im.width * S + 12
# reassembly: draw parts back at their picture positions in puppet order
order = ['hairB', 'thighF', 'shinF', 'thighN', 'shinN', 'skirt', 'torso', 'head', 'hairF', 'uArmN', 'fArmN']
boxes = {'head': (11, 0), 'hairF': (11, 22), 'hairB': (27, 18), 'torso': (7, 21), 'skirt': (7, 47), 'thighN': (8, 50), 'shinN': (8, 82), 'thighF': (22, 50), 'shinF': (22, 82), 'uArmN': (7, 26), 'fArmN': (9, 42)}
asm = Image.new('RGBA', full.size, (0, 0, 0, 0))
for n in order:
    im = dict(ims)[n]; asm.alpha_composite(im, boxes[n])
side = Image.new('RGBA', (full.width * S * 2 + 36, full.height * S + 24), (70, 80, 92, 255))
side.alpha_composite(full.resize((full.width * S, full.height * S), Image.NEAREST), (12, 12))
side.alpha_composite(asm.resize((asm.width * S, asm.height * S), Image.NEAREST), (full.width * S + 24, 12))
side.save('jk_parts_assembled.png'); sheet.save('jk_parts_review.png')
print('parts', {n: (p['w'], p['h'], p['pivot'], p.get('tip')) for n, p in parts.items()})
print('review', sheet.size, 'assembled', side.size)
