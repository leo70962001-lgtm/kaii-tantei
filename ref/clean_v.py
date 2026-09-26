# clean_v.py — prepare the vector action sheet (ref/jk_actions3v.jpg) for the cutter: paint out the white cell
# numbers (small bright components surrounded by background) so they do not become cells of their own.
#   python clean_v.py  →  ref/jk_actions3v_clean.png (+ a review of what was removed)
import os
from collections import Counter, deque
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
im = Image.open('jk_actions3v.jpg').convert('RGB'); W, H = im.size; px = im.load()
bg = Counter(im.resize((W // 4, H // 4)).getdata()).most_common(1)[0][0]
def isbg(p): return abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) < 48
def bright(p): return min(p) > 185 and max(p) - min(p) < 40
seen = [[False] * W for _ in range(H)]; removed = 0; boxes = []
for y in range(H):
    for x in range(W):
        if seen[y][x] or not bright(px[x, y]): continue
        comp = []; q = deque([(x, y)]); seen[y][x] = True
        while q:
            cx, cy = q.popleft(); comp.append((cx, cy))
            for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and bright(px[nx, ny]): seen[ny][nx] = True; q.append((nx, ny))
        xs = [c[0] for c in comp]; ys = [c[1] for c in comp]
        bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        if not (6 <= bh <= 22 and bw <= 34 and len(comp) <= 260): continue
        # the ring around the box must be (almost all) background: a number floats on the background, highlights don't
        ring = 0; tot = 0
        for yy in range(min(ys) - 3, max(ys) + 4):
            for xx in range(min(xs) - 3, max(xs) + 4):
                if 0 <= xx < W and 0 <= yy < H and (xx < min(xs) - 1 or xx > max(xs) + 1 or yy < min(ys) - 1 or yy > max(ys) + 1):
                    tot += 1; ring += isbg(px[xx, yy])
        if tot and ring / tot > 0.9:
            for yy in range(min(ys) - 2, max(ys) + 3):
                for xx in range(min(xs) - 2, max(xs) + 3):
                    if 0 <= xx < W and 0 <= yy < H and not isbg(px[xx, yy]): px[xx, yy] = bg
            removed += 1; boxes.append((min(xs), min(ys), max(xs), max(ys)))
im.save('jk_actions3v_clean.png'); print('removed', removed, 'number marks', boxes[:8])
