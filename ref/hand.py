# hand.py — hand-drawn pixel frames at the small sprite scale (a standing figure is 42 px, shown ×2 in the game).
# The DESIGN follows the standing picture (ref/p_jk_full2.png, read at 41 px as ref/pic41.png): black hair with a
# blue sheen, long bangs over the forehead with the pale streak hanging in front of the temple, one red eye under a
# dark lash, a long lock over the near shoulder and the mass down the back to the waist, sailor collar (navy) with
# the red scarf and its tails, cropped white top with a midriff, blue pleated skirt with the red lining at the hem,
# far steel arm (segmented, rainbow sheen on the forearm) holding the katana low and back, near arm at the hip,
# thigh-high stocking with the garter band on the far leg, chrome prosthetic (knee + ankle joints) on the near leg,
# dark boots. The MOTION follows the Gemini action sheets (ref/jk_actions2-4.jpg) with Slynyrd's seven-beat sword
# attack as the timing model. Parts are ASCII bitmaps (one letter per pixel, palette below); a frame composes
# them at hand-chosen offsets, draws arms / blade / smear as pixel lines and wedges, then re-inks the silhouette.
# Output: ref/art/H<n>.png (+ H<n>e.png effect layer), ref/art/hand.json (anchors) → pixelize.py reads sheet 'H'.
#   python hand.py   → also ref/art/hand_review.png (×8) and hand_x2.png (the in-game ×2 look)
import os, json, math
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw

PAL = {
    'k': '0e0c18',                                              # ink
    'h': '1c1e30', 'H': '363a56', 'w': 'c8cce0', 'W': 'f4f6ff',  # hair, sheen, streak shade / core
    's': 'f2cbb0', 'S': 'd8a48c', 'e': 'c42c3e', 'o': '8e1d2a',   # skin, shade, eye, open mouth
    'u': 'f5f7fb', 'U': 'c6ccdc',                               # top white / shade
    'c': '2e3f78', 'C': '5871b2',                               # collar navy / stripe
    'r': 'd63242', 'R': '8e1d2a',                               # scarf / shade
    'b': '4c5c98', 'B': '303c6a', 'L': '7f90c8',                # skirt / pleat shadow / front light
    'm': 'e2e8f2', 'M': '9ea8c0', 'd': '5a6280',                # chrome light / mid / joint
    'g': '8ed8a8', 'q': 'd690d0',                               # steel-arm sheen (green / magenta)
    't': '2c2e40', 'T': '464a62', 'V': '8a92ac',                # stocking / light / garter band
    'n': '1c1e2c', 'N': '3a3c50',                               # boot / light
    'v': 'e6ecf4',                                              # blade
    'x': '7c2232', 'X': 'd0404a', 'y': 'c8a24c',                # hilt wrap dark / light, guard
    'a': 'dfe9ff', 'A': '9fc4e8', 'i': '6a9ad0',                # smear: core, mid, edge
    'f': 'ffe066', 'F': 'ff8a3c',                               # hit spark
    '.': None,
}
def rgb(hx): return tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

# ---------------------------------------------------------------- hand-drawn parts (facing right)
# Parts carry no outer outline: Canvas.ink() draws one around the composed silhouette, so touching parts (head +
# hair, hair + lock) merge without double lines. Internal edges that the picture inks (bang tips, the hair / face
# boundary, the eye) are written as 'k'.
HEAD = [                      # 14×10: hair cap with the sheen band, bangs to the eye line, streak hanging in front
    "...hhhhhhhh...",       # of the temple, eye = lash (kk) over the red iris, receding chin; neck under col 12
    ".hhhhhhhHHhhh.",
    ".hhhhhhHHhhhwW",
    "hhhhhhHhhhhksW",
    "hhhhhhHhhkskkW",
    "hhhhhhhHhkskes",
    "hhhhhhhHhhkssS",
    ".hhhhhhHhhksSS",
    ".hhhhhhhHhhkSS",
    "..hhhhhhhhhkS.",
]
HEAD_SHOUT = HEAD[:7] + [".hhhhhhHhhksoS"] + HEAD[8:]                    # mouth open
HEAD_HURT = HEAD[:4] + ["hhhhhhHhhksssW", "hhhhhhhHhkskks"] + HEAD[6:]   # eye shut
HAIR_BACK = [                 # 6×18: the mass down the back, sheen strands, pointed tips (waist length)
    "..hhhh",
    ".hhhhh",
    ".hhhhh",
    "hhhhhh",
    "hhhhhh",
    "hhhhHh",
    "hhhhHh",
    "hhhHhh",
    "hhhHh.",
    "hhhHh.",
    "hhhHh.",
    ".hhH..",
    ".hhH..",
    ".hhh..",
    ".hh...",
    "..hh..",
    "..h...",
    "..h...",
]
HAIR_FRONT = [                # 4×12: the lock from behind the jaw, hanging outside the near shoulder to the waist
    "hh..",
    "hhh.",
    "hhhH",
    "hhhH",
    ".hhH",
    ".hhh",
    ".hhh",
    ".hh.",
    ".hh.",
    "..h.",
    "..h.",
    "..h.",
]
TORSO = [                     # 11×8: neck, navy collar with the stripe, scarf knot + tails, white top, midriff
    ".....ccss..",
    ".kcccccCrck",
    "kucccccCrRk",
    "kuuucccrRuk",
    "kuUuuuurRuk",
    "kuUuuuuuRuk",
    "kUUUuuuuUUk",
    ".kssssssSk.",
]
SLEEVE = [".kuk", "kuuk", "kUuk", "kcCk"]     # 4×4 puff sleeve with the navy cuff
SKIRT = [                     # 14×8: waistband, pleats (b / B), light on the front edge, red lining at the hem
    "..kBbBBbBBbBk.",
    ".kbbBbbBbbBbLk",
    ".kbbBbbBbbBbLk",
    "kbbBbbBbbBbbLk",
    "kbbBbbBbbBbbLk",
    "kbBbbBbbBbbbLk",
    "kRrBbbBbbBbRrk",
    "kkkkkkkkkkkkkk",
]
LEG_STOCK = [                 # 5×13: garter band, thigh-high stocking with the front light, knee
    "kTVTk", "kttTk", "kttTk", "kttTk", "ktTTk", "kttTk", "kttTk", "kttTk", "kttTk", "kttTk", "kttTk", "kttTk", "kttTk",
]
LEG_CHROME = [                # 5×13: chrome prosthetic, knee joint, ankle joint
    "kmMdk", "kmMdk", "kmMdk", "kmMdk", "kdddk", "kMdMk", "kdMdk", "kmMdk", "kmMdk", "kmMdk", "kmMdk", "kdddk", "kMMdk",
]
SHOE = ["kNnnk..", "kNnnnk.", "kNnnnnk", "kkkkkkk"]   # 7×4 boot (toe to the right)

