# extract.py — cut the three club members out of the Gemini standing sheet (cast.jpg) at its native
# pixel grid, mask the painted arms / laptop / hands so the rig can animate limbs, and write
# src/cast-data.js. Run: python extract.py   (needs Pillow only)
from PIL import Image, ImageChops
from collections import deque
import base64, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)

def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
def sat(p): return max(p[:3]) - min(p[:3])
def is_skin(p): return p[3] > 0 and p[0] > 180 and 120 < p[1] < 215 and 90 < p[2] < 200 and p[0] - p[2] > 40
def is_hair_black(p): return p[3] > 0 and lum(p) < 48 and sat(p) < 32
def is_reddish(p): return p[3] > 0 and p[0] > p[1] + 45 and p[0] > 90
def is_white(p): return p[3] > 0 and lum(p) > 190 and sat(p) < 40
def is_pink(p): return p[3] > 0 and p[0] > 180 and p[1] < 175 and p[2] > 120 and p[0] - p[1] > 35
def is_yellowhair(p): return p[3] > 0 and p[0] - p[2] > 50 and p[1] > 85
def is_skirt(p): return p[3] > 0 and p[2] > p[0] + 25 and p[2] >= p[1] and p[2] > 80
def is_chrome(p): return p[3] > 0 and not is_skirt(p) and not is_white(p) and not is_skin(p) and not is_hair_black(p) and not is_reddish(p)

def grid_period(im, axis):
    W, H = im.size
    if axis == 0:
        d = ImageChops.difference(im.crop((0, 0, W - 1, H)), im.crop((1, 0, W, H))).convert('L').resize((W - 1, 1), Image.BOX)
    else:
        d = ImageChops.difference(im.crop((0, 0, W, H - 1)), im.crop((0, 1, W, H))).convert('L').resize((1, H - 1), Image.BOX)
    prof = list(d.getdata()); m = sum(prof) / len(prof); prof = [v - m for v in prof]; n = len(prof)
    best = None; p = 3.0
    while p <= 9.0:
        for ph in [k * 0.25 for k in range(int(p * 4))]:
            sc = 0.0; x = ph
            while x < n - 1:
                i = int(x); f = x - i; sc += prof[i] * (1 - f) + prof[i + 1] * f; x += p
            sc /= (n / p)
            if best is None or sc > best[0]: best = (sc, p, ph)
        p += 0.02
    return best[1], best[2]

def to_native(src, out_png):
    im = Image.open(src).convert('RGB'); W, H = im.size
    if os.environ.get('GRID'):
        g = [float(v) for v in os.environ['GRID'].split(',')]
        px, py = g[0], g[1] if len(g) > 1 else g[0]; phx = g[2] if len(g) > 2 else 0.0; phy = g[3] if len(g) > 3 else phx
    else:
        px, phx = grid_period(im, 0); py, phy = grid_period(im, 1)
    nw = int((W - phx) / px); nh = int((H - phy) / py)
    out = Image.new('RGB', (nw, nh)); s = im.load(); d = out.load()
    for j in range(nh):
        for i in range(nw):
            d[i, j] = s[min(W - 1, int(phx + (i + 0.5) * px)), min(H - 1, int(phy + (j + 0.5) * py))]
    out.save(out_png)
    print(src, 'grid', round(px, 2), round(py, 2), 'native', out.size)
    return out

