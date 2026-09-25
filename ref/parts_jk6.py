# parts_jk6.py — (picture-master variant of parts_jk.py) cut the JK standing picture (ref/p_jk_full2.png, mirrored, facing +x) into cutout-puppet parts
# for the bone rig in src/puppet.js: head (+ hurt / shout faces), front hair, back hair in two hanging masses,
# torso, skirt, near thigh / shin (the boot leg), far thigh / shin (the chrome leg), near upper arm / forearm
# (the steel arm). Each part carries its pivot (the joint it hangs from) and, for limbs, the far joint, in part
# pixels. Legs are extended up under the skirt so a kick shows a full thigh; limb parts get a round cap at the
# joint so they can turn without a gap. Every part is then polished the way fighting-game sprites are drawn
# (Hina / Yatagarasu, KOF): a few flat tones per material, and a dark outline all around the silhouette.
# The far (skin) arm, the hands and the sword are drawn by the rig at run time.
# Writes src/jk-parts.js, ref/jk_parts_review.png, ref/jk_parts_assembled.png.   python parts_jk.py
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import extract as E

full = Image.open('p_jk_full2.png').convert('RGBA')
FP = full.load()
OUT = (14, 12, 24)
def lum(p): return E.lum(p)
def sat(p): return E.sat(p)
def hair(p): return p[3] > 0 and lum(p) < 52 and sat(p) < 40
def skin(p): return E.is_skin(p)
def white(p): return p[3] > 0 and lum(p) > 165 and sat(p) < 45
def blade(p): return p[3] > 0 and lum(p) > 188 and sat(p) < 34
def skirt(p): return E.is_skirt(p) and not hair(p)
def red(p): return E.is_reddish(p)
def chrome(p):
    return p[3] > 0 and not hair(p) and not skin(p) and not red(p) and not skirt(p) and (sat(p) > 60 or (lum(p) > 120 and sat(p) < 60))

def cap(im, pivot, rows=(0, 1)):
    """round joint: a disc at the pivot as wide as the part's first opaque rows, in their main colour"""
    px = im.load(); w, h = im.size; cx, cy = pivot
    span = []
    for r in rows:
        y = min(h - 1, max(0, cy + r))
        span += [x for x in range(w) if px[x, y][3]]
    if not span: return
    rad = max(2, (max(span) - min(span) + 1) // 2)
    cols = [px[x, min(h - 1, max(0, cy + r))][:3] for r in rows for x in range(w) if px[x, min(h - 1, max(0, cy + r))][3] and lum(px[x, min(h - 1, max(0, cy + r))]) > 40]
    if not cols: return
    col = max(set(cols), key=cols.count)
    mx = (max(span) + min(span)) // 2
    for y in range(cy - rad, cy + rad + 1):
        for x in range(mx - rad, mx + rad + 1):
            if 0 <= x < w and 0 <= y < h and (x - mx) ** 2 + (y - cy) ** 2 <= rad * rad and not px[x, y][3]:
                px[x, y] = col + (255,)

def polish(im, ncol=None):
    """keep the picture's pixels as drawn: near-black → the outline ink, lone pixels dropped"""
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] and lum(p) <= 34: px[x, y] = OUT + (255,)
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and not any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = (0, 0, 0, 0)
    return im

