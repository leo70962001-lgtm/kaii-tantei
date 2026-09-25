# extract_solo.py — re-cut the JK's parts from the black-background solo picture (jk_solo.jpg): the cut has
# no label / neighbour leaks and keeps the flowing hair, sword hilt and blade tip. The part recipe of
# extract.py is reused, shifted by the offset between the old (cast.jpg) cut and the new one, so the
# rig anchors stay valid. Writes ref/jk_solo_parts.json (the CAST.jk entry) and a review sheet.
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from collections import deque
import extract as E

def cut_black(im, name, thr=12):
    px = im.load(); w, h = im.size
    bg = [[False] * w for _ in range(h)]; q = deque()
    for i in range(w):
        for j in (0, h - 1):
            if max(px[i, j]) < thr and not bg[j][i]: bg[j][i] = True; q.append((i, j))
    for j in range(h):
        for i in (0, w - 1):
            if max(px[i, j]) < thr and not bg[j][i]: bg[j][i] = True; q.append((i, j))
    while q:
        i, j = q.popleft()
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ni, nj = i + di, j + dj
            if 0 <= ni < w and 0 <= nj < h and not bg[nj][ni] and max(px[ni, nj]) < thr: bg[nj][ni] = True; q.append((ni, nj))
    lab = [[0] * w for _ in range(h)]; comps = []
    for j in range(h):
        for i in range(w):
            if bg[j][i] or lab[j][i]: continue
            cid = len(comps) + 1; pts = []; st = [(i, j)]; lab[j][i] = cid
            while st:
                ci, cj = st.pop(); pts.append((ci, cj))
                for di in (-1, 0, 1):
                    for dj in (-1, 0, 1):
                        ni, nj = ci + di, cj + dj
                        if 0 <= ni < w and 0 <= nj < h and not bg[nj][ni] and not lab[nj][ni]: lab[nj][ni] = cid; st.append((ni, nj))
            comps.append(pts)
    comps.sort(key=len, reverse=True); keep = comps[0]
    for c in comps[1:]:
        if len(c) >= 6 and any(abs(p[0] - k[0]) <= 2 and abs(p[1] - k[1]) <= 2 for p in c[:40] for k in keep[::7]): keep = keep + c
    xs = [p[0] for p in keep]; ys = [p[1] for p in keep]
    bx0, by0, bx1, by1 = min(xs), min(ys), max(xs), max(ys)
    out = Image.new('RGBA', (bx1 - bx0 + 1, by1 - by0 + 1), (0, 0, 0, 0)); o = out.load()
    for (i, j) in keep: o[i - bx0, j - by0] = px[i, j] + (255,)
    out.save(name + '.png'); print(name, 'box', (bx0, by0, bx1, by1), 'size', out.size, 'components', [len(c) for c in comps[:5]])
    return out

native = E.to_native('jk_solo.jpg', 'jks_native.png')
new = cut_black(native, 'jk_solo')
old = Image.open('jk.png').convert('RGBA')
# offset: new = old + (dx, dy), by colour agreement over the old cut's head / torso columns
op = old.load(); np_ = new.load()
def score(dx, dy):
    n = 0
    for y in range(0, 70):
        for x in range(8, 27):
            a = op[x, y]
            if a[3] == 0: continue
            X, Y = x + dx, y + dy
            if 0 <= X < new.width and 0 <= Y < new.height:
                b = np_[X, Y]
                if b[3] and abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2]) < 45: n += 1
    return n
best = max(((score(dx, dy), dx, dy) for dx in range(-14, 15) for dy in range(-10, 11)))
print('offset new = old + (dx, dy):', best)
_, DX, DY = best
# the shoes' bottom row in the new cut (dark pixels under the legs; the blade is pale so it does not count)
px = new.load(); w, h = new.size
def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
legs_x0, legs_x1 = 5 + DX, 27 + DX
rows = [y for y in range(h) if any(px[x, y][3] and lum(px[x, y]) < 60 for x in range(max(0, legs_x0), min(w, legs_x1 + 1)))]
shoe_bottom = max(rows)
shoe_px = [x for x in range(max(0, legs_x0), min(w, legs_x1 + 1)) if px[x, shoe_bottom][3] and lum(px[x, shoe_bottom]) < 60]
print('old feet (16,110) ->', (16 + DX, 110 + DY), 'detected shoe bottom row', shoe_bottom, 'x range', min(shoe_px), max(shoe_px))
sh = lambda box: (box[0] + DX, box[1] + DY, box[2] + DX, box[3] + DY)
jk = new
body = E.crop(jk, sh((0, 0, 33, 70)))
m = E.mask(body, lambda x, y, p: p[3] > 0 and ((x <= 6 and 28 <= y <= 70 and not E.is_hair_black(p)) or (x >= 25 and 34 <= y <= 70 and not E.is_hair_black(p)) or (x >= 25 and y >= 56) or (x <= 5 and y >= 50)))
E.inpaint(body, m, 'left')
E.inpaint(body, E.mask(body, lambda x, y, p: 18 <= x <= 27 and 36 <= y <= 62 and E.is_chrome(p)), 'left')
E.clear(body, E.mask(body, lambda x, y, p: p[3] > 0 and ((x >= 25 and y >= 56) or (x <= 5 and y >= 50) or (y >= 44 and (x <= 5 or x >= 27) and not E.is_hair_black(p)))))
body = body.transpose(Image.FLIP_LEFT_RIGHT)
boot = E.crop(jk, sh((5, 99, 15, 112))).transpose(Image.FLIP_LEFT_RIGHT)
loafer = E.crop(jk, sh((17, 101, 27, 112))); E.clear(loafer, E.mask(loafer, lambda x, y, p: p[3] > 0 and E.sat(p) < 30 and E.lum(p) > 110)); loafer = loafer.transpose(Image.FLIP_LEFT_RIGHT)
full = jk.transpose(Image.FLIP_LEFT_RIGHT)
feet = [full.width - 1 - (16 + DX), 112 + DY]
out = {'body': E.part(body, hip=[16, 49], shN=[6, 28], shF=[28, 28], neck=[17, 24], headBox=[9, 0, 25, 24]),
       'full': E.part(full, feet=feet),
       'shoeF': E.part(boot, ank=[5, 3]), 'shoeN': E.part(loafer, ank=[5, 3])}
json.dump(out, open('jk_solo_parts.json', 'w'))
body.save('p_jk_body2.png'); boot.save('p_jk_boot2.png'); loafer.save('p_jk_loafer2.png'); full.save('p_jk_full2.png')
print('body', body.size, 'full', full.size, 'feet', feet)
S = 6
ims = [Image.open('p_jk_body.png'), body, boot, loafer, full]
W = sum(i.width * S + 8 for i in ims) + 8; H = max(i.height for i in ims) * S + 16
sheet = Image.new('RGBA', (W, H), (70, 80, 92, 255)); x = 8
for i in ims: sheet.alpha_composite(i.resize((i.width * S, i.height * S), Image.NEAREST), (x, 8)); x += i.width * S + 8
sheet.save('jk_solo_review.png'); print('review', sheet.size)
