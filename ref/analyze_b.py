# analyze_b.py — finer analysis of the action sheets at SOURCE resolution (sheet B = the baseline):
#   per cell: figure box / height / feet line in source px, height relative to the idle cell (scale drift between
#   poses), the sheet's own material colours (median RGB + luminance percentiles per material → ramps), the outline
#   colour and thickness, and the eye position inside the head (dark blob in the skin region).
#   python analyze_b.py            prints the report and writes ref/art/analysis_b.json (used by refine2.py)
import os, sys, json, base64, math
from collections import Counter, defaultdict
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import importlib.util
spec = importlib.util.spec_from_file_location('r2', 'refine2.py'); r2 = importlib.util.module_from_spec(spec); spec.loader.exec_module(r2)

src, i, j, data = r2.load_cells()
sheets = {t: Image.open(r2.SHEETS[t]).convert('RGB') for t in r2.SHEETS}
GRID = r2.GRID
report = {'cells': {}, 'materials': {}, 'line': {}, 'rows': {}}
mat_px = defaultdict(list); line_runs = Counter()

def cell_source_box(tag, c):
    """the figure's box in source px: the cutter mask (41 grid) dilated by one, pixels that are not background"""
    g, m41, e41 = r2.geom(c); sheet = sheets[tag]; bg = r2.sheet_bg(tag, sheet)
    f = r2.CSCALE if tag == 'C' else 1.0
    nx0 = (g['sX'] - g['ax']) / f; ny0 = (g['sY'] - g['ay']) / f
    X0 = int(nx0 * GRID) - 2; Y0 = int(ny0 * GRID) - 2
    X1 = int((nx0 + g['w'] / f) * GRID) + 2; Y1 = int((ny0 + g['h'] / f) * GRID) + 2
    pts = []
    for y in range(max(0, Y0), min(sheet.height, Y1)):
        for x in range(max(0, X0), min(sheet.width, X1)):
            mx = int((x / GRID - nx0) * f); my = int((y / GRID - ny0) * f)
            inside = any(0 <= mx + dx < g['w'] and 0 <= my + dy < g['h'] and m41[my + dy][mx + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
            if not inside: continue
            p = sheet.getpixel((x, y))
            if abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) < 48: continue
            if r2.is_fx(r2.classify(p, 0.5)): continue
            pts.append((x, y, p))
    if not pts: return None
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys)), pts

for tag in ('A', 'B', 'C', 'V'):
    for c in data[tag]:
        res = cell_source_box(tag, c)
        if not res: continue
        box, pts = res; x0, y0, x1, y1 = box; H = y1 - y0 + 1; W = x1 - x0 + 1
        # materials by height fraction
        skin = []
        for (x, y, p) in pts:
            hy = (y - y0) / max(1, H - 1); m = r2.classify(p, hy)
            if m == 'line': continue
            mat_px[m].append(p)
            if m == 'skin': skin.append((x, y))
        # eye: the darkest pixels inside the skin bbox's upper half (the sheet draws the eye as a dark shape)
        eye = None
        if len(skin) >= 12:
            sx0 = min(s[0] for s in skin); sx1 = max(s[0] for s in skin); sy0 = min(s[1] for s in skin); sy1 = max(s[1] for s in skin)
            cand = [(x, y, p) for (x, y, p) in pts if sx0 <= x <= sx1 and sy0 <= y <= sy0 + (sy1 - sy0) * 0.6 and r2.lum(p) < 60]
            if cand:
                ex = sum(q[0] for q in cand) / len(cand); ey = sum(q[1] for q in cand) / len(cand)
                eye = {'x': round(ex - x0, 1), 'y': round(ey - y0, 1), 'n': len(cand), 'skinBox': [sx0 - x0, sy0 - y0, sx1 - x0, sy1 - y0]}
        # outline thickness: horizontal runs of dark pixels along the figure's rows (median run length)
        rows = defaultdict(list)
        for (x, y, p) in pts:
            if r2.lum(p) < 24: rows[y].append(x)
        for y, xs in rows.items():
            xs.sort(); run = 1
            for k in range(1, len(xs)):
                if xs[k] == xs[k - 1] + 1: run += 1
                else: line_runs[min(run, 12)] += 1; run = 1
            line_runs[min(run, 12)] += 1
        report['cells']['%s%d' % (tag, c['i'])] = {'row': c['row'], 'srcBox': [x0, y0, x1, y1], 'h': H, 'w': W, 'feetY': y1, 'eye': eye}

# heights relative to the idle cell B0 (the baseline)
base = report['cells'].get('B0', {}).get('h')
for k, v in report['cells'].items():
    v['rel'] = round(v['h'] / base, 3) if base else None
rowsH = defaultdict(list)
for k, v in report['cells'].items(): rowsH[(k[0], v['row'])].append(v['h'])
for (t, r), hs in sorted(rowsH.items()): report['rows']['%s%d' % (t, r)] = {'n': len(hs), 'hmin': min(hs), 'hmax': max(hs), 'hmed': sorted(hs)[len(hs) // 2]}

# the sheet's own colours per material: luminance percentiles → 3-tone ramps with the material's median chroma
def pct(vals, q): vals = sorted(vals); return vals[min(len(vals) - 1, int(len(vals) * q))]
for m, px in mat_px.items():
    if len(px) < 30: continue
    L = [r2.lum(p) for p in px]
    med = tuple(pct([p[k] for p in px], 0.5) for k in range(3))
    def at(q):
        lo, hi = pct(L, max(0, q - 0.08)), pct(L, min(1, q + 0.08))
        sel = [p for p in px if lo <= r2.lum(p) <= hi] or px
        return tuple(pct([p[k] for p in sel], 0.5) for k in range(3))
    report['materials'][m] = {'n': len(px), 'median': med, 'shade': at(0.18), 'base': at(0.5), 'light': at(0.86),
                              'L': [round(pct(L, q)) for q in (0.1, 0.3, 0.5, 0.7, 0.9)]}
dark = [p for px in mat_px.values() for p in px if r2.lum(p) < 30]
line_col = tuple(pct([p[k] for p in dark], 0.5) for k in range(3)) if dark else r2.OUT
report['line'] = {'colour': line_col, 'runLengths': dict(sorted(line_runs.items()))}

print('baseline B0 height (source px):', base)
for key in ('B0', 'B1', 'B2', 'B5', 'B6', 'B7', 'B8', 'A5', 'A6', 'A0', 'A14', 'C0'):
    v = report['cells'].get(key)
    if v: print(' %-4s h %3d w %3d feet %4d rel %.2f eye %s' % (key, v['h'], v['w'], v['feetY'], v['rel'], v['eye'] and (v['eye']['x'], v['eye']['y'])))
print('rows:', {k: (v['hmin'], v['hmed'], v['hmax']) for k, v in report['rows'].items()})
print('materials (shade / base / light, L percentiles):')
for m, v in report['materials'].items(): print(' %-7s n %6d  %s %s %s  L %s' % (m, v['n'], v['shade'], v['base'], v['light'], v['L']))
print('line colour', report['line']['colour'], 'dark run lengths', report['line']['runLengths'])
json.dump(report, open(os.path.join('art', 'analysis_b.json'), 'w'), indent=0)