def cut(box, pivot, tip=None, keep=None, clear=None, extend_top=None, inpaint=None, inpaint_mode='left', fill_right=None, tile=None, extend='skin', capped=False, name='', ncol=7):
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
    if extend_top is not None and extend == 'tile':
        # repeat a clean band of the visible part upward (the chrome thigh under the skirt)
        band = list(range(y0 + 6, y0 + 10))
        for y in range(y0 - 1, top - 1, -1):
            src = band[(y0 - 1 - y) % len(band)]
            for x in range(x0, x1 + 1):
                q = px[x - x0, src - top]
                if q[3]: px[x - x0, y - top] = q
    elif extend_top is not None:
        span = [x for x in range(x0, x1 + 1) if px[x - x0, y0 + 2 - top][3]]
        skins = [FP[x, y][:3] for y in range(y0, y0 + 4) for x in range(x0, x1 + 1) if skin(FP[x, y])]
        col = tuple(sum(c[i] for c in skins) // len(skins) for i in range(3)) if skins else (236, 188, 168)
        shade = tuple(max(0, v - 34) for v in col)
        for y in range(y0 - 1, top - 1, -1):
            for x in span:
                px[x - x0, y - top] = OUT + (255,) if x in (span[0], span[-1]) else (shade + (255,) if x == span[-2] else col + (255,))
    if inpaint:
        m = E.mask(im, lambda x, y, p: inpaint(x + x0, y + top, p))
        E.inpaint(im, m, inpaint_mode)
    if fill_right:
        for y in range(h):
            for x in range(w):
                if fill_right(x + x0, y + top, px[x, y]):
                    for d in range(1, 22):
                        if x + d < w and px[x + d, y][3] and not fill_right(x + d + x0, y + top, (0, 0, 0, 0)): px[x, y] = px[x + d, y]; break
    if tile:
        # copy the texture of picture columns [ta, tb) leftward into the masked pixels, keeping row alignment
        (ta, tb), mask = tile; tw = tb - ta
        for y in range(h):
            for x in range(w):
                if mask(x + x0, y + top, px[x, y]):
                    sx = ta + ((x + x0 - ta) % tw)
                    q = FP[sx, y + top]
                    if q[3] and not mask(sx, y + top, (0, 0, 0, 0)) and (skirt(q) or hair(q) or lum(q) < 60): px[x, y] = q
    pv = [pivot[0] - x0, pivot[1] - top]
    if capped: cap(im, pv, rows=(1, 2))
    polish(im, ncol)
    d = {'w': w, 'h': h, 'd': base64.b64encode(im.tobytes()).decode('ascii'), 'pivot': pv, 'name': name}
    if tip: d['tip'] = [tip[0] - x0, tip[1] - top]
    im.save('part_%s.png' % name)
    return d, im

parts = {}
def add(name, *a, **k):
    d, im = cut(*a, name=name, **k); parts[name] = d; return im

# head with the face and the top of the hair; hangs from the neck
head = add('head', (11, 0, 30, 26), (21, 25), clear=lambda x, y, p: y >= 22 and (white(p) or (skirt(p) and y > 23)), ncol=None)
# faces: hurt = eyes shut, shout = mouth open (the head box starts at picture x 11)
def variant(name, paint):
    im = head.copy(); px = im.load(); paint(px)
    d = dict(parts['head']); d['d'] = base64.b64encode(im.tobytes()).decode('ascii'); d['name'] = name; parts[name] = d; im.save('part_%s.png' % name)
def paint_hurt(px):
    skinc = px[12, 17][:3] if px[12, 17][3] else (236, 188, 168)
    for y in range(12, 16):
        for x in range(13, 18):
            if px[x, y][3]: px[x, y] = skinc + (255,)
    for x in range(13, 17): px[x, 14] = OUT + (255,)
    px[16, 13] = OUT + (255,)
def paint_shout(px):
    for x, y in ((14, 19), (15, 19), (14, 20), (15, 20)): px[x, y] = (96, 22, 34, 255)
    px[15, 19] = (150, 40, 52, 255)
variant('headHurt', paint_hurt); variant('headShout', paint_shout)
# front strands (over the near shoulder) and the back mass in two hanging pieces (upper from the head, lower from the upper)
add('hairF', (11, 22, 19, 46), (16, 23), keep=lambda x, y, p: hair(p), ncol=4)
add('hairB1', (27, 18, 47, 41), (28, 22), tip=(35, 40), keep=lambda x, y, p: hair(p) and not (x <= 30 and y <= 22), ncol=4)
add('hairB2', (27, 38, 47, 64), (35, 40), keep=lambda x, y, p: hair(p), ncol=4)
# torso: collar, sailor top, scarf, midriff — the steel arm, its sleeve and the back hair are not part of it
add('torso', (7, 21, 34, 50), (20, 50),
    clear=lambda x, y, p: (x <= 19 and y >= 40 and chrome(p)) or (x <= 18 and 26 <= y <= 47 and not (x >= 14 and y <= 27) and not hair(p)),
    inpaint=lambda x, y, p: p[3] == 0 and x <= 18 and 27 <= y <= 46 and x >= 12, ncol=None)
# skirt over the hips
add('skirt', (7, 47, 37, 72), (20, 50),
    clear=lambda x, y, p: (x <= 18 and y <= 66 and (chrome(p) or sat(p) > 70)) or (x <= 17 and 55 <= y <= 66) or (x >= 30 and y <= 60 and hair(p)) or red(p) or (y >= 66 and skin(p)) or (x >= 34 and y <= 60),
    fill_right=None, tile=((19, 30), lambda x, y, p: p[3] == 0 and 8 <= x <= 18 and 48 <= y <= 70), ncol=6)
# legs: near = the boot leg (image left), far = the chrome leg (image right)
add('thighN', (8, 68, 22, 88), (15, 50), tip=(15, 84), extend_top=50, clear=lambda x, y, p: skirt(p) or blade(p) or skin(p) and y < 70, ncol=8)
add('shinN', (8, 82, 22, 110), (15, 84), tip=(13, 108), clear=lambda x, y, p: blade(p), capped=True, ncol=8)
add('thighF', (22, 68, 36, 88), (25, 50), tip=(28, 84), extend_top=50, extend='tile', clear=lambda x, y, p: skirt(p) or hair(p), ncol=8)
add('shinF', (22, 82, 36, 110), (28, 84), tip=(28, 108), capped=True, ncol=7)
# steel arm: the sleeve puff goes with the upper arm, the forearm ends in the fist
add('uArmN', (7, 26, 19, 46), (12, 30), tip=(13, 43), clear=lambda x, y, p: hair(p) or red(p) or (y >= 44 and not chrome(p)), inpaint=lambda x, y, p: p[3] == 0 and 28 <= y <= 42 and 9 <= x <= 17, ncol=7)
add('fArmN', (9, 42, 19, 58), (13, 43), tip=(14, 56), clear=lambda x, y, p: hair(p) or skirt(p) or (y <= 45 and white(p)) or (x >= 17 and y >= 50 and not chrome(p)), capped=True, ncol=8)
# the steel fist as its own piece on the wrist (the user's cut: upper arm / forearm / hand)
add('handN', (9, 55, 19, 65), (14, 56), clear=lambda x, y, p: hair(p) or skirt(p) or (x >= 17 and not chrome(p)), ncol=8)


# ---- far sleeve: the picture's own sleeve puff (near arm, x 7–18, y 26–44), mirrored, hung from the far shoulder
sl = Image.new('RGBA', (12, 19), (0, 0, 0, 0)); sp = sl.load()
for y in range(26, 45):
    for x in range(7, 19):
        p = FP[x, y]
        if p[3] and not hair(p) and not red(p) and not (y >= 41 and chrome(p)): sp[x - 7, y - 26] = p
sl = sl.transpose(Image.FLIP_LEFT_RIGHT); polish(sl)
parts['uArmF'] = {'w': sl.width, 'h': sl.height, 'd': base64.b64encode(sl.tobytes()).decode('ascii'), 'pivot': [6, 3], 'tip': [6, 18], 'name': 'uArmF'}
sl.save('part_uArmF.png')
# ---- katana from the picture: blade colours sampled across the visible blade (behind the legs), hilt colours from the grip
def sample_line(x0, y0, x1, y1, n):
    return [FP[int(round(x0 + (x1 - x0) * i / (n - 1))), int(round(y0 + (y1 - y0) * i / (n - 1)))] for i in range(n)]
# a cross-section perpendicular to the blade at its visible part: the blade runs from about (24, 80) to (1, 108)
sec = [p for p in sample_line(6, 100, 12, 105, 7) if p[3] and lum(p) > 60]   # light edge → mid → dark edge
if len(sec) < 3: sec = [(232, 236, 242, 255), (170, 178, 190, 255), (86, 92, 110, 255)]
sec = [sec[0], sec[len(sec) // 2], sec[-1]]
wrap = [p for p in sample_line(46, 44, 39, 57, 12) if p[3]]
dark = min(wrap, key=lum) if wrap else (60, 14, 22, 255); bright = max(wrap, key=lum) if wrap else (150, 40, 52, 255)
def katana(blade):
    L = 15 + blade; im = Image.new('RGBA', (L + 2, 7), (0, 0, 0, 0)); o = im.load()
    for x in range(0, 12):                      # grip: alternating wrap
        for y in (2, 3, 4): o[x, y] = (dark if (x + y) % 3 == 0 else bright)[:3] + (255,)
    o[0, 2] = o[0, 4] = OUT + (255,); o[0, 3] = (200, 170, 90, 255)   # pommel cap
    for y in range(1, 6): o[12, y] = (200, 170, 90, 255) if y in (2, 3, 4) else OUT + (255,)   # guard
    o[13, 3] = (200, 170, 90, 255)
    for i in range(blade):                      # blade: light edge / body / dark edge, tapering over the last 5
        x = 14 + i; tip = blade - i
        o[x, 2] = sec[0][:3] + (255,)
        o[x, 3] = sec[1][:3] + (255,)
        if tip > 2: o[x, 4] = sec[2][:3] + (255,)
        if tip > 5 and i > 1: o[x, 1] = OUT + (255,)
        if tip > 3: o[x, 5] = OUT + (255,)
    for x in range(13, 14 + blade):
        if o[x, 2][3] and not o[x, 1][3]: o[x, 1] = OUT + (255,)
    return im
for name, blade in (('sword', 56), ('swordShort', 22), ('hilt', 0)):
    im = katana(blade); im.save('part_%s.png' % name)
    parts[name] = {'w': im.width, 'h': im.height, 'd': base64.b64encode(im.tobytes()).decode('ascii'), 'pivot': [6, 3], 'name': name}
    if blade: parts[name]['tip'] = [im.width - 2, 3]
js = ('// jk-parts.js — the JK standing picture cut into cutout-puppet parts (ref/parts_jk.py): RGBA base64,\n'
      '// pivot = the joint the part hangs from, tip = its far joint (limbs), in part pixels. Facing +x.\n'
      '(function (root) { root.CAST = root.CAST || {}; root.CAST.jkParts = ' + json.dumps(parts) + '; })(typeof window !== "undefined" ? window : globalThis);\n')
open(os.path.join('..', 'src', 'jk-parts.js'), 'w', encoding='utf-8').write(js)

# review sheet and a reassembly next to the picture
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
order = ['hairB1', 'hairB2', 'thighF', 'shinF', 'thighN', 'shinN', 'skirt', 'torso', 'head', 'hairF', 'uArmN', 'fArmN', 'handN']
boxes = {'head': (11, 0), 'hairF': (11, 22), 'hairB1': (27, 18), 'hairB2': (27, 38), 'torso': (7, 21), 'skirt': (7, 47), 'thighN': (8, 50), 'shinN': (8, 82), 'thighF': (22, 50), 'shinF': (22, 82), 'uArmN': (7, 26), 'fArmN': (9, 42), 'handN': (9, 55)}
asm = Image.new('RGBA', full.size, (0, 0, 0, 0))
for n in order: asm.alpha_composite(dict(ims)[n], boxes[n])
side = Image.new('RGBA', (full.width * S * 2 + 36, full.height * S + 24), (70, 80, 92, 255))
side.alpha_composite(full.resize((full.width * S, full.height * S), Image.NEAREST), (12, 12))
side.alpha_composite(asm.resize((asm.width * S, asm.height * S), Image.NEAREST), (full.width * S + 24, 12))
side.save('jk_parts_assembled.png'); sheet.save('jk_parts_review.png')
print('parts', {n: (p['w'], p['h'], p['pivot'], p.get('tip')) for n, p in parts.items()})
print('review', sheet.size, 'assembled', side.size)

# cut diagram: part boxes over the picture (x6)
S = 6
dia = full.resize((full.width * S, full.height * S), Image.NEAREST); d = ImageDraw.Draw(dia)
cols = {'head': (90, 255, 90), 'hairF': (255, 200, 60), 'hairB1': (255, 120, 60), 'hairB2': (255, 80, 120), 'torso': (90, 200, 255), 'skirt': (140, 140, 255), 'thighN': (255, 255, 90), 'shinN': (255, 220, 120), 'thighF': (120, 255, 200), 'shinF': (120, 220, 255), 'uArmN': (255, 140, 255), 'fArmN': (255, 170, 210), 'handN': (255, 255, 255)}
bx = {'head': (11, 0, 30, 26), 'hairF': (11, 22, 19, 46), 'hairB1': (27, 18, 47, 41), 'hairB2': (27, 38, 47, 64), 'torso': (7, 21, 34, 50), 'skirt': (7, 47, 37, 72), 'thighN': (8, 68, 22, 88), 'shinN': (8, 82, 22, 110), 'thighF': (22, 68, 36, 88), 'shinF': (22, 82, 36, 110), 'uArmN': (7, 26, 19, 46), 'fArmN': (9, 42, 19, 58), 'handN': (9, 55, 19, 65)}
for n, (x0, y0, x1, y1) in bx.items():
    d.rectangle([x0 * S, y0 * S, (x1 + 1) * S - 1, (y1 + 1) * S - 1], outline=cols[n] + (255,), width=2)
    d.text((x0 * S + 3, y0 * S + 2), n, fill=cols[n] + (255,))
dia.save('jk_parts_cuts.png')