def slant(part, step, dirn=1):
    """a leg leaning: every `step` rows the part shifts one px (dirn +1 = toward the toe)"""
    out = []
    for j, r in enumerate(part):
        s = j // step
        out.append('.' * s + r if dirn > 0 else r + '.' * s)
    if dirn < 0:
        w = max(len(r) for r in out); out = ['.' * (w - len(r)) + r for r in out]
    return out

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
    def line(self, x0, y0, x1, y1, ch, thick=1, side=None, ch2=None, ch3=None):
        """Bresenham line; thick 2 adds ch2 beside it (along the minor axis unless `side` is given), thick 3 both sides"""
        if side is None:
            side = (0, 1) if abs(x1 - x0) >= abs(y1 - y0) else (1, 0)
        dx, dy = abs(x1 - x0), -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; err = dx + dy
        x, y = x0, y0
        while True:
            self.put(x, y, ch)
            if thick > 1: self.put(x + side[0], y + side[1], ch2 or ch)
            if thick > 2: self.put(x - side[0], y - side[1], ch3 or ch2 or ch)
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
                    if c not in ('.', 'k', 'a', 'A', 'i', 'f', 'F'): add.append((x, y)); break
        for (x, y) in add: self.g[y][x] = 'k'
    def rows(self): return [''.join(r) for r in self.g]
    FX = ('a', 'A', 'i', 'f', 'F')
    def image(self, chars=None):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0)); px = im.load()
        for y in range(self.h):
            for x in range(self.w):
                ch = self.g[y][x]
                if ch == '.' or (chars is not None and ch not in chars) or (chars is None and ch in self.FX): continue
                px[x, y] = rgb(PAL[ch])
        return im
    def image_fx(self):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0)); px = im.load(); any_ = False
        for y in range(self.h):
            for x in range(self.w):
                ch = self.g[y][x]
                if ch in self.FX: px[x, y] = rgb(PAL[ch]); any_ = True
        return im if any_ else None

def arm(c, pts, ch='s', ch2='S'):
    """a bare arm: a 2-px line through the joints (shoulder → elbow → wrist), shade on the minor-axis side"""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]): c.line(x0, y0, x1, y1, ch, thick=2, ch2=ch2)
def steel_arm(c, pts):
    """the prosthetic arm: chrome 2-px line, a joint pixel at every bend, the rainbow sheen on the last segment"""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]): c.line(x0, y0, x1, y1, 'm', thick=2, ch2='M')
    for (x, y) in pts[1:-1]: c.put(x, y, 'd')
    (x0, y0), (x1, y1) = pts[-2], pts[-1]
    c.put(round(x0 + (x1 - x0) * 0.45), round(y0 + (y1 - y0) * 0.45), 'g')
    c.put(round(x0 + (x1 - x0) * 0.75), round(y0 + (y1 - y0) * 0.75), 'q')
def hand(c, x, y, ch='s'): c.blit([ch + ch, ch + ('S' if ch == 's' else 'M')], x, y)
def sleeve(c, x, y): c.blit(SLEEVE, x, y)
def katana(c, hx, hy, ang, blade=16):
    """the katana held at (hx, hy): hilt 3 px behind the hand, guard, blade `blade` px along `ang` (deg, y down)"""
    a = math.radians(ang); ux, uy = math.cos(a), math.sin(a)
    for i in (1, 2, 3): c.put(round(hx - ux * i), round(hy - uy * i), 'X' if i % 2 else 'x')
    gx, gy = round(hx + ux * 1), round(hy + uy * 1)
    c.put(gx, gy, 'y'); c.put(gx - round(uy), gy + round(ux), 'y'); c.put(gx + round(uy), gy - round(ux), 'y')
    x0, y0 = round(hx + ux * 2), round(hy + uy * 2); x1, y1 = round(hx + ux * (2 + blade)), round(hy + uy * (2 + blade))
    side = (0, 1) if abs(ux) >= abs(uy) else (1 if ux < 0 else -1, 0)
    c.line(x0, y0, x1, y1, 'v', thick=2, side=side, ch2='M')

FRAMES = []
def frame(name, cell_note, anchor, build, size=(30, 46)):
    c = Canvas(*size); build(c); c.ink()
    FRAMES.append((name, cell_note, anchor, c))

# ---------------------------------------------------------------- the body (shared)
# ox, ty = the torso's top-left. Layout (ty = 11 in a 42-row stance): head rows ty-11..ty-1, torso ty..ty+7,
# skirt ty+8..ty+15, legs ty+16..ty+28, boots ty+27..ty+30. Joints returned: far/near shoulder, hip.
def upper(c, ox, ty, head=HEAD, lean=0, hair_front=True):
    """torso, head (lean = the head's x shift), the lock over the near shoulder (hair back is blitted first by the frame)"""
    c.blit(TORSO, ox, ty)
    c.blit(head, ox - 4 + lean, ty - 10)
    if hair_front: c.blit(HAIR_FRONT, ox + 10 + lean, ty - 3)
    return {'shF': (ox + 1, ty + 2), 'shN': (ox + 9, ty + 2), 'hip': (ox + 5, ty + 8)}
def lower(c, ox, ty, far=None, near=None, far_x=1, near_x=6, far_y=0, near_y=0):
    """skirt over the two legs (parts may be slanted); boots"""
    far = far or LEG_STOCK; near = near or LEG_CHROME
    c.blit(far, ox + far_x, ty + 16 + far_y); c.blit(SHOE, ox + far_x - 1 + (len(far[-1]) - 5), ty + 27 + far_y)
    c.blit(near, ox + near_x, ty + 16 + near_y); c.blit(SHOE, ox + near_x - 1 + (len(near[-1]) - 5), ty + 27 + near_y)
    c.blit(SKIRT, ox - 2, ty + 8)

def far_arm_rest(c, ox, ty, dx=0, kat_ang=105, kat_len=15):
    """the far steel arm hanging at the side, the katana gripped at the hip with the blade down-back"""
    sleeve(c, ox - 3, ty + 1)
    steel_arm(c, [(ox - 2 + dx, ty + 5), (ox - 2 + dx, ty + 9)])
    katana(c, ox - 2 + dx, ty + 12, kat_ang, blade=kat_len)
    hand(c, ox - 3 + dx, ty + 10, 'm')
