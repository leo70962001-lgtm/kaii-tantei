# clean.py — polish the cut action frames: despeckle JPEG stragglers, snap every colour to one shared
# palette (figure colours + a blue effect ramp) so frames read as clean pixel art, and rewrite
# src/frames-<char>.js with the same anchors / boxes.   python clean.py <char> [colours]
import sys, os, json, base64
from PIL import Image
os.chdir(os.path.dirname(os.path.abspath(__file__)))
char = sys.argv[1]; NCOL = int(sys.argv[2]) if len(sys.argv) > 2 else 40
src = open(os.path.join('..', 'src', 'frames-%s.js' % char), encoding='utf-8').read()
head = 'root.FRAMES.%s = ' % char
data = json.loads(src[src.index(head) + len(head): src.rindex('; })')])
def decode(cell, key):
    im = Image.frombytes('RGBA', (cell['w'], cell['h']), base64.b64decode(cell[key])); return im
cells = [(decode(c, 'd'), decode(c, 'f')) for c in data]
def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
# shared palette from every opaque pixel of every full cell
pix = [p[:3] for im, _ in cells for p in im.getdata() if p[3] > 0]
strip = Image.new('RGB', (len(pix), 1)); strip.putdata(pix)
q = strip.quantize(colors=NCOL, method=Image.Quantize.MEDIANCUT)
pal = q.getpalette()[:NCOL * 3]; pal = [tuple(pal[i:i + 3]) for i in range(0, len(pal), 3)]
# one true outline black for anything very dark
pal = [p for p in pal if lum(p) > 34] + [(14, 12, 24)]
def snap(c):
    if lum(c) <= 40: return (14, 12, 24)
    return min(pal, key=lambda q: (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2)
cache = {}
def snapc(c):
    if c not in cache: cache[c] = snap(c)
    return cache[c]
def despeckle(im):
    px = im.load(); w, h = im.size; kill = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0: continue
            n = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] > 0)
            if n == 0 or (n == 1 and lum(px[x, y]) > 90): kill.append((x, y))
    for (x, y) in kill: px[x, y] = (0, 0, 0, 0)
    return im
def polish(im):
    im = despeckle(im); px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] > 0: px[x, y] = snapc(p[:3]) + (255,)
    return im
out = []
for (full, fig), c in zip(cells, data):
    full = polish(full); fig = polish(fig)
    # figure pixels must exist in the full cell too (they do); keep boxes/anchors
    o = dict(c); o['d'] = base64.b64encode(full.tobytes()).decode('ascii'); o['f'] = base64.b64encode(fig.tobytes()).decode('ascii')
    out.append(o)
    full.save('%s_clean_%02d.png' % (char, len(out) - 1))
js = src[:src.index(head) + len(head)] + json.dumps(out) + src[src.rindex('; })'):]
open(os.path.join('..', 'src', 'frames-%s.js' % char), 'w', encoding='utf-8').write(js)
ims = [Image.open('%s_clean_%02d.png' % (char, i)) for i in range(len(out))]
S = 3; W = sum(i.width * S + 6 for i in ims) + 6; H = max(i.height for i in ims) * S + 12
sheet = Image.new('RGBA', (W, H), (60, 55, 109, 255)); x = 6
for i in ims: sheet.alpha_composite(i.resize((i.width * S, i.height * S), Image.NEAREST), (x, 6)); x += i.width * S + 6
sheet.save('%s_clean_review.png' % char)
print('palette', len(pal), 'cells', len(out), 'review', sheet.size)
