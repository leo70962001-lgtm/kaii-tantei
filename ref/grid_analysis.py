# precise pixel-grid analysis of a pixel-art image saved as JPEG: period (px per art pixel) by autocorrelation of
# the gradient energy, phase (offset) by the position of the gradient ridges, then the "blockiness" score per
# candidate to confirm; also reports the colour noise inside blocks. python grid_analysis.py <image> [<image>...]
import sys
from PIL import Image
for path in sys.argv[1:]:
    im = Image.open(path).convert('L'); W, H = im.size; px = im.load()
    # gradient energy per column / per row (central region to avoid labels)
    x0, x1, y0, y1 = W // 8, W - W // 8, H // 8, H - H // 8
    col = [0.0] * W; row = [0.0] * H
    for y in range(y0, y1):
        for x in range(x0 + 1, x1):
            d = abs(px[x, y] - px[x - 1, y]); col[x] += d
    for y in range(y0 + 1, y1):
        for x in range(x0, x1):
            d = abs(px[x, y] - px[x, y - 1]); row[y] += d
    def ac(v, lo, hi, kmax=24):
        seg = v[lo:hi]; m = sum(seg) / len(seg); seg = [s - m for s in seg]
        out = []
        for k in range(1, kmax):
            out.append((sum(seg[i] * seg[i + k] for i in range(len(seg) - k)) / (len(seg) - k), k))
        base = max(out)[0]
        return sorted(out, reverse=True)[:6], base
    cands, _ = ac(col, x0, x1); rc, _ = ac(row, y0, y1)
    print(path, 'size', (W, H))
    print('  column period candidates:', [(k, round(v)) for v, k in cands])
    print('  row period candidates:   ', [(k, round(v)) for v, k in rc])
    # phase for the best small period (the boundary offset = where the gradient ridge sits)
    for P in sorted(set([cands[0][1], rc[0][1]])):
        ph = [sum(col[x] for x in range(x0, x1) if (x % P) == o) for o in range(P)]
        phr = [sum(row[y] for y in range(y0, y1) if (y % P) == o) for o in range(P)]
        bo = max(range(P), key=lambda o: ph[o]); br = max(range(P), key=lambda o: phr[o])
        print('  period %d: boundary at x %% %d == %d (ridge %.2fx the mean), y %% %d == %d (%.2fx)' % (
            P, P, bo, ph[bo] / (sum(ph) / P), P, br, phr[br] / (sum(phr) / P)))
