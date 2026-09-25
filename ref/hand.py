# hand.py — hand-drawn pixel frames at the small sprite scale (a standing figure is 41 px, shown ×2 in the game).
# Drawn from the standing picture's features (black hair with the white streak, red eyes, sailor top with the red
# scarf, blue pleated skirt, steel left arm, chrome right leg, black stocking, katana) with the action sheets as
# pose reference and Slynyrd's seven-beat sword attack as the animation model. Parts are hand-pixelled ASCII
# bitmaps (one letter per pixel, palette below); a frame composes them at hand-chosen offsets, draws the arms,
# the blade and the smear as pixel lines / wedges, and re-inks the silhouette. Output: ref/art/H<n>.png (+ H<n>e.png
# for a frame's effect layer) and ref/art/hand.json (anchors), read by pixelize.py as sheet 'H'.
#   python hand.py   → also ref/art/hand_review.png (×8)
import os, json, math
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw

PAL = {
    'k': '0e0c18',
    'h': '1c1e30', 'H': '363a56', 'w': 'd0d4e0',
    's': 'f2cbb0', 'S': 'd8a48c', 'e': 'c42c3e', 'o': '8e1d2a',   # o = open mouth
    'u': 'f5f7fb', 'U': 'c6ccdc',
    'c': '364a86', 'C': '5871b2',
    'r': 'd63242', 'R': '8e1d2a',
    'b': '4c5c98', 'B': '303c6a', 'L': '6a7ab8',
    'm': 'e2e8f2', 'M': '9ea8c0', 'd': '5a6280', 'g': '8ed8a8', 'q': 'd690d0',
    't': '2c2e40', 'T': '464a62',
    'n': '1c1e2c', 'N': '3a3c50',
    'v': 'e6ecf4', 'V': '8a92ac',
    'x': '7c2232', 'X': 'd0404a', 'y': 'c8a24c',
    'a': 'dfe9ff', 'A': '9fc4e8', 'i': '6a9ad0',   # smear: core, mid, edge
    '.': None,
}
def rgb(hx): return tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

# ---------------------------------------------------------------- hand-drawn parts (facing right)
HEAD = [                      # 13×11, neck at the bottom centre-right; face on the right
    "....kkkkkk...",
    "...khhhhhhk..",
    "..khhhhHhhhk.",
    ".khhhhHhhhhhk",
    ".khhhhhkwsssk",
    "khhhHhhkssssk",
    "khhhHhhkskesk",
    "khhhhHhkssssk",
    "khhhhHhhksssk",
    "khhhhhHhhkssk",
    ".khhhhhHhhkSk",
]
HEAD_SHOUT = HEAD[:9] + ["khhhhhHhhkosk", ".khhhhhHhhkSk"]      # mouth open on the chin row
HEAD_HURT = HEAD[:6] + ["khhhHhhksSssk", "khhhhHhkkkssk", "khhhhHhhksssk", "khhhhhHhhkssk", ".khhhhhHhhkSk"]  # eye shut
HAIR_BACK = [                 # 7×16: the long mass down the back, tapering
    "khhhhhH",
    "khhhhhH",
    "khhhhHk",
    "khhhhHk",
    "khhhHkk",
    "khhhHk.",
    "khhhHk.",
    "khhHk..",
    "khhHk..",
    "khhk...",
    "khHk...",
    "khhk...",
    ".khk...",
    ".khk...",
    ".khk...",
    "..k....",
]
TORSO = [                     # 10×8: collar, scarf, top, midriff (neck at x4 of row 0)
    "kkccccck..",
    "kcrrcckk..",
    "kurrcuuk..",
    "kuRruuuk..",
    "kuuuuuuk..",
    "kuUuuuuk..",
    "kUuuuuuk..",
    "kssssssk..",
]
SKIRT = [                     # 12×8: waistband, pleats, light on the front edge, hem ink
    "kBbBbBbBk...",
    "kbBbBbBbLk..",
    "kbBbBbBbLk..",
    "kbBbBbBbBLk.",
    "kbBbBbBbBLk.",
    "kbBbBbBbbLLk",
    "kbBbBbBbBbLk",
    "kkkkkkkkkkkk",
]
LEG_STOCK = [                 # 5×12 straight stocking leg
    "kttTk", "kttTk", "kttTk", "ktttk", "kttTk", "ktttk", "ktTtk", "kttTk", "ktttk", "kttTk", "ktttk", "kttTk",
]
LEG_CHROME = [                # 5×12 straight chrome leg (light on the front)
    "kmMdk", "kmMdk", "kmMdk", "kMdMk", "kmMdk", "kmMdk", "kmMdk", "kMdMk", "kmMdk", "kmMdk", "kmMdk", "kmMdk",
]
SHOE = ["kNnnnk", "kNnnnnk", "kkkkkkk"]   # 7×3 (drawn with the toe to the right)
SLEEVE = ["kuk", "kuuk", "kUuk", "kkk."]  # 4×4 near sleeve puff