def near_arm_rest(c, ox, ty, dx=0):
    """the near arm loose, the fist at the hip"""
    sleeve(c, ox + 8, ty + 1)
    arm(c, [(ox + 10, ty + 5), (ox + 11 + dx, ty + 8), (ox + 11 + dx, ty + 10)]); hand(c, ox + 10 + dx, ty + 11)

def stance(c):
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 6, ty - 7)
    lower(c, ox, ty)
    far_arm_rest(c, ox, ty)
    upper(c, ox, ty)
    near_arm_rest(c, ox, ty)
frame('stance', 'idle', (14, 41), stance, size=(26, 42))

def stance_breath(c):
    ox, ty = 9, 12
    c.blit(HAIR_BACK, ox - 6, ty - 7)
    lower(c, ox, ty - 1)
    far_arm_rest(c, ox, ty, kat_ang=107)
    upper(c, ox, ty)
    near_arm_rest(c, ox, ty)
frame('stance2', 'idle 2 (chest down 1)', (14, 41), stance_breath, size=(26, 42))

# ---------------------------------------------------------------- 袈裟斬: Slynyrd's seven beats
def kesa_antic(c):            # jodan: the sword raised above the head, both hands, blade up-back; weight back
    ox, ty = 10, 24
    c.blit(HAIR_BACK, ox - 7, ty - 7)
    lower(c, ox, ty, far_x=0, near_x=7)
    sleeve(c, ox - 3, ty + 1); steel_arm(c, [(ox - 2, ty + 5), (ox + 1, ty - 3), (ox + 8, ty - 12)])
    upper(c, ox, ty, lean=-1)
    hand(c, ox + 8, ty - 14, 'm')
    katana(c, ox + 10, ty - 14, -150, blade=15)
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 4), (ox + 14, ty - 3), (ox + 11, ty - 12)]); hand(c, ox + 10, ty - 13)
frame('kesa_antic', 'anticipation 100 ms', (15, 54), kesa_antic, size=(30, 55))

def kesa_smear(c):            # the cut in flight: arms forward-down, the blade replaced by the smear wedge
    ox, ty = 9, 12
    c.wedge(ox + 9, ty + 4, 9, 23, -78, 36)
    c.blit(HAIR_BACK, ox - 5, ty - 7)
    lower(c, ox, ty, far_x=0, near=slant(LEG_CHROME, 4), near_x=7)
    upper(c, ox, ty, head=HEAD_SHOUT, lean=1)
    sleeve(c, ox - 3, ty + 1); steel_arm(c, [(ox - 2, ty + 5), (ox + 8, ty + 6), (ox + 14, ty + 9)]); hand(c, ox + 15, ty + 9, 'm')
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 14, ty + 7), (ox + 16, ty + 10)]); hand(c, ox + 16, ty + 10)
frame('kesa_smear', 'smear 50 ms', (14, 42), kesa_smear, size=(40, 43))

def kesa_hit(c):              # the blade fully extended down-forward, lunge on the chrome leg, held
    ox, ty = 8, 12
    c.blit(HAIR_BACK, ox - 6, ty - 7)
    lower(c, ox, ty, far=slant(LEG_STOCK, 5, -1), far_x=-1, near=slant(LEG_CHROME, 3), near_x=8)
    upper(c, ox, ty, head=HEAD_SHOUT, lean=2)
    sleeve(c, ox - 3, ty + 1); steel_arm(c, [(ox - 2, ty + 5), (ox + 7, ty + 7), (ox + 13, ty + 10)]); hand(c, ox + 14, ty + 10, 'm')
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 14, ty + 8), (ox + 16, ty + 11)]); hand(c, ox + 16, ty + 11)
    katana(c, ox + 18, ty + 12, 38, blade=16)
    c.blit(["..f..", ".fFf.", "fF.Ff", ".fFf.", "..f.."], ox + 27, ty + 16)
frame('kesa_hit', 'hit 100 ms (hold)', (14, 42), kesa_hit, size=(42, 43))

def kesa_follow(c):           # the sword through, low in front; body bent forward
    ox, ty = 8, 13
    c.blit(HAIR_BACK, ox - 6, ty - 7)
    lower(c, ox, ty - 1, far=slant(LEG_STOCK, 5, -1), far_x=-1, near=slant(LEG_CHROME, 3), near_x=8)
    upper(c, ox, ty, lean=2)
    sleeve(c, ox - 3, ty + 1); steel_arm(c, [(ox - 2, ty + 5), (ox + 6, ty + 9), (ox + 11, ty + 13)]); hand(c, ox + 12, ty + 13, 'm')
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 13, ty + 9), (ox + 14, ty + 13)]); hand(c, ox + 14, ty + 14)
    katana(c, ox + 15, ty + 15, 66, blade=13)
frame('kesa_follow', 'follow through 50 ms', (14, 42), kesa_follow, size=(34, 43))

def kesa_recover(c):          # the sword swung down-back to the far hip (the stance grip), near arm returning
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 6, ty - 7)
    lower(c, ox, ty, far_x=0, near_x=7)
    sleeve(c, ox - 3, ty + 1); steel_arm(c, [(ox - 2, ty + 5), (ox, ty + 9)])
    katana(c, ox, ty + 12, 100, blade=15); hand(c, ox - 1, ty + 10, 'm')
    upper(c, ox, ty, lean=1)
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 13, ty + 8), (ox + 12, ty + 11)]); hand(c, ox + 11, ty + 12)
frame('kesa_recover', 'recover 50 ms', (14, 41), kesa_recover, size=(26, 42))

def kesa_over(c):             # overshoot: a hair back past the stance, the blade swung further back
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 7, ty - 7)
    lower(c, ox, ty)
    far_arm_rest(c, ox, ty, dx=-1, kat_ang=118)
    upper(c, ox, ty, lean=-1)
    near_arm_rest(c, ox, ty, dx=-1)
frame('kesa_over', 'overshoot 50 ms', (14, 41), kesa_over, size=(26, 42))

