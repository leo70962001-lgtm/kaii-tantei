# cells.py — the sprite pipeline of the rebuilt game: every Gemini action sheet is cut into sprite cells that the
# engine plays directly (no rig). For each sheet: resample at its 4 px grid, blank the label bands and the box
# frames, split into cells (connected blobs, fragments merged per row), separate the drawn energy / fire effects
# from the figure by colour, find the figure's ground anchor (bottom centre of its lowest rows), mirror to face +x
# and write src/sprites-jk.js:  root.SPRITES.jk = { A: [cells...], B: [...], C: [...] }
#   cell = { i, row, w, h, f: figure RGBA b64, e: effect RGBA b64 | null, ax, ay, fig: [x0,y0,x1,y1] (rel anchor,
#            y up negative), eff: [..] | null, ne: effect pixel count }
# Review: ref/cells_<tag>_review.png (red = cell, green = figure, yellow = effect, dot = anchor, number = index).
#   python cells.py            (all three sheets)      python cells.py C   (one)
import sys, os, json, base64
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from extract import to_native

SHEETS = {'A': 'jk_actions2.jpg', 'B': 'jk_actions3.jpg', 'C': 'jk_actions4.jpg'}
def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
def sat(p): return max(p[:3]) - min(p[:3])
def dist(a, b): return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
# effect colour classes (seeds) and what they may grow through
def is_energy(p):
    r, g, b = p[:3]
    return (g > r + 60 and b > r + 40 and g > 140) or (r > g + 50 and b > g + 50 and b > 150 and r > 120)   # cyan/teal, magenta
def is_fire(p):
    r, g, b = p[:3]
    return (r > 200 and g > 110 and b < 90 and r > g + 40) or (r > 225 and g > 205 and b < 120)             # orange, yellow
def grow_ok(p):
    r, g, b = p[:3]
    return is_energy(p) or is_fire(p) or (g > r + 35 and b > r + 25 and g > 100) or (r > g + 40 and b > g + 40 and b > 120) \
        or (lum(p) > 215 and sat(p) < 40) or (r > 180 and g > 90 and b < 80)