# ---------------------------------------------------------------- composition helpers
class Canvas:
    def __init__(self, w, h): self.w, self.h = w, h; self.g = [['.'] * w for _ in range(h)]
    def put(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h and ch != '.': self.g[y][x] = ch
    def get(self, x, y): return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.'
    def blit(self, part, x0, y0, over=True):
        for j, r in enumerate(part):
            for i, ch in enumerate(r):
                if ch == '.': continue
                if not over and self.get(x0 + i, y0 + j) != '.': continue
                self.put(x0 + i, y0 + j, ch)
    def line(self, x0, y0, x1, y1, ch, thick=1, side=(0, 1), ch2=None):
        """Bresenham line; thick 2 adds ch2 (or ch) on the `side` offset"""
        dx, dy = abs(x1 - x0), -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; err = dx + dy
        x, y = x0, y0
        while True:
            self.put(x, y, ch)
            if thick > 1: self.put(x + side[0], y + side[1], ch2 or ch)
            if x == x1 and y == y1: break
            e2 = 2 * err
            if e2 >= dy: err += dy; x += sx
            if e2 <= dx: err += dx; y += sy
    def wedge(self, cx, cy, r0, r1, a0, a1, chars=('a', 'A', 'i')):
        """a smear: an annular sector from angle a0 to a1 (deg, y down), light core → mid → edge by radius"""
        for y in range(self.h):
            for x in range(self.w):
                dx, dy = x - cx, y - cy; r = math.hypot(dx, dy)
                if r < r0 or r > r1: continue
                a = math.degrees(math.atan2(dy, dx))
                lo, hi = (a0, a1) if a0 <= a1 else (a1, a0)
                if not (lo <= a <= hi): continue
                t = (r - r0) / max(1, r1 - r0)
                self.put(x, y, chars[0] if t < 0.45 else chars[1] if t < 0.8 else chars[2])
    def ink(self):
        """a dark outline outside every non-ink edge (the sprite silhouette), like the references"""
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.g[y][x] != '.': continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    c = self.get(x + dx, y + dy)
                    if c not in ('.', 'k', 'a', 'A', 'i'): add.append((x, y)); break
        for (x, y) in add: self.g[y][x] = 'k'
    def rows(self): return [''.join(r) for r in self.g]
    def image(self, chars=None):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0)); px = im.load()
        for y in range(self.h):
            for x in range(self.w):
                ch = self.g[y][x]
                if ch == '.' or (chars is not None and ch not in chars) or (chars is None and ch in ('a', 'A', 'i')): continue
                px[x, y] = rgb(PAL[ch])
        return im
    def image_fx(self):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0)); px = im.load(); any_ = False
        for y in range(self.h):
            for x in range(self.w):
                ch = self.g[y][x]
                if ch in ('a', 'A', 'i'): px[x, y] = rgb(PAL[ch]); any_ = True
        return im if any_ else None

def arm(c, pts, ch='s', ch2='S'):
    """an arm as a 2-px line through the given joints (elbow → wrist ...), shade below"""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]): c.line(x0, y0, x1, y1, ch, thick=2, side=(0, 1), ch2=ch2)
def steel_arm(c, pts): arm(c, pts, 'm', 'M')
def hand(c, x, y, ch='s'): c.blit([ch + ch, ch + 'S' if ch == 's' else ch + 'M'], x, y)
def katana(c, hx, hy, ang, blade=18, layer=None):
    """the katana held at (hx, hy): hilt 3 px behind the hand, guard, blade `blade` px along `ang` (deg, y down)"""
    a = math.radians(ang); ux, uy = math.cos(a), math.sin(a)
    # hilt behind the hand (opposite direction)
    for i in (1, 2, 3): c.put(round(hx - ux * i), round(hy - uy * i), 'X' if i % 2 else 'x')
    # guard
    gx, gy = round(hx + ux * 1), round(hy + uy * 1)
    c.put(gx, gy, 'y'); c.put(gx - round(uy), gy + round(ux), 'y'); c.put(gx + round(uy), gy - round(ux), 'y')
    # blade: 2 px, light on the top/front edge, dark on the back
    x0, y0 = round(hx + ux * 2), round(hy + uy * 2); x1, y1 = round(hx + ux * (2 + blade)), round(hy + uy * (2 + blade))
    # the second pixel row of the blade sits beside the first along the line's minor axis (a solid 2-px stroke)
    side = (0, 1) if abs(ux) >= abs(uy) else (1 if ux < 0 else -1, 0)
    c.line(x0, y0, x1, y1, 'v', thick=2, side=side, ch2='V')