# ---------------------------------------------------------------- the light chain, from the action sheets
# A row 2 / row 4 and C row 2: 義手ジャブ → 義手ストレート → 義足ミドル（青い残影）→ 横薙ぎ（弧の残影）→ ハイキック（星）.
# Each attack keeps the Slynyrd beats (anticipation → smear / hit → follow through), 3–4 drawn frames per move,
# recover frames reuse the stance (H0) or the sword-back recover (H6).
HAIR_FLY = [                  # 11×9: the back hair streaming out behind a lunge
    "......hhhh.",
    "...hhhhhhhh",
    ".hhhhhhhHhh",
    "hhhhhhhHhhh",
    "hhhhhHhhhh.",
    ".hhhHhhhh..",
    "..hhhhh....",
    "...hh......",
    "....h......",
]
STAR = ["..f..", ".fFf.", "fF.Ff", ".fFf.", "..f.."]
def leg(c, pts, kind='chrome', foot='down'):
    """a bent leg: 3-px segments hip → knee → foot (light on the back / top, dark on the front / bottom, like the
    standing parts), a joint pixel at the knee, the boot at the end (down = hanging shin, fwd = side kick, up = high kick)"""
    ch, dark, light = ('M', 'd', 'm') if kind == 'chrome' else ('t', 't', 'T')
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]): c.line(x0, y0, x1, y1, ch, thick=3, ch2=dark, ch3=light)
    for (x, y) in pts[1:-1]: c.put(x, y, 'd' if kind == 'chrome' else 'T')
    fx, fy = pts[-1]
    if foot == 'down': c.blit(SHOE, fx - 3, fy - 1)
    elif foot == 'fwd': c.blit(["Nnn", "nnn", "nnN"], fx - 1, fy - 1)
    else: c.blit(["nNn", "nnn", "Nnn"], fx - 1, fy - 2)
def lower_far(c, ox, ty, far_x=3):
    """only the supporting (far, stocking) leg under the body and the skirt — the near leg is drawn bent by the frame"""
    c.blit(LEG_STOCK, ox + far_x, ty + 16); c.blit(SHOE, ox + far_x - 1, ty + 27)
    c.blit(SKIRT, ox - 2, ty + 8)
def near_sword_low(c, ox, ty, dx=0, ang=80, blade=13):
    """the near hand holding the katana low in front (the punches: the steel arm is busy)"""
    sleeve(c, ox + 8, ty + 1)
    arm(c, [(ox + 10, ty + 5), (ox + 12 + dx, ty + 9)])
    katana(c, ox + 13 + dx, ty + 12, ang, blade=blade); hand(c, ox + 12 + dx, ty + 10)
def near_sword_up_blade(c, ox, ty, dx=0): katana(c, ox + 11 + dx, ty + 2, -115, blade=13)   # before upper(): behind the head
def near_sword_up_arm(c, ox, ty, dx=0):                                                      # after upper()
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 13 + dx, ty + 5), (ox + 12 + dx, ty + 3)]); hand(c, ox + 11 + dx, ty + 2)

def jab_antic(c):             # the steel fist cocked at the chest, weight back
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 6, ty - 7); lower(c, ox, ty, far_x=0, near_x=7)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty)
    steel_arm(c, [(ox - 1, ty + 5), (ox - 1, ty + 8), (ox + 3, ty + 6)]); hand(c, ox + 3, ty + 5, 'm')
    near_sword_low(c, ox, ty)
frame('jab_antic', 'jab anticipation 40 ms', (14, 41), jab_antic, size=(30, 42))

def jab_hit(c):               # the steel arm straight out at shoulder height, spark at the fist
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 6, ty - 7); lower(c, ox, ty, far_x=0, near=slant(LEG_CHROME, 6), near_x=7)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=1)
    for x in range(ox + 8, ox + 13): c.put(x, ty + 1, 'A'); c.put(x, ty + 6, 'A')
    steel_arm(c, [(ox + 1, ty + 4), (ox + 9, ty + 3), (ox + 17, ty + 3)]); hand(c, ox + 17, ty + 2, 'm')
    c.blit(["f.f", ".F.", "f.f"], ox + 20, ty + 1)
    near_sword_low(c, ox, ty)
frame('jab_hit', 'jab hit 50 + hold 60 ms; fist (12..13, -28..-27)', (14, 41), jab_hit, size=(34, 42))

def jab_rec(c):               # the arm coming back
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 6, ty - 7); lower(c, ox, ty, far_x=0, near_x=7)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty)
    steel_arm(c, [(ox + 1, ty + 4), (ox + 7, ty + 4), (ox + 11, ty + 3)]); hand(c, ox + 11, ty + 2, 'm')
    near_sword_low(c, ox, ty)
frame('jab_rec', 'jab recover 70 ms', (14, 41), jab_rec, size=(30, 42))

def str_antic(c):             # the straight: fist chambered at the far hip, weight on the back leg
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 6, ty - 7); lower(c, ox, ty, far_x=-1, near_x=7)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=-1)
    steel_arm(c, [(ox - 1, ty + 5), (ox - 2, ty + 9), (ox + 1, ty + 9)]); hand(c, ox + 1, ty + 8, 'm')
    near_sword_low(c, ox, ty)
frame('str_antic', 'straight anticipation 60 ms', (14, 41), str_antic, size=(30, 42))

def str_smear(c):             # the punch in flight: a horizontal streak
    ox, ty = 9, 11
    c.line(ox + 3, ty + 3, ox + 12, ty + 3, 'a'); c.line(ox + 4, ty + 2, ox + 11, ty + 2, 'A'); c.line(ox + 4, ty + 4, ox + 11, ty + 4, 'A')
    c.line(ox + 6, ty + 1, ox + 10, ty + 1, 'i'); c.line(ox + 6, ty + 5, ox + 10, ty + 5, 'i')
    c.blit(HAIR_FLY, ox - 10, ty - 6); lower(c, ox, ty, far=slant(LEG_STOCK, 4, -1), far_x=-1, near=slant(LEG_CHROME, 4), near_x=7)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=1)
    steel_arm(c, [(ox + 1, ty + 4), (ox + 8, ty + 4), (ox + 13, ty + 3)]); hand(c, ox + 13, ty + 2, 'm')
    near_sword_low(c, ox, ty)
frame('str_smear', 'straight smear 40 ms', (14, 41), str_smear, size=(34, 42))

def str_hit(c):               # the lunge: arm fully extended, hair streaming, spark
    ox, ty = 9, 11
    c.blit(HAIR_FLY, ox - 11, ty - 6); lower(c, ox, ty, far=slant(LEG_STOCK, 3, -1), far_x=-2, near=slant(LEG_CHROME, 2), near_x=7)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=2)
    for x in range(ox + 6, ox + 14): c.put(x, ty + 1, 'A'); c.put(x, ty + 6, 'A')
    steel_arm(c, [(ox + 1, ty + 4), (ox + 10, ty + 3), (ox + 20, ty + 3)]); hand(c, ox + 20, ty + 2, 'm')
    c.blit(STAR, ox + 22, ty)
    near_sword_low(c, ox, ty, dx=1)
frame('str_hit', 'straight hit 60 + hold 90 ms; fist (15..16, -28..-27)', (14, 41), str_hit, size=(38, 42))

