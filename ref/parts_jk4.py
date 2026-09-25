# parts_jk4.py — the standing picture is the master (「以這為主」): rebuild the 1x parts cut from it (parts_jk.py:
# head + faces, hair, torso, skirt, legs, steel arm, feet from the rig's shoe cuts) and fill in only what the
# picture cannot show, taken from the Gemini sheets and brought to the same 1x density: the far sleeve (sheet A,
# 2:1), the skin forearm and hand (component sheet C, 1.4:1) and the katana (sheet B, 2:1). Writes src/jk-parts.js.
import os, sys, json, base64
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import parts_jk   # regenerates the 1x picture parts into src/jk-parts.js
from parts_jk2 import grab, outline   # (module import re-cuts the 2x set to part2_*.png; we overwrite jk-parts.js below)

A = Image.open('jkp_a_native.png').convert('RGBA'); B = Image.open('jkp_b_native.png').convert('RGBA'); C = Image.open('jkp_c_native4.png').convert('RGBA')
def shrink(im, f):
    """resample a part to 1/f of its size: each output pixel = the most common opaque colour of its source block"""
    px = im.load(); w, h = im.size; W, H = max(1, round(w / f)), max(1, round(h / f))
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o = out.load()
    for Y in range(H):
        for X in range(W):
            x0, x1 = int(X * f), max(int(X * f) + 1, int((X + 1) * f)); y0, y1 = int(Y * f), max(int(Y * f) + 1, int((Y + 1) * f))
            cols = [px[x, y][:3] for y in range(y0, min(h, y1)) for x in range(x0, min(w, x1)) if px[x, y][3]]
            if len(cols) * 2 >= (min(h, y1) - y0) * (min(w, x1) - x0): o[X, Y] = Counter(cols).most_common(1)[0][0] + (255,)
    return out
src = open(os.path.join('..', 'src', 'jk-parts.js'), encoding='utf-8').read()
head = 'root.CAST.jkParts = '
data = json.loads(src[src.index(head) + len(head): src.rindex('; })')])
def put(name, im, pivot, tip=None):
    outline(im)
    d = {'w': im.width, 'h': im.height, 'd': base64.b64encode(im.tobytes()).decode('ascii'), 'pivot': [int(round(v)) for v in pivot], 'name': name}
    if tip: d['tip'] = [int(round(v)) for v in tip]
    data[name] = d; im.save('part4_%s.png' % name)
# far sleeve (sheet A right sleeve, 2:1)
box = (100, 46, 124, 80); im = shrink(grab(A, box), 2); put('uArmF', im, ((112 - 100) / 2, (52 - 46) / 2), ((112 - 100) / 2, (82 - 46) / 2))
# skin forearm + hand (sheet C side view, 1.4:1)
box = (36, 227, 46, 251); im = shrink(grab(C, box), 1.4); put('fArmF', im, ((41 - 36) / 1.4, (229 - 227) / 1.4), ((41 - 36) / 1.4, (249 - 227) / 1.4))
box = (35, 246, 47, 257); im = shrink(grab(C, box), 1.4); put('handF', im, ((41 - 35) / 1.4, (249 - 246) / 1.4))
# katana (sheet B): hilt + guard as drawn, blade from one clean cross-section, tip from the sheet; 2:1, pointing +x
def katana(rows):
    hilt = grab(B, (103, 56, 118, 100)); sec = grab(B, (103, 104, 118, 105)); tip = grab(B, (103, 186, 118, 193))
    im = Image.new('RGBA', (16, 45 + rows + (8 if rows else 0)), (0, 0, 0, 0)); im.alpha_composite(hilt, (0, 0))
    for r in range(rows): im.alpha_composite(sec.crop((0, 0, 16, 1)), (0, 45 + r))
    if rows: im.alpha_composite(tip, (0, 45 + rows))
    return shrink(im.transpose(Image.ROTATE_90), 2)
for name, rows in (('sword', 100), ('swordShort', 36), ('hilt', 0)):
    im = katana(rows); put(name, im, (22 / 2, (16 - 1 - 7) / 2), (im.width - 1, (16 - 1 - 7) / 2) if rows else None)
js = src[:src.index(head) + len(head)] + json.dumps(data) + src[src.rindex('; })'):]
open(os.path.join('..', 'src', 'jk-parts.js'), 'w', encoding='utf-8').write(js)
print('parts', sorted(data.keys()))
print({n: (data[n]['w'], data[n]['h'], data[n]['pivot'], data[n].get('tip'), data[n].get('res', 1)) for n in ('uArmF', 'fArmF', 'handF', 'sword', 'hilt', 'head', 'torso')})