FRAMES = []
def frame(name, cell_note, anchor, build, size=(30, 46)):
    c = Canvas(*size); build(c); c.ink()
    FRAMES.append((name, cell_note, anchor, c))

# ---------------------------------------------------------------- the body at rest (shared by several frames)
def body_stance(c, ox, oy, head=HEAD):
    """ox, oy = the torso's top-left; returns key joints"""
    c.blit(HAIR_BACK, ox - 6, oy - 1)
    c.blit(SKIRT, ox - 1, oy + 8)
    c.blit(LEG_STOCK, ox, oy + 15); c.blit(SHOE, ox - 1, oy + 27)
    c.blit(LEG_CHROME, ox + 5, oy + 15); c.blit(SHOE, ox + 5, oy + 27)
    c.blit(TORSO, ox, oy)
    c.blit(head, ox - 2, oy - 10)
    return { 'shN': (ox + 7, oy + 1), 'shF': (ox + 1, oy + 1), 'hip': (ox + 4, oy + 8) }

def stance(c):
    J = body_stance(c, 8, 12)
    steel_arm(c, [(J['shF'][0] - 4, J['shF'][1] + 2), (J['shF'][0] - 5, J['shF'][1] + 9)]); hand(c, 3, 22, 'm')
    c.blit(SLEEVE, 16, 12)
    arm(c, [(17, 16), (16, 19)]); hand(c, 16, 20)
    katana(c, 17, 21, 130, blade=20)          # blade down-back through the legs (the picture's pose)
    # the blade behind the chrome leg: re-draw the leg over it
    c.blit(LEG_CHROME, 13, 27); c.blit(SHOE, 13, 39)
frame('stance', 'idle', (12, 41), stance, size=(24, 42))

def stance_breath(c):
    J = body_stance(c, 8, 13)
    steel_arm(c, [(J['shF'][0] - 4, J['shF'][1] + 2), (J['shF'][0] - 5, J['shF'][1] + 9)]); hand(c, 3, 23, 'm')
    c.blit(SLEEVE, 16, 13)
    arm(c, [(17, 17), (16, 20)]); hand(c, 16, 21)
    katana(c, 17, 22, 130, blade=20)
    c.blit(LEG_CHROME, 13, 27); c.blit(SHOE, 13, 39)
frame('stance2', 'idle 2 (chest down 1)', (12, 41), stance_breath, size=(24, 42))

# ---------------------------------------------------------------- 袈裟斬: Slynyrd's seven beats
def kesa_antic(c):            # sword raised over the shoulder, both hands, weight back
    c.blit(HAIR_BACK, 3, 12); c.blit(SKIRT, 8, 21)
    c.blit(LEG_STOCK, 8, 28); c.blit(SHOE, 7, 40)
    c.blit(LEG_CHROME, 15, 28); c.blit(SHOE, 15, 40)
    c.blit(TORSO, 9, 13); c.blit(HEAD, 7, 3)
    steel_arm(c, [(11, 14), (12, 9), (14, 6)]); hand(c, 14, 5, 'm')
    c.blit(SLEEVE, 17, 13); arm(c, [(18, 14), (18, 9), (16, 6)]); hand(c, 16, 5)
    katana(c, 16, 5, -125, blade=16)
frame('kesa_antic', 'anticipation 100 ms', (13, 42), kesa_antic, size=(30, 43))

def kesa_smear(c):            # the cut in flight: arms forward-down, the blade replaced by the smear wedge
    c.wedge(12, 20, 16, 25, -72, 42)
    c.blit(HAIR_BACK, 2, 12); c.blit(SKIRT, 8, 21)
    c.blit(LEG_STOCK, 6, 28); c.blit(SHOE, 5, 40)
    c.blit(LEG_CHROME, 16, 28); c.blit(SHOE, 16, 40)
    c.blit(TORSO, 9, 13); c.blit(HEAD_SHOUT, 8, 3)
    steel_arm(c, [(11, 15), (16, 18)]); hand(c, 17, 18, 'm')
    c.blit(SLEEVE, 17, 13); arm(c, [(19, 15), (20, 18)]); hand(c, 20, 18)
frame('kesa_smear', 'smear 50 ms', (12, 42), kesa_smear, size=(38, 43))