def str_rec(c):               # follow through: arm retracting, still leaning
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 7, ty - 7); lower(c, ox, ty, far=slant(LEG_STOCK, 4, -1), far_x=-1, near=slant(LEG_CHROME, 4), near_x=7)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=1)
    steel_arm(c, [(ox + 1, ty + 4), (ox + 8, ty + 4), (ox + 13, ty + 4)]); hand(c, ox + 13, ty + 3, 'm')
    near_sword_low(c, ox, ty)
frame('str_rec', 'straight follow through 70 ms', (14, 41), str_rec, size=(34, 42))

def kick_antic(c):            # 義足ミドル: knee raised, sword up-back in the near hand, steel arm out for balance
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 6, ty - 7); lower_far(c, ox, ty)
    near_sword_up_blade(c, ox, ty)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=-1)
    leg(c, [(ox + 7, ty + 16), (ox + 12, ty + 15), (ox + 12, ty + 22)], 'chrome', foot='down')
    steel_arm(c, [(ox + 1, ty + 4), (ox + 5, ty + 7), (ox + 9, ty + 8)]); hand(c, ox + 9, ty + 7, 'm')
    near_sword_up_arm(c, ox, ty)
frame('kick_antic', 'mid kick anticipation 60 ms', (14, 41), kick_antic, size=(34, 42))

def kick_hit(c):              # the chrome leg straight out at waist height, blue smear under it
    ox, ty = 9, 11
    c.wedge(ox + 7, ty + 16, 9, 16, 4, 58)
    c.blit(HAIR_BACK, ox - 7, ty - 7); lower_far(c, ox, ty)
    near_sword_up_blade(c, ox, ty, dx=-1)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, head=HEAD_SHOUT, lean=-1)
    leg(c, [(ox + 7, ty + 16), (ox + 14, ty + 15), (ox + 22, ty + 14)], 'chrome', foot='fwd')
    steel_arm(c, [(ox + 1, ty + 4), (ox + 4, ty + 8), (ox + 8, ty + 10)]); hand(c, ox + 8, ty + 9, 'm')
    near_sword_up_arm(c, ox, ty, dx=-1)
frame('kick_hit', 'mid kick hit 50 + hold 80 ms; foot (17..19, -17..-15)', (14, 41), kick_hit, size=(36, 42))

def kick_follow(c):           # the leg coming down
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 6, ty - 7); lower_far(c, ox, ty)
    near_sword_up_blade(c, ox, ty)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty)
    leg(c, [(ox + 7, ty + 16), (ox + 13, ty + 18), (ox + 17, ty + 24)], 'chrome', foot='down')
    steel_arm(c, [(ox + 1, ty + 4), (ox + 3, ty + 8), (ox + 6, ty + 10)]); hand(c, ox + 6, ty + 9, 'm')
    near_sword_up_arm(c, ox, ty)
frame('kick_follow', 'mid kick retract 70 ms', (14, 41), kick_follow, size=(34, 42))

def yoko_antic(c):            # 横薙ぎ: both hands pull the sword back to the far side, blade level behind
    ox, ty = 14, 11
    c.blit(HAIR_BACK, ox - 6, ty - 7); lower(c, ox, ty, far_x=0, near_x=7)
    katana(c, ox + 1, ty + 6, 184, blade=14)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=-1)
    steel_arm(c, [(ox + 1, ty + 4), (ox + 1, ty + 7)]); hand(c, ox, ty + 6, 'm')
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 5, ty + 6)]); hand(c, ox + 3, ty + 5)
frame('yoko_antic', 'yoko anticipation 80 ms', (19, 41), yoko_antic, size=(32, 42))

def yoko_smear(c):            # the level cut in flight: a fan in front of the chest
    ox, ty = 9, 11
    c.wedge(ox + 8, ty + 5, 8, 22, -36, 26)
    c.blit(HAIR_BACK, ox - 7, ty - 7); lower(c, ox, ty, far=slant(LEG_STOCK, 4, -1), far_x=-1, near=slant(LEG_CHROME, 4), near_x=7)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, head=HEAD_SHOUT, lean=1)
    steel_arm(c, [(ox + 1, ty + 4), (ox + 8, ty + 6), (ox + 13, ty + 6)]); hand(c, ox + 13, ty + 5, 'm')
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 14, ty + 5)]); hand(c, ox + 14, ty + 4)
frame('yoko_smear', 'yoko smear 50 ms', (14, 41), yoko_smear, size=(36, 42))

def yoko_hit(c):              # the blade straight out at chest height, lunge, spark at the tip
    ox, ty = 9, 11
    c.blit(HAIR_FLY, ox - 11, ty - 6); lower(c, ox, ty, far=slant(LEG_STOCK, 3, -1), far_x=-2, near=slant(LEG_CHROME, 2), near_x=7)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, head=HEAD_SHOUT, lean=2)
    steel_arm(c, [(ox + 1, ty + 4), (ox + 8, ty + 6), (ox + 14, ty + 6)]); hand(c, ox + 14, ty + 5, 'm')
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 16, ty + 5)]); hand(c, ox + 16, ty + 4)
    katana(c, ox + 18, ty + 5, 0, blade=16)
    c.blit(STAR, ox + 35, ty + 3)
frame('yoko_hit', 'yoko hit 80 ms; blade x 14..30 at y -28..-27', (14, 41), yoko_hit, size=(50, 42))

def yoko_follow(c):           # the blade past the front, dipping
    ox, ty = 9, 11
    c.blit(HAIR_FLY, ox - 10, ty - 6); lower(c, ox, ty, far=slant(LEG_STOCK, 4, -1), far_x=-1, near=slant(LEG_CHROME, 3), near_x=7)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=2)
    steel_arm(c, [(ox + 1, ty + 4), (ox + 8, ty + 7), (ox + 14, ty + 8)]); hand(c, ox + 14, ty + 7, 'm')
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 16, ty + 7)]); hand(c, ox + 16, ty + 6)
    katana(c, ox + 18, ty + 8, 22, blade=15)
frame('yoko_follow', 'yoko follow through 60 ms', (14, 41), yoko_follow, size=(46, 42))

def high_antic(c):            # ハイキック: knee up high, leaning back
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 6, ty - 7); lower_far(c, ox, ty)
    near_sword_up_blade(c, ox, ty, dx=-1)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=-1)
    leg(c, [(ox + 7, ty + 16), (ox + 13, ty + 11), (ox + 12, ty + 17)], 'chrome', foot='down')
    steel_arm(c, [(ox + 1, ty + 4), (ox + 5, ty + 7), (ox + 9, ty + 8)]); hand(c, ox + 9, ty + 7, 'm')
    near_sword_up_arm(c, ox, ty, dx=-1)
