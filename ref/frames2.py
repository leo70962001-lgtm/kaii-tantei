# frames2.py — like frames.py, for Gemini sheets with dark row-label bands: the bands (and their text) are
# blanked, cells are grouped by the band above them, figures that touch are split at empty columns, and the
# cyan energy effects are separated from the figure (small glows on the cyborg arm stay with the figure).
#   python frames2.py <sheet.jpg> <char> [grid]      e.g. python frames2.py jk_actions2.jpg jk2 4
import sys, os, json, base64
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from extract import to_native
from collections import Counter

src, char = sys.argv[1], sys.argv[2]
grid = sys.argv[3] if len(sys.argv) > 3 else None
if grid: os.environ['GRID'] = grid + ',' + grid + ',0,0'
native = to_native(src, char + '_act_native.png')
W, H = native.size; px = native.load()
def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
rowbg = [Counter(px[x, y] for x in range(W)).most_common(1)[0][0] for y in range(H)]
bandrows = sorted(y for y in range(H) if lum(rowbg[y]) < 70)
bgc = Counter(rowbg[y] for y in range(H) if y not in set(bandrows)).most_common(1)[0][0]
starts = []; prev = -5
for y in bandrows:
    if y != prev + 1: starts.append(y)
    prev = y
blank = set()
for y in bandrows: blank.update((y - 1, y, y + 1))
for y in blank:
    if 0 <= y < H:
        for x in range(W): px[x, y] = bgc
print('bands start at rows', starts, 'bg', bgc)
def rowindex(y): return sum(1 for s in starts if s <= y)
def dist(a, b): return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
fg = [[dist(px[x, y], bgc) > 40 for x in range(W)] for y in range(H)]
lab = [[0] * W for _ in range(H)]; comps = []
for y in range(H):
    for x in range(W):
        if not fg[y][x] or lab[y][x]: continue
        cid = len(comps) + 1; pts = []; st = [(x, y)]; lab[y][x] = cid
        while st:
            cx, cy = st.pop(); pts.append((cx, cy))
            for dx in range(-3, 4):
                for dy in range(-3, 4):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < W and 0 <= ny < H and fg[ny][nx] and not lab[ny][nx]:
                        lab[ny][nx] = cid; st.append((nx, ny))
        comps.append(pts)