def kesa_hit(c):              # the blade fully extended down-forward, lunge, held
    c.blit(HAIR_BACK, 1, 12); c.blit(SKIRT, 8, 21)
    c.blit(LEG_STOCK, 5, 28); c.blit(SHOE, 4, 40)
    c.blit(["kmMdk", "kmMdk", "kmMdk", "kkMdMk", ".kmMdk", ".kmMdk", ".kmMdk", "..kMdMk", "..kmMdk", "..kmMdk", "..kmMdk", "..kmMdk"], 16, 28); c.blit(SHOE, 18, 40)
    c.blit(TORSO, 9, 13); c.blit(HEAD_SHOUT, 8, 3)
    steel_arm(c, [(11, 15), (17, 20)]); hand(c, 18, 20, 'm')
    c.blit(SLEEVE, 17, 13); arm(c, [(19, 16), (21, 20)]); hand(c, 21, 20)
    katana(c, 22, 21, 40, blade=17)
frame('kesa_hit', 'hit 100 ms (hold)', (12, 42), kesa_hit, size=(40, 43))

def kesa_follow(c):           # the sword through, low in front; body bent forward
    c.blit(HAIR_BACK, 1, 12); c.blit(SKIRT, 8, 21)
    c.blit(LEG_STOCK, 5, 28); c.blit(SHOE, 4, 40)
    c.blit(["kmMdk", "kmMdk", "kmMdk", "kkMdMk", ".kmMdk", ".kmMdk", ".kmMdk", "..kMdMk", "..kmMdk", "..kmMdk", "..kmMdk", "..kmMdk"], 16, 28); c.blit(SHOE, 18, 40)
    c.blit(TORSO, 10, 14); c.blit(HEAD, 10, 4)
    steel_arm(c, [(12, 16), (16, 24)]); hand(c, 17, 24, 'm')
    c.blit(SLEEVE, 18, 14); arm(c, [(20, 17), (20, 24)]); hand(c, 20, 24)
    katana(c, 21, 25, 70, blade=15)
frame('kesa_follow', 'follow through 50 ms', (12, 42), kesa_follow, size=(34, 43))

def kesa_recover(c):          # coming back up, the sword lowered at the side
    J = body_stance(c, 8, 12)
    steel_arm(c, [(J['shF'][0] - 4, J['shF'][1] + 2), (J['shF'][0] - 5, J['shF'][1] + 9)]); hand(c, 3, 22, 'm')
    c.blit(SLEEVE, 16, 12)
    arm(c, [(17, 16), (18, 20)]); hand(c, 18, 21)
    katana(c, 19, 22, 95, blade=14)
frame('kesa_recover', 'recover 50 ms', (12, 41), kesa_recover, size=(24, 42))

def kesa_over(c):             # overshoot: a hair back past the stance
    J = body_stance(c, 8, 12)
    steel_arm(c, [(J['shF'][0] - 4, J['shF'][1] + 2), (J['shF'][0] - 5, J['shF'][1] + 9)]); hand(c, 3, 22, 'm')
    c.blit(SLEEVE, 16, 12)
    arm(c, [(17, 16), (16, 19)]); hand(c, 16, 20)
    katana(c, 17, 21, 120, blade=20)
    c.blit(LEG_CHROME, 13, 27); c.blit(SHOE, 13, 39)
frame('kesa_over', 'overshoot 50 ms', (12, 41), kesa_over, size=(24, 42))

if __name__ == '__main__':
    os.makedirs('art', exist_ok=True)
    meta = {}
    for n, (name, note, (ax, ay), c) in enumerate(FRAMES):
        fig = c.image(); fx = c.image_fx()
        fig.save(os.path.join('art', 'H%d.png' % n))
        if fx: fx.save(os.path.join('art', 'H%de.png' % n))
        meta['H%d' % n] = {'name': name, 'note': note, 'ax': ax, 'ay': ay, 'w': c.w, 'h': c.h, 'fx': bool(fx)}
        print('H%d' % n, name, c.w, 'x', c.h, 'anchor', (ax, ay), 'fx' if fx else '')
    json.dump(meta, open(os.path.join('art', 'hand.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    S = 8
    W = sum(c.w * S + 24 for _, _, _, c in FRAMES) + 24; H = max(c.h for _, _, _, c in FRAMES) * S + 40
    sheet = Image.new('RGBA', (W, H), (124, 150, 163, 255)); d = ImageDraw.Draw(sheet); x = 24
    for n, (name, note, (ax, ay), c) in enumerate(FRAMES):
        full = c.image(chars=set(PAL) - {'.'})
        sheet.alpha_composite(full.resize((c.w * S, c.h * S), Image.NEAREST), (x, 24))
        gy = 24 + (ay + 1) * S; d.line([(x, gy), (x + c.w * S, gy)], fill=(255, 240, 80, 255))
        d.rectangle([x + ax * S, gy - 3, x + ax * S + S, gy + 3], fill=(255, 60, 60, 255))
        d.text((x, 6), 'H%d %s' % (n, name), fill=(255, 255, 0, 255)); x += c.w * S + 24
    sheet.save(os.path.join('art', 'hand_review.png')); print('review', sheet.size)
