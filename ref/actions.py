# actions.py — analyse a Gemini action sheet (poses + baked slash effects on a flat background):
# resample to the native pixel grid, split it into pose cells by connected components (effects included),
# and write a numbered contact sheet + one RGBA PNG per cell.  python actions.py <sheet.jpg> <outprefix>
import sys, os
from PIL import Image, ImageDraw
from collections import deque
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import to_native

src, pre = sys.argv[1], sys.argv[2]
os.chdir(os.path.dirname(os.path.abspath(__file__)))
native = to_native(src, pre + '_native.png')
W, H = native.size; px = native.load()
# background colour = the most common colour along the border
from collections import Counter
border = Counter([px[x, 0] for x in range(W)] + [px[x, H - 1] for x in range(W)] + [px[0, y] for y in range(H)] + [px[W - 1, y] for y in range(H)])
bgc = border.most_common(1)[0][0]
print('background', bgc)
def dist(a, b): return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
fg = [[dist(px[x, y], bgc) > 40 for x in range(W)] for y in range(H)]
# connected components with a generous 3-px bridge so a figure and its effect stay together
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
cells = []
for c in comps:
    xs = [p[0] for p in c]; ys = [p[1] for p in c]
    cells.append({'box': (min(xs), min(ys), max(xs), max(ys)), 'pts': c})
# order by rows (top to bottom), then x
cells.sort(key=lambda c: (round((c['box'][1] + c['box'][3]) / 2 / 40), c['box'][0]))
S = 3
sheet = native.resize((W * S, H * S), Image.NEAREST).convert('RGBA'); d = ImageDraw.Draw(sheet)
for i, c in enumerate(cells):
    x0, y0, x1, y1 = c['box']
    out = Image.new('RGBA', (x1 - x0 + 1, y1 - y0 + 1), (0, 0, 0, 0)); o = out.load()
    for (x, y) in c['pts']: o[x - x0, y - y0] = px[x, y] + (255,)
    out.save('%s_%02d.png' % (pre, i))
    d.rectangle([x0 * S, y0 * S, (x1 + 1) * S, (y1 + 1) * S], outline=(255, 80, 80, 255))
    d.text((x0 * S + 2, y0 * S + 2), str(i), fill=(255, 255, 0, 255))
    print(i, 'box', c['box'], 'size', out.size, 'px', len(c['pts']))
sheet.save(pre + '_cells.png'); print('cells', len(cells))
