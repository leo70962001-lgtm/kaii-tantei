# cellstrips.py — per-row zoom strips of the cut sprite cells with big indices, for authoring the move table
import os, sys, json, base64
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
SCR = 'C:/Users/user/AppData/Local/Temp/claude/D--ai/5bd4dff7-fd0e-44e0-a045-9cd3c236252f/scratchpad/'
src = open('../src/sprites-jk.js', encoding='utf-8').read(); head = 'root.SPRITES.jk = '
data = json.loads(src[src.index(head) + len(head): src.rindex('; })')])
S = 4
for tag, cells in data.items():
    rows = {}
    for c in cells: rows.setdefault(c['row'], []).append(c)
    for r, cs in sorted(rows.items()):
        ims = []
        for c in cs:
            f = Image.frombytes('RGBA', (c['w'], c['h']), base64.b64decode(c['f']))
            if c['e']: f.alpha_composite(Image.frombytes('RGBA', (c['w'], c['h']), base64.b64decode(c['e'])))
            ims.append((c, f))
        W = sum(im.width * S + 14 for _, im in ims) + 14; H = max(im.height for _, im in ims) * S + 40
        sheet = Image.new('RGBA', (W, H), (124, 150, 163, 255)); d = ImageDraw.Draw(sheet); x = 14
        for c, im in ims:
            sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, 28))
            gy = 28 + (c['ay'] + 1) * S; d.line([(x, gy), (x + im.width * S, gy)], fill=(255, 240, 80, 255), width=1)
            d.rectangle([x + c['ax'] * S - 2, gy - 2, x + c['ax'] * S + S + 2, gy + 2], fill=(255, 60, 60, 255))
            d.text((x + 2, 6), '%s%d  %dx%d' % (tag, c['i'], im.width, im.height), fill=(255, 255, 0, 255))
            x += im.width * S + 14
        sheet.save(SCR + 'strip_%s_r%d.png' % (tag, r)); print(tag, 'row', r, [c['i'] for c in cs], sheet.size)
