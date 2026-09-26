# split_v.py — the vector sheet's cutter output (ref/cells.py V) merges two pairs of neighbours whose effects touch:
# V12 = lightning kick + fire kick (the cutter also emitted the left figure again as V44) and V37 = fly + lying.
# Split them at the gap between the figures, recompute each half's anchor (legs' centre: bottom 30 % rows, central
# 70 % of the occupied columns), boxes and sheet anchors: V12 → lightning kick, V44 → fire kick, V37 → fly,
# V45 → lying.   python split_v.py
import os, json, base64
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
path = os.path.join('..', 'src', 'sprites-jk.js')
src = open(path, encoding='utf-8').read(); h0 = 'root.SPRITES.jk = '; i = src.index(h0) + len(h0); j = src.rindex('; })')
data = json.loads(src[i:j]); V = data['V']
def cell(idx): return next(c for c in V if c['i'] == idx)
def anchor(fig):
    px = fig.load(); w, h = fig.size
    rows = [y for y in range(h) if any(px[x, y][3] for x in range(w))]
    if not rows: return w // 2, h - 1
    y1 = rows[-1]; y0 = y1 - max(1, int((y1 - rows[0] + 1) * 0.3))
    cols = sorted(set(x for y in range(y0, y1 + 1) for x in range(w) if px[x, y][3]))
    if not cols: return w // 2, y1
    lo = cols[int(len(cols) * 0.15)]; hi = cols[int(len(cols) * 0.85)]
    return (lo + hi) // 2, y1
def bbox(im, ax, ay):
    px = im.load(); w, h = im.size; xs = [x for y in range(h) for x in range(w) if px[x, y][3]]; ys = [y for y in range(h) for x in range(w) if px[x, y][3]]
    return [min(xs) - ax, min(ys) - ay, max(xs) - ax, max(ys) - ay] if xs else None
def halves(c, cut):
    w, h = c['w'], c['h']
    fig = Image.frombytes('RGBA', (w, h), base64.b64decode(c['f'])); eff = Image.frombytes('RGBA', (w, h), base64.b64decode(c['e'])) if c['e'] else None
    x0 = c['sX'] - c['ax']; y0 = c['sY'] - c['ay']
    out = []
    for (a, b) in ((0, cut), (cut, w)):
        f2 = fig.crop((a, 0, b, h)); e2 = eff.crop((a, 0, b, h)) if eff else None
        if e2 and not any(p[3] for p in e2.getdata()): e2 = None
        ax, ay = anchor(f2)
        out.append({'w': b - a, 'h': h, 'f': base64.b64encode(f2.tobytes()).decode('ascii'), 'e': base64.b64encode(e2.tobytes()).decode('ascii') if e2 else None,
                    'ax': ax, 'ay': ay, 'fig': bbox(f2, ax, ay), 'eff': bbox(e2, ax, ay) if e2 else None, 'ne': sum(1 for p in e2.getdata() if p[3]) if e2 else 0,
                    'sX': x0 + a + ax, 'sY': y0 + ay, 'row': c['row'], 'sheetLeft': c.get('sheetLeft', False)})
    return out
def apply(idx, cut, dst_left, dst_right):
    c = cell(idx); L, R = halves(c, cut)
    for dst, part in ((dst_left, L), (dst_right, R)):
        if dst is None: continue
        tgt = next((q for q in V if q['i'] == dst), None)
        if tgt is None: tgt = {'i': dst}; V.append(tgt)
        tgt.update(part); tgt['i'] = dst; tgt.pop('g41', None); tgt.pop('refined', None)
    print('split V%d at %d → V%s (%dx%d) + V%s (%dx%d)' % (idx, cut, dst_left, L['w'], L['h'], dst_right, R['w'], R['h']))
# file order (after the cutter's row/sX sort): V13 = the merged lightning + fire kicks component (x0 91, 71 wide):
# its figure layer is the RIGHT figure only, the cutter emitted the left figure as its own cell V12 (no effects);
# V38 = fly + lying (x0 187, 65 wide).
c13 = cell(13); cut = 124 - (c13['sX'] - c13['ax']); L, R = halves(c13, cut)
# V12 := the left figure (V12's own pixels) placed on the merged cell's left-half canvas, with that half's effects
c12 = cell(12); w, h = L['w'], L['h']
figL = Image.new('RGBA', (w, h), (0, 0, 0, 0))
f12 = Image.frombytes('RGBA', (c12['w'], c12['h']), base64.b64decode(c12['f']))
ox = (c12['sX'] - c12['ax']) - (c13['sX'] - c13['ax']); oy = (c12['sY'] - c12['ay']) - (c13['sY'] - c13['ay'])
figL.alpha_composite(f12, (ox, oy))
ax, ay = c12['ax'] + ox, c12['ay'] + oy
effL = Image.frombytes('RGBA', (w, h), base64.b64decode(L['e'])) if L['e'] else None
c12.update({'w': w, 'h': h, 'f': base64.b64encode(figL.tobytes()).decode('ascii'), 'e': L['e'], 'ax': ax, 'ay': ay,
            'fig': bbox(figL, ax, ay), 'eff': bbox(effL, ax, ay) if effL else None, 'ne': L['ne'],
            'sX': (c13['sX'] - c13['ax']) + ax, 'sY': (c13['sY'] - c13['ay']) + ay}); c12.pop('g41', None); c12.pop('refined', None)
print('V12 := left figure + left-half effects', (w, h), 'anchor', (ax, ay))
# V13 := the right half (fire kick) with its effects
c13.update(R); c13['i'] = 13; c13.pop('g41', None); c13.pop('refined', None); print('V13 := right half', (R['w'], R['h']))
c38 = cell(38); apply(38, 218 - (c38['sX'] - c38['ax']), 38, 45)
V.sort(key=lambda c: c['i'])
open(path, 'w', encoding='utf-8', newline='\n').write(src[:i] + json.dumps(data) + src[j:]); print('V cells', len(V))