def cut(im, name, box, tol=26):
    """flood-fill the background from the box border, keep the largest blob (+ touching bits), save RGBA"""
    px = im.load(); x0, y0, x1, y1 = box; w, h = x1 - x0 + 1, y1 - y0 + 1
    def dist(a, b): return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
    bg = [[False] * w for _ in range(h)]; q = deque()
    for i in range(w):
        for j in (0, h - 1): bg[j][i] = True; q.append((i, j))
    for j in range(h):
        for i in (0, w - 1): bg[j][i] = True; q.append((i, j))
    while q:
        i, j = q.popleft()
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ni, nj = i + di, j + dj
            if 0 <= ni < w and 0 <= nj < h and not bg[nj][ni] and dist(px[x0 + ni, y0 + nj], px[x0 + i, y0 + j]) < tol:
                bg[nj][ni] = True; q.append((ni, nj))
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
                        if 0 <= ni < w and 0 <= nj < h and not bg[nj][ni] and not lab[nj][ni]:
                            lab[nj][ni] = cid; st.append((ni, nj))
            comps.append(pts)
    comps.sort(key=len, reverse=True)
    keep = comps[0]
    for c in comps[1:]:
        if len(c) >= 6 and any(abs(p[0] - k[0]) <= 2 and abs(p[1] - k[1]) <= 2 for p in c[:40] for k in keep[::7]): keep = keep + c
    xs = [p[0] for p in keep]; ys = [p[1] for p in keep]
    bx0, by0, bx1, by1 = min(xs), min(ys), max(xs), max(ys)
    out = Image.new('RGBA', (bx1 - bx0 + 1, by1 - by0 + 1), (0, 0, 0, 0)); o = out.load()
    for (i, j) in keep: o[i - bx0, j - by0] = px[x0 + i, y0 + j] + (255,)
    out.save(name + '.png')
    return out

def crop(im, box): x0, y0, x1, y1 = box; return im.crop((x0, y0, x1 + 1, y1 + 1))
def mask(im, fn):
    px = im.load(); w, h = im.size; return {(x, y) for y in range(h) for x in range(w) if fn(x, y, px[x, y])}
def inpaint(im, m, mode='left'):
    px = im.load(); w, h = im.size; src = {}
    for (x, y) in m:
        if mode == 'left':
            for d in range(1, 5):
                if x - d >= 0 and (x - d, y) not in m and px[x - d, y][3] > 0: src[(x, y)] = px[x - d, y]; break
                if x + d < w and (x + d, y) not in m and px[x + d, y][3] > 0: src[(x, y)] = px[x + d, y]; break
        else:
            for d in range(1, 24):
                if y - d >= 0 and (x, y - d) not in m and px[x, y - d][3] > 0: src[(x, y)] = px[x, y - d]; break
    for (x, y) in m: px[x, y] = src.get((x, y), (0, 0, 0, 0))
    return im
def clear(im, m):
    px = im.load()
    for (x, y) in m: px[x, y] = (0, 0, 0, 0)
    return im
def b64(im): return base64.b64encode(im.tobytes()).decode('ascii')
def part(im, **kw): d = {'w': im.width, 'h': im.height, 'd': b64(im)}; d.update(kw); return d