frame('high_antic', 'high kick anticipation 60 ms', (14, 41), high_antic, size=(34, 42))

def high_hit(c):              # the chrome leg up to head height, arc smear, star at the boot
    ox, ty = 9, 11
    c.wedge(ox + 7, ty + 16, 9, 17, -44, 12)
    c.blit(HAIR_BACK, ox - 8, ty - 7); lower_far(c, ox, ty)
    near_sword_up_blade(c, ox, ty, dx=-2)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, head=HEAD_SHOUT, lean=-2)
    leg(c, [(ox + 7, ty + 16), (ox + 13, ty + 9), (ox + 20, ty + 1)], 'chrome', foot='up')
    c.blit(STAR, ox + 20, ty - 4)
    steel_arm(c, [(ox + 1, ty + 4), (ox + 3, ty + 8), (ox + 7, ty + 10)]); hand(c, ox + 7, ty + 9, 'm')
    near_sword_up_arm(c, ox, ty, dx=-2)
frame('high_hit', 'high kick hit 45 + hold 90 ms; foot (15..16, -30..-28)', (14, 41), high_hit, size=(36, 42))

def high_follow(c):           # the leg dropping
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 7, ty - 7); lower_far(c, ox, ty)
    near_sword_up_blade(c, ox, ty, dx=-1)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=-1)
    leg(c, [(ox + 7, ty + 16), (ox + 14, ty + 14), (ox + 19, ty + 21)], 'chrome', foot='down')
    steel_arm(c, [(ox + 1, ty + 4), (ox + 3, ty + 8), (ox + 6, ty + 10)]); hand(c, ox + 6, ty + 9, 'm')
    near_sword_up_arm(c, ox, ty, dx=-1)
frame('high_follow', 'high kick retract 80 ms', (14, 41), high_follow, size=(36, 42))

# ---------------------------------------------------------------- walk, hit reactions, knockdown, block, crouch set
# B row 1 (walk), B/C row 5 (guard / hits / fly / lying), A row 3 (crouch attacks), C row 2 (fire sweep).
def mirror(part): return [r[::-1] for r in part]
def rot_ccw(rows):
    """rotate an ASCII bitmap 90° counter-clockwise (a standing figure → lying face-up, head to the left)"""
    W = len(rows[0]); H = len(rows)
    return [''.join(rows[y][W - 1 - x] for y in range(H)) for x in range(W)]
HAIR_UP = [r for r in reversed(HAIR_BACK)]     # the back hair streaming upward (used before the fly rotation)

def walk_frame(n):
    """6-frame cycle: contact (chrome forward) → recoil → pass → contact (stocking forward) → recoil → pass"""
    def build(c):
        ty = [11, 12, 10, 11, 12, 10][n]; ox = 9
        c.blit(HAIR_BACK, ox - 6 - (1 if n in (1, 4) else 0), ty - 7)
        if n == 0: lower(c, ox, ty, far=slant(LEG_STOCK, 5, -1), far_x=0, near=slant(LEG_CHROME, 4), near_x=6)
        elif n == 1: lower(c, ox, ty, far=slant(LEG_STOCK, 6, -1), far_x=1, near=slant(LEG_CHROME, 6), near_x=5)
        elif n == 2:
            c.blit(LEG_CHROME, ox + 4, ty + 16); c.blit(SHOE, ox + 3, ty + 27)
            leg(c, [(ox + 4, ty + 16), (ox + 7, ty + 21), (ox + 6, ty + 26)], 'stock', foot='down')
            c.blit(SKIRT, ox - 2, ty + 8)
        elif n == 3: lower(c, ox, ty, far=slant(LEG_STOCK, 4), far_x=6, near=slant(LEG_CHROME, 4, -1), near_x=-1)
        elif n == 4: lower(c, ox, ty, far=slant(LEG_STOCK, 6), far_x=5, near=slant(LEG_CHROME, 6, -1), near_x=1)
        else:
            c.blit(LEG_STOCK, ox + 4, ty + 16); c.blit(SHOE, ox + 3, ty + 27)
            c.blit(SKIRT, ox - 2, ty + 8)
            leg(c, [(ox + 5, ty + 16), (ox + 8, ty + 21), (ox + 7, ty + 26)], 'chrome', foot='down')
        far_arm_rest(c, ox, ty, dx=[0, 1, 0, -1, -1, 0][n], kat_ang=105 + [0, 4, 2, -3, -4, 0][n])
        upper(c, ox, ty)
        near_arm_rest(c, ox, ty, dx=[1, 1, 0, -1, -1, 0][n])
    return build
for n in range(6): frame('walk%d' % n, 'walk cycle %d/6' % (n + 1), (14, 41), walk_frame(n), size=(28, 42))

def hurt1(c):                 # body hit: torso back, head back, near arm flung forward
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 7, ty - 7); lower(c, ox, ty, far_x=0, near=slant(LEG_CHROME, 5), near_x=7)
    far_arm_rest(c, ox - 1, ty, dx=-1, kat_ang=118)
    upper(c, ox - 1, ty, head=HEAD_HURT, lean=-2)
    sleeve(c, ox + 7, ty + 1); arm(c, [(ox + 9, ty + 5), (ox + 13, ty + 3)]); hand(c, ox + 14, ty + 2)
frame('hurt1', 'body hit 1', (14, 41), hurt1, size=(28, 42))

def hurt2(c):                 # further back, slumped 1
    ox, ty = 9, 12
    c.blit(HAIR_BACK, ox - 8, ty - 7); lower(c, ox, ty - 1, far_x=-1, near=slant(LEG_CHROME, 5), near_x=7)
    far_arm_rest(c, ox - 2, ty, dx=-1, kat_ang=124)
    upper(c, ox - 2, ty, head=HEAD_HURT, lean=-3)
    sleeve(c, ox + 6, ty + 1); arm(c, [(ox + 8, ty + 5), (ox + 12, ty + 4)]); hand(c, ox + 13, ty + 3)
frame('hurt2', 'body hit 2 / stagger', (14, 41), hurt2, size=(28, 42))

def hurt_head1(c):            # head hit: head snapped back and up, hair whipped forward over the face
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 8, ty - 7); lower(c, ox, ty, far_x=0, near=slant(LEG_CHROME, 5), near_x=7)
    far_arm_rest(c, ox - 1, ty, dx=-1, kat_ang=118)
    c.blit(TORSO, ox - 1, ty); c.blit(HEAD_HURT, ox - 8, ty - 11)
    c.blit(mirror(HAIR_FLY)[3:], ox - 6, ty - 17)          # bangs whipped up and forward over the top of the head
    sleeve(c, ox + 7, ty + 1); arm(c, [(ox + 9, ty + 5), (ox + 12, ty + 8)]); hand(c, ox + 12, ty + 9)