def cut_sheet(tag, src):
    os.environ['GRID'] = '4,4,0,0'
    native = to_native(src, 'cells_%s_native.png' % tag)
    W, H = native.size; px = native.load()
    rowbg = [Counter(px[x, y] for x in range(W)).most_common(1)[0][0] for y in range(H)]
    bright = [rowbg[y] for y in range(H) if lum(rowbg[y]) >= 70]
    bgc = Counter(bright).most_common(1)[0][0]
    bandrows = [y for y in range(H) if lum(rowbg[y]) < 70]
    isbg = [[dist(px[x, y], bgc) < 42 for x in range(W)] for y in range(H)]
    # label bands: whole rows (+-1) are background; the dark frame around C's boxes is reached from the bands
    for y in bandrows:
        for yy in (y - 1, y, y + 1):
            if 0 <= yy < H:
                for x in range(W): isbg[yy][x] = True
    dark = [[lum(px[x, y]) < 48 and sat(px[x, y]) < 50 for x in range(W)] for y in range(H)]
    # the dark box frames of sheet C hang off the label bands: walk from the bands through dark pixels only
    # (never through the background, or every figure's dark outline would be eaten)
    bandset = set(bandrows)
    st = [(x, y) for y in bandrows for x in range(W)] + [(x, y) for y in range(H) for x in (0, W - 1) if dark[y][x]] + [(x, y) for x in range(W) for y in (0, H - 1) if dark[y][x]]
    seen = [[False] * W for _ in range(H)]
    while st:
        x, y = st.pop()
        if x < 0 or y < 0 or x >= W or y >= H or seen[y][x]: continue
        seen[y][x] = True
        if not (dark[y][x] or y in bandset): continue
        isbg[y][x] = True
        st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    # row bands → row index
    starts = []; prev = -5
    for y in bandrows:
        if y != prev + 1: starts.append(y)
        prev = y
    if not starts or starts[0] > 4: starts = [0] + starts
    def rowindex(y): return sum(1 for s in starts if s <= y) - 1
    # components of non-background pixels (3 px tolerance)
    lab = [[0] * W for _ in range(H)]; comps = []
    for y in range(H):
        for x in range(W):
            if isbg[y][x] or lab[y][x]: continue
            cid = len(comps) + 1; pts = []; stack = [(x, y)]; lab[y][x] = cid
            while stack:
                cx, cy = stack.pop(); pts.append((cx, cy))
                for dx in range(-3, 4):
                    for dy in range(-3, 4):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and not isbg[ny][nx] and not lab[ny][nx]:
                            lab[ny][nx] = cid; stack.append((nx, ny))
            comps.append(pts)
    comps = [c for c in comps if len(c) > 40]
    def box(pts):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; return [min(xs), min(ys), max(xs), max(ys)]
    cells = [{'pts': c, 'box': box(c)} for c in comps]
    big = [c for c in cells if len(c['pts']) > 260]; small = [c for c in cells if len(c['pts']) <= 260]
    for s in small:
        sb = s['box']; best = None
        for b in big:
            bb = b['box']
            if rowindex((sb[1] + sb[3]) / 2) != rowindex((bb[1] + bb[3]) / 2): continue
            gap = max(0, max(sb[0], bb[0]) - min(sb[2], bb[2])) + max(0, max(sb[1], bb[1]) - min(sb[3], bb[3]))
            if best is None or gap < best[0]: best = (gap, b)
        if best and best[0] <= 10: best[1]['pts'] += s['pts']; best[1]['box'] = box(best[1]['pts'])
        else: big.append(s)   # a lone effect (projectile, explosion) stays its own cell
    # neighbouring drawings bridged by a blade / smear: split at columns that hold no tall "body" run;
    # thin columns (blades, smears — drawn in front = to the left on the sheet) go to the body on their right
    def split(c):
        pts = c['pts']; cols = {}
        for (x, y) in pts:
            lo, hi = cols.get(x, (y, y)); cols[x] = (min(lo, y), max(hi, y))
        x0, x1 = min(cols), max(cols)
        kind = {}
        spans = {x: (cols[x][1] - cols[x][0] + 1) if x in cols else 0 for x in range(x0, x1 + 1)}
        thr = max(9, round(0.35 * max(spans.values())))   # a lying / flying figure is short: body = relative to the tallest column
        for x in range(x0, x1 + 1):
            sp = spans[x]
            kind[x] = 'B' if sp >= thr else ('T' if sp else 'E')
        runs = []; cur = None
        for x in range(x0, x1 + 1):
            if kind[x] == 'B':
                if cur and x - cur[1] <= 4 and all(kind[xx] != 'E' for xx in range(cur[1] + 1, x)): cur[1] = x
                else: cur = [x, x]; runs.append(cur)
        runs = [r for r in runs if r[1] - r[0] + 1 >= 4]
        if len(runs) <= 1: return [c]
        def owner(x):
            for k, r in enumerate(runs):
                if r[0] <= x <= r[1]: return k
            L = [k for k, r in enumerate(runs) if r[1] < x]; R = [k for k, r in enumerate(runs) if r[0] > x]
            L = L[-1] if L else None; R = R[0] if R else None
            if L is None: return R
            if R is None: return L
            ltouch = all(kind[xx] != 'E' for xx in range(runs[L][1] + 1, x + 1))
            rtouch = all(kind[xx] != 'E' for xx in range(x, runs[R][0]))
            if rtouch: return R          # in front of the body on the right (blades, smears point left on the sheet)
            if ltouch: return L          # trailing hair / a lowered blade behind the body on the left
            return L if x - runs[L][1] <= runs[R][0] - x else R
        groups = {}
        for p in pts: groups.setdefault(owner(p[0]), []).append(p)
        return [{'pts': g, 'box': box(g)} for k, g in sorted(groups.items())]
    cells = [q for c in big for q in split(c)]
    cells.sort(key=lambda c: (rowindex((c['box'][1] + c['box'][3]) / 2), c['box'][0]))
    out = []; S = 3; votes = []; pending = []
    sheet = native.resize((W * S, H * S), Image.NEAREST).convert('RGBA'); d = ImageDraw.Draw(sheet)
    i = -1
    while i + 1 < len(cells):
        i += 1; c = cells[i]
        x0, y0, x1, y1 = c['box']; w, h = x1 - x0 + 1, y1 - y0 + 1
        cell = Image.new('RGBA', (w, h), (0, 0, 0, 0)); o = cell.load()
        for (x, y) in c['pts']: o[x - x0, y - y0] = px[x, y] + (255,)
        # effects: seeds grown through effect-like colours
        eff = [[o[x, y][3] > 0 and (is_energy(o[x, y]) or is_fire(o[x, y])) for x in range(w)] for y in range(h)]
        grow = [(x, y) for y in range(h) for x in range(w) if eff[y][x]]
        while grow:
            gx, gy = grow.pop()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = gx + dx, gy + dy
                    if 0 <= nx < w and 0 <= ny < h and not eff[ny][nx] and o[nx, ny][3] > 0 and grow_ok(o[nx, ny]):
                        eff[ny][nx] = True; grow.append((nx, ny))
        # small effect blobs inside the figure (a glowing forearm) stay with the figure
        seen2 = [[False] * w for _ in range(h)]
        figpts0 = [(x, y) for y in range(h) for x in range(w) if o[x, y][3] > 0 and not eff[y][x]]
        fb0 = box(figpts0) if figpts0 else [0, 0, w - 1, h - 1]
        for y in range(h):
            for x in range(w):
                if not eff[y][x] or seen2[y][x]: continue
                blob = []; stack = [(x, y)]; seen2[y][x] = True
                while stack:
                    cx, cy = stack.pop(); blob.append((cx, cy))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < w and 0 <= ny < h and eff[ny][nx] and not seen2[ny][nx]: seen2[ny][nx] = True; stack.append((nx, ny))
                bb = box(blob)
                inside = bb[0] >= fb0[0] + 2 and bb[2] <= fb0[2] - 2 and bb[1] >= fb0[1] + 2 and bb[3] <= fb0[3] - 2
                if len(blob) < 40 and inside:
                    for (bx, by) in blob: eff[by][bx] = False
        # figure = largest 8-connected non-effect blob + fragments near it
        seen3 = [[False] * w for _ in range(h)]; blobs = []
        for y in range(h):
            for x in range(w):
                if seen3[y][x] or o[x, y][3] == 0 or eff[y][x]: continue
                pts = []; stack = [(x, y)]; seen3[y][x] = True
                while stack:
                    cx, cy = stack.pop(); pts.append((cx, cy))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < w and 0 <= ny < h and not seen3[ny][nx] and o[nx, ny][3] > 0 and not eff[ny][nx]:
                                seen3[ny][nx] = True; stack.append((nx, ny))
                blobs.append(pts)
        blobs.sort(key=len, reverse=True)
        fig = list(blobs[0]) if blobs else []
        extra = []
        for b in blobs[1:]:
            if len(b) > 6 and any(abs(p[0] - q[0]) <= 3 and abs(p[1] - q[1]) <= 3 for p in b[::4] for q in fig[::7]): fig += b
            elif len(b) > 150: extra.append(b)
            elif len(b) > 6 and extra and any(abs(p[0] - q[0]) <= 3 and abs(p[1] - q[1]) <= 3 for p in b[::4] for q in extra[-1][::7]): extra[-1] += b
            else: fig += b   # a detached blade tip / smear piece still belongs to this drawing
        if extra:
            # re-queue the secondary figures as new components (with the effect pixels nearest to them)
            for b in extra:
                bb = box(b)
                cells.append({'pts': [(x + x0, y + y0) for (x, y) in b], 'box': [bb[0] + x0, bb[1] + y0, bb[2] + x0, bb[3] + y0], 'extra': True})
        effpts = [(x, y) for y in range(h) for x in range(w) if eff[y][x]]
        if len(fig) < 60 and effpts:   # an effect-only cell (projectile / explosion)
            effpts += fig; fig = []
        if fig:
            # ground anchor: the legs' centre (bottom 30 % of the figure, central 70 % of its width — not a blade tip / smear)
            fb = box(fig); cx = (fb[0] + fb[2]) / 2; hw = (fb[2] - fb[0] + 1) * 0.35
            legs = [p for p in fig if p[1] >= fb[3] - (fb[3] - fb[1]) * 0.3 and abs(p[0] - cx) <= hw] or fig
            ay = max(p[1] for p in legs); feet = [p for p in legs if p[1] >= ay - 3]
            ax = round(sum(p[0] for p in feet) / len(feet))
        else:
            fb = None; ax, ay = w // 2, h - 1
        eb = box(effpts) if effpts else None
        figimg = Image.new('RGBA', (w, h), (0, 0, 0, 0)); fo = figimg.load()
        for (x, y) in fig: fo[x, y] = o[x, y]
        effimg = Image.new('RGBA', (w, h), (0, 0, 0, 0)); eo = effimg.load()
        for (x, y) in effpts: eo[x, y] = o[x, y]
        # facing on the sheet: the face (skin) sits in front of the dark hair in the head rows
        faceLeft = True
        if fb:
            top = fb[1] + (fb[3] - fb[1]) * 0.38
            skin = [x for (x, y) in fig if y <= top and o[x, y][0] > 170 and 110 < o[x, y][1] < 215 and 80 < o[x, y][2] < 200 and o[x, y][0] - o[x, y][2] > 35]
            hair = [x for (x, y) in fig if y <= top and lum(o[x, y]) < 60 and sat(o[x, y]) < 45]
            if len(skin) >= 4 and len(hair) >= 4: faceLeft = (sum(skin) / len(skin)) < (sum(hair) / len(hair))
        votes.append(faceLeft if (fb and len(skin) >= 4 and len(hair) >= 4) else None)
        pending.append((i, c, x0, y0, w, h, fb, eb, ax, ay, figimg, effimg, effpts, faceLeft))
    # one facing per sheet (a sheet is drawn consistently): the majority of the readable cells decides
    valid = [v for v in votes if v is not None]
    sheetLeft = (sum(1 for v in valid if v) > len(valid) / 2) if valid else True
    print(tag, 'facing on the sheet:', 'LEFT' if sheetLeft else 'RIGHT', '(votes L/R = %d/%d)' % (sum(1 for v in valid if v), sum(1 for v in valid if not v)))
    for (i, c, x0, y0, w, h, fb, eb, ax, ay, figimg, effimg, effpts, faceLeft) in pending:
        x1, y1 = x0 + w - 1, y0 + h - 1
        faceLeft = sheetLeft
        if faceLeft:
            figm = figimg.transpose(Image.FLIP_LEFT_RIGHT); effm = effimg.transpose(Image.FLIP_LEFT_RIGHT)
            axm = w - 1 - ax
            mir = lambda bb: [w - 1 - bb[2], bb[1], w - 1 - bb[0], bb[3]]
        else:
            figm, effm, axm = figimg, effimg, ax
            mir = lambda bb: list(bb)
        rel = lambda bb: [bb[0] - axm, bb[1] - ay, bb[2] - axm, bb[3] - ay]
        row = rowindex((y0 + y1) / 2)
        out.append({'i': i, 'row': row, 'w': w, 'h': h, 'f': base64.b64encode(figm.tobytes()).decode('ascii'),
                    'e': base64.b64encode(effm.tobytes()).decode('ascii') if effpts else None,
                    'ax': axm, 'ay': ay, 'fig': rel(mir(fb)) if fb else None, 'eff': rel(mir(eb)) if eb else None, 'ne': len(effpts),
                    'sX': x0 + ax, 'sY': y0 + ay, 'sheetLeft': faceLeft})
        d.rectangle([x0 * S, y0 * S, (x1 + 1) * S, (y1 + 1) * S], outline=(255, 80, 80, 255))
        if fb: d.rectangle([(x0 + fb[0]) * S, (y0 + fb[1]) * S, (x0 + fb[2] + 1) * S, (y0 + fb[3] + 1) * S], outline=(80, 255, 120, 255))
        if eb: d.rectangle([(x0 + eb[0]) * S, (y0 + eb[1]) * S, (x0 + eb[2] + 1) * S, (y0 + eb[3] + 1) * S], outline=(255, 220, 60, 255))
        d.ellipse([(x0 + ax) * S - 3, (y0 + ay) * S - 3, (x0 + ax) * S + 3, (y0 + ay) * S + 3], fill=(255, 255, 0, 255))
        d.text((x0 * S + 2, y0 * S + 2), '%s%d' % (tag, i), fill=(255, 255, 0, 255))
        print(tag, i, 'row', row, 'box', c['box'], 'fig', (fb[2] - fb[0] + 1, fb[3] - fb[1] + 1) if fb else '-', 'eff px', len(effpts), 'faces', 'L' if faceLeft else 'R')
    sheet.save('cells_%s_review.png' % tag)
    out.sort(key=lambda c: (c['row'], c['sX']))
    for k, c in enumerate(out): c['i'] = k
    return out

tags = sys.argv[1:] or list(SHEETS)
path = os.path.join('..', 'src', 'sprites-jk.js')
data = {}
if os.path.exists(path):
    src = open(path, encoding='utf-8').read(); head = 'root.SPRITES.jk = '
    try: data = json.loads(src[src.index(head) + len(head): src.rindex('; })')])
    except Exception: data = {}
for t in tags: data[t] = cut_sheet(t, SHEETS[t])
js = ('// sprites-jk.js — the JK\'s sprite cells cut from her Gemini action sheets (ref/cells.py): A = ref/jk_actions2.jpg,\n'
      '// B = ref/jk_actions3.jpg, C = ref/jk_actions4.jpg. Each cell: figure (f) and effect (e) RGBA base64, anchor (ax, ay =\n'
      '// ground centre in cell px), fig / eff boxes relative to the anchor (y up negative), row = sheet row. Facing +x.\n'
      '(function (root) { root.SPRITES = root.SPRITES || {}; root.SPRITES.jk = ' + json.dumps(data) + '; })(typeof window !== "undefined" ? window : globalThis);\n')
open(path, 'w', encoding='utf-8').write(js)
print('sprites-jk.js', len(js), {t: len(v) for t, v in data.items()})