def main():
    native = to_native('cast.jpg', 'cast_native.png')
    jk = cut(native, 'jk', (28, 15, 63, 128)); vp = cut(native, 'vamp', (60, 36, 101, 128)); md = cut(native, 'maid', (98, 18, 131, 128))
    out = {}
    # JK: mask the sword arm (image left) and the chrome arm + blade (image right), keep black hair; mirror to face +x
    body = crop(jk, (0, 0, 33, 70))
    m = mask(body, lambda x, y, p: p[3] > 0 and ((x <= 6 and 28 <= y <= 70 and not is_hair_black(p)) or (x >= 25 and 34 <= y <= 70 and not is_hair_black(p)) or (x >= 25 and y >= 56) or (x <= 5 and y >= 50)))
    inpaint(body, m, 'left')
    inpaint(body, mask(body, lambda x, y, p: 18 <= x <= 27 and 36 <= y <= 62 and is_chrome(p)), 'left')
    clear(body, mask(body, lambda x, y, p: p[3] > 0 and ((x >= 25 and y >= 56) or (x <= 5 and y >= 50) or (y >= 44 and (x <= 5 or x >= 27) and not is_hair_black(p)))))
    body = body.transpose(Image.FLIP_LEFT_RIGHT)
    boot = crop(jk, (5, 99, 15, 110)).transpose(Image.FLIP_LEFT_RIGHT)
    loafer = crop(jk, (17, 101, 27, 110)); clear(loafer, mask(loafer, lambda x, y, p: p[3] > 0 and sat(p) < 30 and lum(p) > 110)); loafer = loafer.transpose(Image.FLIP_LEFT_RIGHT)
    out['jk'] = {'body': part(body, hip=[16, 49], shN=[6, 28], shF=[28, 28], neck=[17, 24], headBox=[9, 0, 25, 24]),
                 'shoeF': part(boot, ank=[5, 1]), 'shoeN': part(loafer, ank=[5, 1])}
    body.save('p_jk_body.png')
    # vampire: the laptop is its own part; hands / sleeves masked; the jacket behind the laptop inpainted from above
    body = crop(vp, (0, 0, 39, 50))
    lap = crop(vp, (4, 37, 36, 50))
    clear(lap, mask(lap, lambda x, y, p: p[3] == 0 or is_skin(p) or is_reddish(p) or y >= 12 or x <= 2 or x >= 30))
    m = mask(body, lambda x, y, p: p[3] > 0 and 4 <= x <= 36 and 36 <= y <= 50 and not is_reddish(p) and not (lum(p) < 60 and y >= 46))
    inpaint(body, m, 'up')
    clear(body, mask(body, lambda x, y, p: p[3] > 0 and ((y >= 34 and (x <= 8 or x >= 31)) or (26 <= y < 34 and (x <= 7 or x >= 32) and not is_yellowhair(p)))))
    slipL = crop(vp, (2, 78, 17, 87)); slipR = crop(vp, (21, 78, 37, 87))
    for s in (slipL, slipR): clear(s, mask(s, lambda x, y, p: p[3] > 0 and lum(p) < 85))
    out['vamp'] = {'body': part(body, hip=[20, 50], shN=[9, 29], shF=[30, 29], neck=[20, 26], headBox=[2, 0, 38, 36]),
                   'laptop': part(lap, grip=[4, 6]), 'shoeN': part(slipL, ank=[7, 1]), 'shoeF': part(slipR, ank=[8, 1])}
    body.save('p_vamp_body.png'); lap.save('p_vamp_laptop.png')
    # maid: folded hands and sleeves masked, apron inpainted from above
    body = crop(md, (0, 0, 29, 76))
    m = mask(body, lambda x, y, p: p[3] > 0 and ((is_skin(p) and 46 <= y <= 68) or ((x <= 7 or x >= 22) and 30 <= y <= 60 and not is_pink(p) and not is_white(p) and lum(p) < 110)))
    inpaint(body, m, 'up')
    shoeL = crop(md, (3, 98, 14, 106)); shoeR = crop(md, (15, 98, 27, 106))
    out['maid'] = {'body': part(body, hip=[15, 57], shN=[6, 32], shF=[24, 32], neck=[15, 29], headBox=[2, 0, 28, 30]),
                   'shoeN': part(shoeL, ank=[5, 1]), 'shoeF': part(shoeR, ank=[6, 1])}
    body.save('p_maid_body.png')
    js = ('// cast-data.js — the three club members cut from the Gemini pixel sheet (ref/cast.jpg), native pixels,\n'
          '// RGBA base64 per part; JK mirrored to face +x. Generated by ref/extract.py.\n'
          '(function (root) { root.CAST = ' + json.dumps(out) + '; })(typeof window !== "undefined" ? window : globalThis);\n')
    open(os.path.join('..', 'src', 'cast-data.js'), 'w', encoding='utf-8').write(js)
    ims = [Image.open(p + '.png') for p in ['p_jk_body', 'p_vamp_body', 'p_vamp_laptop', 'p_maid_body']]
    S = 8; W = sum(i.width * S + 8 for i in ims) + 8; H = max(i.height for i in ims) * S + 16
    sheet = Image.new('RGBA', (W, H), (70, 80, 92, 255)); x = 8
    for i in ims: sheet.alpha_composite(i.resize((i.width * S, i.height * S), Image.NEAREST), (x, 8)); x += i.width * S + 8
    sheet.save('parts_review.png'); print('cast-data.js written; review', sheet.size)

if __name__ == '__main__':
    main()
