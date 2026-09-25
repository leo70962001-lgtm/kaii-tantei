# frames.py — turn a Gemini action sheet into game frames: resample at the pixel grid, split into cells,
# find each figure's ground anchor (bottom centre of the non-effect pixels) and the effect box (the
# attack's reach), mirror to face +x, and write src/frames-<char>.js.
#   python frames.py <sheet.jpg> <char> [grid]      e.g. python frames.py jk_actions.jpg jk 4
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
border = Counter([px[x, 0] for x in range(W)] + [px[x, H - 1] for x in range(W)] + [px[0, y] for y in range(H)] + [px[W - 1, y] for y in range(H)])
bgc = border.most_common(1)[0][0]
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
cells = [{'pts': c, 'box': box(c)} for c in comps]
# merge small fragments into the nearest big cell whose box they touch (a crescent's tail)
big = [c for c in cells if len(c['pts']) > 300]; small = [c for c in cells if len(c['pts']) <= 300]
for s in small:
    sb = s['box']
    best = None
    for b in big:
        bb = b['box']
        gap = max(0, max(sb[0], bb[0]) - min(sb[2], bb[2])) + max(0, max(sb[1], bb[1]) - min(sb[3], bb[3]))
        if best is None or gap < best[0]: best = (gap, b)
    if best and best[0] <= 12: best[1]['pts'] += s['pts']; best[1]['box'] = box(best[1]['pts'])
cells = big
cells.sort(key=lambda c: (round((c['box'][1] + c['box'][3]) / 2 / 45), c['box'][0]))
# effect pixels: cyan / light blue / electric white; figure pixels: the rest
def is_effect(p):
    r, g, b = p
    if b > 150 and b > r + 40 and g > 105: return True          # cyan-blue glow
    if r > 200 and g > 205 and b > 215: return True             # white core (the shirt is handled by connectivity below)
    return False
out = []
S = 3
sheet = native.resize((W * S, H * S), Image.NEAREST).convert('RGBA'); d = ImageDraw.Draw(sheet)
for i, c in enumerate(cells):
    x0, y0, x1, y1 = c['box']; w, h = x1 - x0 + 1, y1 - y0 + 1
    cell = Image.new('RGBA', (w, h), (0, 0, 0, 0)); o = cell.load()
    for (x, y) in c['pts']: o[x - x0, y - y0] = px[x, y] + (255,)
    # figure = non-effect pixels that sit in the largest 8-connected blob of non-effect pixels
    eff = [[o[x, y][3] > 0 and is_effect(o[x, y][:3]) for x in range(w)] for y in range(h)]
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
    # anchor: ground = the lowest figure row, centre = mean x of the lowest 6 rows (the feet)
    feet = [p for p in fig if p[1] >= fb[3] - 5]
    ax = round(sum(p[0] for p in feet) / len(feet)); ay = fb[3]
    effpts = [(x, y) for y in range(h) for x in range(w) if eff[y][x]]
    eb = box(effpts) if effpts else fb
    # mirror so the figure faces +x (the sheet faces left)
    figimg = Image.new('RGBA', (w, h), (0, 0, 0, 0)); fo = figimg.load()
    for (x, y) in fig: fo[x, y] = o[x, y]
    figm = figimg.transpose(Image.FLIP_LEFT_RIGHT)
    cellm = cell.transpose(Image.FLIP_LEFT_RIGHT)
    axm = w - 1 - ax
    fbm = [w - 1 - fb[2], fb[1], w - 1 - fb[0], fb[3]]; ebm = [w - 1 - eb[2], eb[1], w - 1 - eb[0], eb[3]]
    rel = lambda bb: [bb[0] - axm, bb[1] - ay, bb[2] - axm, bb[3] - ay]  # relative to the anchor (y up is negative)
    out.append({'w': w, 'h': h, 'd': base64.b64encode(cellm.tobytes()).decode('ascii'), 'f': base64.b64encode(figm.tobytes()).decode('ascii'), 'ax': axm, 'ay': ay, 'fig': rel(fbm), 'eff': rel(ebm)})
    figm.save('%s_fig_%02d.png' % (char, i))
    cellm.save('%s_cell_%02d.png' % (char, i))
    d.rectangle([x0 * S, y0 * S, (x1 + 1) * S, (y1 + 1) * S], outline=(255, 80, 80, 255))
    d.rectangle([(x0 + fb[0]) * S, (y0 + fb[1]) * S, (x0 + fb[2] + 1) * S, (y0 + fb[3] + 1) * S], outline=(80, 255, 120, 255))
    d.rectangle([(x0 + eb[0]) * S, (y0 + eb[1]) * S, (x0 + eb[2] + 1) * S, (y0 + eb[3] + 1) * S], outline=(255, 220, 60, 255))
    d.ellipse([(x0 + ax) * S - 4, (y0 + ay) * S - 4, (x0 + ax) * S + 4, (y0 + ay) * S + 4], fill=(255, 255, 0, 255))
    d.text((x0 * S + 2, y0 * S + 2), str(i), fill=(255, 255, 0, 255))
    print(i, 'cell', c['box'], 'figure', fb, 'anchor', (ax, ay), 'effect', eb, 'fig h', fb[3] - fb[1] + 1)
sheet.save(char + '_act_cells.png')
js = ('// frames-%s.js — action frames cut from a Gemini sheet (ref/%s), native pixels mirrored to face +x;\n'
      '// each: RGBA base64, anchor (ax, ay = ground centre), fig / eff boxes relative to the anchor. Generated by ref/frames.py.\n'
      '(function (root) { root.FRAMES = root.FRAMES || {}; root.FRAMES.%s = %s; })(typeof window !== "undefined" ? window : globalThis);\n') % (char, os.path.basename(src), char, json.dumps(out))
open(os.path.join('..', 'src', 'frames-%s.js' % char), 'w', encoding='utf-8').write(js)
print('frames-%s.js' % char, len(js), 'cells', len(out))