frame('hurt_head1', 'head hit 1', (14, 41), hurt_head1, size=(30, 42))

def hurt_head2(c):            # head coming back, hair settling
    ox, ty = 9, 11
    c.blit(HAIR_BACK, ox - 8, ty - 7); lower(c, ox, ty, far_x=0, near=slant(LEG_CHROME, 5), near_x=7)
    far_arm_rest(c, ox - 1, ty, dx=-1, kat_ang=115)
    c.blit(TORSO, ox - 1, ty); c.blit(HEAD_HURT, ox - 7, ty - 10)
    c.blit(mirror(HAIR_FLY)[5:], ox - 5, ty - 14)
    sleeve(c, ox + 7, ty + 1); arm(c, [(ox + 9, ty + 5), (ox + 12, ty + 8)]); hand(c, ox + 12, ty + 9)
frame('hurt_head2', 'head hit 2', (14, 41), hurt_head2, size=(30, 42))

def crouch_legs(c, ox, ty, near_pts=None):
    """the squat: both knees bent, shins down; the skirt over the thighs (ty = 19 → head top at row 9)"""
    leg(c, [(ox + 3, ty + 14), (ox + 9, ty + 13), (ox + 9, ty + 21)], 'stock', foot='down')
    c.blit(SKIRT, ox - 2, ty + 8)
    leg(c, near_pts or [(ox + 6, ty + 14), (ox + 13, ty + 13), (ox + 13, ty + 21)], 'chrome', foot='down')
def crouch(c):
    ox, ty = 9, 19
    c.blit(HAIR_BACK, ox - 6, ty - 7)
    far_arm_rest(c, ox, ty, kat_ang=120, kat_len=11)
    crouch_legs(c, ox, ty)
    upper(c, ox, ty)
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 13, ty + 8)]); hand(c, ox + 13, ty + 9)
frame('crouch', 'crouch (loop)', (14, 41), crouch, size=(28, 42))

def hurt_low(c):              # hit while crouching: the body jolted back
    ox, ty = 9, 19
    c.blit(HAIR_BACK, ox - 8, ty - 7)
    far_arm_rest(c, ox - 1, ty, dx=-1, kat_ang=125, kat_len=11)
    crouch_legs(c, ox, ty)
    upper(c, ox - 1, ty, head=HEAD_HURT, lean=-3)
    sleeve(c, ox + 7, ty + 1); arm(c, [(ox + 9, ty + 5), (ox + 13, ty + 4)]); hand(c, ox + 14, ty + 3)
frame('hurt_low', 'crouch hit', (14, 41), hurt_low, size=(30, 42))

def fly_body(arms='out'):
    """the standing figure drawn for rotation: hair streaming up, legs straight together, arms up-out or along the body"""
    t = Canvas(30, 44); ox, ty = 10, 12
    t.blit(HAIR_UP, ox - 4, ty - 26)
    t.blit(LEG_STOCK, ox + 2, ty + 16); t.blit(SHOE, ox + 1, ty + 27)
    t.blit(LEG_CHROME, ox + 5, ty + 16); t.blit(SHOE, ox + 4, ty + 27)
    t.blit(SKIRT, ox - 2, ty + 8)
    if arms == 'out':
        sleeve(t, ox - 3, ty + 1); steel_arm(t, [(ox - 2, ty + 5), (ox - 5, ty + 1), (ox - 6, ty - 4)]); hand(t, ox - 7, ty - 6, 'm')
    else:
        sleeve(t, ox - 3, ty + 1); steel_arm(t, [(ox - 2, ty + 5), (ox - 3, ty + 12)]); hand(t, ox - 4, ty + 13, 'm')
    t.blit(TORSO, ox, ty); t.blit(HEAD_HURT, ox - 4, ty - 10)
    if arms == 'out':
        sleeve(t, ox + 8, ty + 1); arm(t, [(ox + 10, ty + 5), (ox + 14, ty + 2), (ox + 15, ty - 3)]); hand(t, ox + 15, ty - 5)
    else:
        sleeve(t, ox + 8, ty + 1); arm(t, [(ox + 10, ty + 5), (ox + 12, ty + 12)]); hand(t, ox + 12, ty + 13)
    return rot_ccw(t.rows())
def fly(c):                   # knocked flying: horizontal, face up, head leading (to the left), limbs and hair trailing
    c.blit(fly_body('out'), 0, 6)
frame('fly', 'knockdown fly (air)', (22, 36), fly, size=(44, 37))
def lying(c):                 # on the ground, arms along the body
    c.blit(fly_body('down'), 0, 6)
frame('lying', 'landed / lying', (22, 36), lying, size=(44, 37))

def kneel(c):                 # getting up: near knee on the ground, far foot planted, hand on the knee
    ox, ty = 9, 19
    c.blit(HAIR_BACK, ox - 6, ty - 7)
    far_arm_rest(c, ox, ty, kat_ang=110, kat_len=10)
    leg(c, [(ox + 3, ty + 14), (ox + 10, ty + 12), (ox + 10, ty + 21)], 'stock', foot='down')
    c.blit(SKIRT, ox - 2, ty + 8)
    leg(c, [(ox + 6, ty + 14), (ox + 6, ty + 21), (ox + 1, ty + 22)], 'chrome', foot='fwd')
    upper(c, ox, ty, head=HEAD_HURT)
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 12, ty + 9)]); hand(c, ox + 11, ty + 10)
frame('kneel', 'getup 1 (kneel)', (14, 41), kneel, size=(28, 42))

def block(c):                 # guard: the katana held upright in front of the face, steel arm across
    ox, ty = 9, 15
    c.blit(HAIR_BACK, ox - 6, ty - 7); lower(c, ox, ty, far_x=0, near=slant(LEG_CHROME, 6), near_x=7)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=-1)
    steel_arm(c, [(ox + 1, ty + 4), (ox + 6, ty + 7), (ox + 11, ty + 6)]); hand(c, ox + 11, ty + 5, 'm')
    katana(c, ox + 13, ty + 2, -90, blade=14)
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 13, ty + 6)]); hand(c, ox + 12, ty + 3)
frame('block', 'block (loop)', (14, 45), block, size=(28, 46))