comps = [c for c in comps if len(c) > 60]
def box(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; return [min(xs), min(ys), max(xs), max(ys)]
# split components that hold two figures side by side: cut at empty columns when both sides are big
def split(pts):
    b = box(pts); cols = Counter(p[0] for p in pts)
    empty = [x for x in range(b[0], b[2] + 1) if cols.get(x, 0) == 0]
    if not empty: return [pts]
    runs = []; s = empty[0]; e = empty[0]
    for x in empty[1:]:
        if x == e + 1: e = x
        else: runs.append((s, e)); s = e = x
    runs.append((s, e))
    parts = [pts]
    for (s, e) in runs:
        cut = (s + e) / 2
        left = [p for p in parts[-1] if p[0] < cut]; right = [p for p in parts[-1] if p[0] > cut]
        if len(left) >= 300 and len(right) >= 300: parts[-1] = left; parts.append(right)
    return parts
comps = [q for c in comps for q in split(c)]
cells = [{'pts': c, 'box': box(c)} for c in comps]
big = [c for c in cells if len(c['pts']) > 300]; small = [c for c in cells if len(c['pts']) <= 300]
for s in small:
    sb = s['box']; best = None
    for b in big:
        bb = b['box']
        if rowindex((sb[1] + sb[3]) / 2) != rowindex((bb[1] + bb[3]) / 2): continue
        gap = max(0, max(sb[0], bb[0]) - min(sb[2], bb[2])) + max(0, max(sb[1], bb[1]) - min(sb[3], bb[3]))
        if best is None or gap < best[0]: best = (gap, b)
    if best and best[0] <= 12: best[1]['pts'] += s['pts']; best[1]['box'] = box(best[1]['pts'])
cells = big
cells.sort(key=lambda c: (rowindex((c['box'][1] + c['box'][3]) / 2), c['box'][0]))
# energy colours: cyan / teal / mint glow and the magenta core of the shot; never whites or the skirt's grey-blue
def is_seed(p):
    r, g, b = p
    return g > r + 60 and b > r + 40 and g > 140
def is_glow(p):
    r, g, b = p
    return (g > r + 35 and b > r + 25 and g > 100) or (r > g + 40 and b > g + 40 and b > 120)
out = []; S = 3
sheet = native.resize((W * S, H * S), Image.NEAREST).convert('RGBA'); d = ImageDraw.Draw(sheet)
for i, c in enumerate(cells):
    x0, y0, x1, y1 = c['box']; w, h = x1 - x0 + 1, y1 - y0 + 1
    cell = Image.new('RGBA', (w, h), (0, 0, 0, 0)); o = cell.load()
    for (x, y) in c['pts']: o[x - x0, y - y0] = px[x, y] + (255,)
    eff = [[o[x, y][3] > 0 and is_seed(o[x, y][:3]) for x in range(w)] for y in range(h)]
    grow = [(x, y) for y in range(h) for x in range(w) if eff[y][x]]
    while grow:
        gx, gy = grow.pop()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = gx + dx, gy + dy
                if 0 <= nx < w and 0 <= ny < h and not eff[ny][nx] and o[nx, ny][3] > 0 and is_glow(o[nx, ny][:3]):
                    eff[ny][nx] = True; grow.append((nx, ny))
    # figure region = everything that is not effect; effect blobs that stay inside it (arm glow) go back to the figure
    figpts = [(x, y) for y in range(h) for x in range(w) if o[x, y][3] > 0 and not eff[y][x]]
    fr = box(figpts) if figpts else [0, 0, w - 1, h - 1]
    seen = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if not eff[y][x] or seen[y][x]: continue
            blob = []; st = [(x, y)]; seen[y][x] = True
            while st:
                cx, cy = st.pop(); blob.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and eff[ny][nx] and not seen[ny][nx]: seen[ny][nx] = True; st.append((nx, ny))
            bb = box(blob)
            outside = bb[0] < fr[0] + 3 or bb[2] > fr[2] - 3 or bb[1] < fr[1] + 3 or bb[3] > fr[3] - 3
            if len(blob) < 120 and not (len(blob) >= 30 and outside):
                for (bx, by) in blob: eff[by][bx] = False
    seen = [[False] * w for _ in range(h)]; blobs = []
    for y in range(h):
        for x in range(w):
            if seen[y][x] or o[x, y][3] == 0 or eff[y][x]: continue
            pts = []; st = [(x, y)]; seen[y][x] = True
            while st:
                cx, cy = st.pop(); pts.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and o[nx, ny][3] > 0 and not eff[ny][nx]:
                            seen[ny][nx] = True; st.append((nx, ny))
            blobs.append(pts)
    blobs.sort(key=len, reverse=True)
    fig = blobs[0]
    for b in blobs[1:]:
        if len(b) > 12 and any(abs(p[0] - q[0]) <= 3 and abs(p[1] - q[1]) <= 3 for p in b[::5] for q in fig[::9]): fig += b
    fb = box(fig)
    feet = [p for p in fig if p[1] >= fb[3] - 5]
    ax = round(sum(p[0] for p in feet) / len(feet)); ay = fb[3]
    effpts = [(x, y) for y in range(h) for x in range(w) if eff[y][x]]
    eb = box(effpts) if effpts else fb
    figimg = Image.new('RGBA', (w, h), (0, 0, 0, 0)); fo = figimg.load()
    for (x, y) in fig: fo[x, y] = o[x, y]
    figm = figimg.transpose(Image.FLIP_LEFT_RIGHT); cellm = cell.transpose(Image.FLIP_LEFT_RIGHT)
    axm = w - 1 - ax
    fbm = [w - 1 - fb[2], fb[1], w - 1 - fb[0], fb[3]]; ebm = [w - 1 - eb[2], eb[1], w - 1 - eb[0], eb[3]]
    rel = lambda bb: [bb[0] - axm, bb[1] - ay, bb[2] - axm, bb[3] - ay]
    row = rowindex((y0 + y1) / 2)
    out.append({'w': w, 'h': h, 'd': base64.b64encode(cellm.tobytes()).decode('ascii'), 'f': base64.b64encode(figm.tobytes()).decode('ascii'), 'ax': axm, 'ay': ay, 'fig': rel(fbm), 'eff': rel(ebm), 'row': row, 'ne': len(effpts)})
    figm.save('%s_fig_%02d.png' % (char, i)); cellm.save('%s_cell_%02d.png' % (char, i))
    d.rectangle([x0 * S, y0 * S, (x1 + 1) * S, (y1 + 1) * S], outline=(255, 80, 80, 255))
    d.rectangle([(x0 + fb[0]) * S, (y0 + fb[1]) * S, (x0 + fb[2] + 1) * S, (y0 + fb[3] + 1) * S], outline=(80, 255, 120, 255))
    if effpts: d.rectangle([(x0 + eb[0]) * S, (y0 + eb[1]) * S, (x0 + eb[2] + 1) * S, (y0 + eb[3] + 1) * S], outline=(255, 220, 60, 255))
    d.ellipse([(x0 + ax) * S - 4, (y0 + ay) * S - 4, (x0 + ax) * S + 4, (y0 + ay) * S + 4], fill=(255, 255, 0, 255))
    d.text((x0 * S + 2, y0 * S + 2), str(i), fill=(255, 255, 0, 255))
    print(i, 'row', row, 'cell', c['box'], 'fig h', fb[3] - fb[1] + 1, 'w', fb[2] - fb[0] + 1, 'anchor', (ax, ay), 'effect px', len(effpts), 'eff rel', rel(ebm) if effpts else '-')
sheet.save(char + '_act_cells.png')
header = """// frames-%s.js — action frames cut from a Gemini sheet (ref/%s), native pixels mirrored to face +x;
// each: RGBA base64, anchor (ax, ay = ground centre), fig / eff boxes relative to the anchor, row = sheet row. Generated by ref/frames2.py.
""" % (char, os.path.basename(src))
js = header + '(function (root) { root.FRAMES = root.FRAMES || {}; root.FRAMES.%s = %s; })(typeof window !== "undefined" ? window : globalThis);' % (char, json.dumps(out)) + chr(10)
open(os.path.join('..', 'src', 'frames-%s.js' % char), 'w', encoding='utf-8').write(js)
print('frames-%s.js' % char, len(js), 'cells', len(out))