def block_low(c):             # crouch guard: the katana slanted in front
    ox, ty = 9, 19
    c.blit(HAIR_BACK, ox - 6, ty - 7)
    crouch_legs(c, ox, ty)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=-1)
    steel_arm(c, [(ox + 1, ty + 4), (ox + 6, ty + 8), (ox + 10, ty + 8)]); hand(c, ox + 10, ty + 7, 'm')
    katana(c, ox + 13, ty + 5, -60, blade=12)
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 13, ty + 7)]); hand(c, ox + 12, ty + 5)
frame('block_low', 'crouch block (loop)', (14, 41), block_low, size=(30, 42))

def cl_antic(c):              # 屈み義手: the steel fist cocked in the crouch
    ox, ty = 9, 19
    c.blit(HAIR_BACK, ox - 6, ty - 7)
    crouch_legs(c, ox, ty)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty)
    steel_arm(c, [(ox - 1, ty + 5), (ox - 1, ty + 8), (ox + 3, ty + 6)]); hand(c, ox + 3, ty + 5, 'm')
    near_sword_low(c, ox, ty, ang=100, blade=9)
frame('cl_antic', 'crouch jab anticipation', (14, 41), cl_antic, size=(30, 42))
def cl_hit(c):                # the steel arm straight out at chest height from the crouch
    ox, ty = 19 - 10, 19
    c.blit(HAIR_BACK, ox - 6, ty - 7)
    crouch_legs(c, ox, ty)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, lean=1)
    for x in range(ox + 8, ox + 12): c.put(x, ty + 1, 'A'); c.put(x, ty + 6, 'A')
    steel_arm(c, [(ox + 1, ty + 4), (ox + 9, ty + 3), (ox + 16, ty + 3)]); hand(c, ox + 16, ty + 2, 'm')
    c.blit(["f.f", ".F.", "f.f"], ox + 19, ty + 1)
    near_sword_low(c, ox, ty, ang=100, blade=9)
frame('cl_hit', 'crouch jab hit; fist (11..12, -20..-19)', (14, 41), cl_hit, size=(34, 42))

def sweep_hit(c, fire=False):  # 足払い: the chrome leg flat along the ground, hand planted, low smear (fire variant)
    ox, ty = 9, 19
    c.wedge(ox + 6, ty + 14, 8, 15, 20, 75)
    c.blit(HAIR_BACK, ox - 6, ty - 7)
    leg(c, [(ox + 3, ty + 14), (ox + 8, ty + 13), (ox + 8, ty + 21)], 'stock', foot='down')
    c.blit(SKIRT, ox - 2, ty + 8)
    sleeve(c, ox - 3, ty + 1)
    upper(c, ox, ty, head=HEAD_SHOUT, lean=2)
    leg(c, [(ox + 6, ty + 15), (ox + 14, ty + 18), (ox + 22, ty + 20)], 'chrome', foot='fwd')
    if fire:
        for i, x in enumerate(range(ox + 9, ox + 24)): c.put(x, ty + 15 + (i // 4) - (1 if i % 3 == 0 else 0), 'F' if i % 2 else 'f')
        c.blit(["f", "F"], ox + 12, ty + 14); c.blit(["f", "F"], ox + 18, ty + 15)
    steel_arm(c, [(ox + 1, ty + 4), (ox - 1, ty + 10), (ox, ty + 19)]); hand(c, ox - 1, ty + 20, 'm')
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 13, ty + 8)]); hand(c, ox + 13, ty + 9)
frame('sweep_hit', 'sweep hit; foot 17..19 at -2..0', (14, 41), lambda c: sweep_hit(c), size=(36, 42))
frame('sweep_fire', 'fire sweep hit', (14, 41), lambda c: sweep_hit(c, True), size=(36, 42))
def sweep_antic(c):           # weight back on the far leg, the chrome leg drawn back
    ox, ty = 9, 19
    c.blit(HAIR_BACK, ox - 5, ty - 7)
    leg(c, [(ox + 3, ty + 14), (ox + 9, ty + 13), (ox + 9, ty + 21)], 'stock', foot='down')
    c.blit(SKIRT, ox - 2, ty + 8)
    leg(c, [(ox + 6, ty + 14), (ox + 4, ty + 18), (ox + 3, ty + 22)], 'chrome', foot='fwd')
    far_arm_rest(c, ox, ty, kat_ang=125, kat_len=10)
    upper(c, ox, ty, lean=-1)
    sleeve(c, ox + 8, ty + 1); arm(c, [(ox + 10, ty + 5), (ox + 12, ty + 9)]); hand(c, ox + 12, ty + 10)
frame('sweep_antic', 'sweep anticipation', (14, 41), sweep_antic, size=(30, 42))

if __name__ == '__main__':
    os.makedirs('art', exist_ok=True)
    meta = {}
    for n, (name, note, (ax, ay), c) in enumerate(FRAMES):
        fig = c.image(); fx = c.image_fx()
        fig.save(os.path.join('art', 'H%d.png' % n))
        p = os.path.join('art', 'H%de.png' % n)
        if fx: fx.save(p)
        elif os.path.exists(p): os.remove(p)
        meta['H%d' % n] = {'name': name, 'note': note, 'ax': ax, 'ay': ay, 'w': c.w, 'h': c.h, 'fx': bool(fx)}
        print('H%d' % n, name, c.w, 'x', c.h, 'anchor', (ax, ay), 'fx' if fx else '')
    json.dump(meta, open(os.path.join('art', 'hand.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for S, fn in ((8, 'hand_review.png'), (2, 'hand_x2.png')):
        W = sum(c.w * S + 3 * S for _, _, _, c in FRAMES) + 3 * S; H = max(c.h for _, _, _, c in FRAMES) * S + 5 * S
        sheet = Image.new('RGBA', (W, H), (124, 150, 163, 255)); d = ImageDraw.Draw(sheet); x = 3 * S
        for n, (name, note, (ax, ay), c) in enumerate(FRAMES):
            full = c.image(chars=set(PAL) - {'.'})
            sheet.alpha_composite(full.resize((c.w * S, c.h * S), Image.NEAREST), (x, 3 * S))
            gy = 3 * S + (ay + 1) * S; d.line([(x, gy), (x + c.w * S, gy)], fill=(255, 240, 80, 255))
            d.rectangle([x + ax * S, gy - 2, x + ax * S + S, gy + 2], fill=(255, 60, 60, 255))
            if S >= 4: d.text((x, 6), 'H%d %s' % (n, name), fill=(255, 255, 0, 255))
            x += c.w * S + 3 * S
        sheet.save(os.path.join('art', fn)); print(fn, sheet.size)
