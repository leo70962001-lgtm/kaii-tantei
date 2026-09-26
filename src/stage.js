// stage.js — 東京鬼高校・夜の校門前: a 720 px wide night street in front of the school gate, seen through
// a 480×270 camera window. Painted pixel by pixel once; the far skyline scrolls slower than the street.
//
// Scale (「背景的物體根據角色的比例去做對照」): the fighter is 82 world px = 158 cm → 52 px per metre on the fight
// plane (the sidewalk, y = GROUND). Things behind the 1-m wall are drawn smaller by their distance: the sakura
// trees at ×0.6 (a 6-m tree ≈ 190 px), the apartment block at ×0.4 (3-m floors = 62 px, 1×1.2-m windows = 21×25),
// the school building seen through the gate at ×0.3, the far skyline in haze.
// Style (the user's Pinterest references — Pokidmi's "SPb pixel art" dusk street and the sakura Tokyo street):
// big volumetric cloud banks with a lit rim, atmospheric perspective, lamps with wide soft halos and light cones,
// a wet street reflecting every light as a vertical streak, cherry trees as clumps of pink shaded from one side
// with dark branches between them, warm lights against cool blues.
(function (root) {
  'use strict';
  const PX = root.PX;
  const W = 720, H = 270, VW = 480, GROUND = 240, FAR_W = 600, PXM = 52;   // world px per metre on the fight plane
  const hx = PX.hex;
  const rgba = (hex, a) => ((hx(hex) & 0x00ffffff) | ((a & 255) << 24)) >>> 0;   // a translucent pixel (both renderers blend it)
  const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const dith = (x, y, t) => t * 16 > bayer[y & 3][x & 3] + 0.5;
  const HS = PX.hash;

  function layer(w, h) {
    const c = new Uint32Array(w * h);
    return { w, h, c, set(x, y, col) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) c[y * w + x] = col; }, get(x, y) { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < w && y < h ? c[y * w + x] : 0; } };
  }
  // small painters shared by the layers and the props
  const rect = (L, x, y, w, h, col) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) L.set(x + i, y + j, col); };
  function line(L, x0, y0, x1, y1, col) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) { L.set(x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function ring(L, cx, cy, r0, r1, col) { for (let y = Math.floor(cy - r1); y <= cy + r1; y++) for (let x = Math.floor(cx - r1); x <= cx + r1; x++) { const d = Math.hypot(x - cx, y - cy); if (d >= r0 && d < r1) L.set(x, y, col); } }
  function ellipse(L, cx, cy, rx, ry, col, inner) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d <= 1 && (inner === undefined || d > inner)) L.set(x, y, col); } }
  function blit(L, S, ox, oy) { for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const c = S.c[y * S.w + x]; if (c) L.set(ox + x, oy + y, c); } }
  function rot90cw(S) {   // the top goes to the right: a thing that fell over to the right
    const R = layer(S.h, S.w);
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) R.set(S.h - 1 - y, x, S.c[y * S.w + x]);
    return R;
  }
  // a soft radial glow of translucent pixels (dithered so it stays pixel art), strongest at the centre
  function glow(L, cx, cy, rx, ry, hex, aMax, pow) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry); if (d >= 1) continue;
      const a = aMax * Math.pow(1 - d, pow || 1.6);
      if (a < 6) { if (dith(x, y, a / 6)) L.set(x, y, rgba(hex, 6)); continue; }
      L.set(x, y, rgba(hex, Math.round(a)));
    }
  }
  // the reflection of a light on the wet ground: a vertical streak that breaks up with distance (the reference's rain-wet road)
  function streak(L, x0, x1, yTop, yBot, hex, aMax) {
    for (let y = yTop; y < yBot; y++) for (let x = x0; x < x1; x++) {
      const t = (y - yTop) / Math.max(1, yBot - yTop), edge = Math.min(x - x0, x1 - 1 - x) / Math.max(1, (x1 - x0) / 2);
      const a = aMax * (1 - t * 0.7) * Math.min(1, edge * 1.6) * (HS(x, y >> 1, 43) < 0.75 ? 1 : 0.35);
      if (a >= 5) L.set(x, y, rgba(hex, Math.round(a)));
    }
  }
  const OUT = hx('#0a0f2a');

  // ---------------------------------------------------------------- far layer: sky, stars, moon, cloud banks, hazy skyline
  function paintFar() {
    const L = layer(FAR_W, H);
    const sky = ['#07091c', '#0a0d26', '#10132f', '#161a3c', '#1d2048', '#262856', '#312f62', '#3d366c', '#4a3f74'].map(hx);
    for (let y = 0; y < H; y++) {
      const t = Math.pow(y / 226, 1.25) * (sky.length - 1);
      const i = Math.min(sky.length - 2, Math.floor(t)), f = t - i;
      for (let x = 0; x < FAR_W; x++) L.set(x, y, dith(x, y, Math.min(1, f)) ? sky[i + 1] : sky[i]);
    }
    for (let k = 0; k < 260; k++) {
      const x = Math.floor(HS(k, 1, 11) * FAR_W), y = Math.floor(Math.pow(HS(k, 2, 11), 1.5) * 150);
      const b = HS(k, 3, 11);
      L.set(x, y, b > 0.86 ? hx('#ffffff') : b > 0.5 ? hx('#b3bcf0') : hx('#6f78bc'));
      if (b > 0.95) { L.set(x + 1, y, hx('#6f78bc')); L.set(x - 1, y, hx('#6f78bc')); L.set(x, y + 1, hx('#6f78bc')); L.set(x, y - 1, hx('#6f78bc')); }
    }
    // a big low moon with a wide soft halo
    const mx = 450, my = 70, mr = 30;
    for (let y = my - 70; y <= my + 70; y++) for (let x = mx - 70; x <= mx + 70; x++) {
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      if (d <= mr) {
        const lx = (x - mx) / mr, ly = (y - my) / mr;
        L.set(x, y, lx + ly > 1.0 ? hx('#d9b28e') : lx + ly > 0.5 ? hx('#efd1ac') : hx('#fbe8cc'));
      } else if (d <= mr + 10 && dith(x, y, (mr + 10 - d) / 18)) L.set(x, y, hx('#4a3f78'));
      else if (d <= mr + 24 && dith(x, y, (mr + 24 - d) / 60)) L.set(x, y, hx('#3a3468'));
      else if (d <= mr + 40 && dith(x, y, (mr + 40 - d) / 120)) L.set(x, y, hx('#332e60'));
    }
    for (const [dx, dy, r] of [[-10, -6, 5], [9, 6, 4], [-3, 13, 3], [12, -12, 3], [-13, 9, 3]]) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      L.set(mx + dx + x, my + dy + y, (x + y < 0) ? hx('#dcbb98') : hx('#e9cfae'));
    }
    // volumetric cloud banks (the reference's sky): unions of ellipses, the rim toward the moon lit, the underside
    // in shadow, a grainy dithered edge; the lowest bank catches the warm city glow from below
    const cloudBank = (blobs, cols, ldx, ldy) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [cx, cy, rx, ry] of blobs) { x0 = Math.min(x0, cx - rx - 2); x1 = Math.max(x1, cx + rx + 2); y0 = Math.min(y0, cy - ry - 2); y1 = Math.max(y1, cy + ry + 2); }
      const F = (x, y) => { let f = 0; for (const [cx, cy, rx, ry] of blobs) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d < 1) f += (1 - d) * (1 - d); } return f; };
      const T = 0.16;
      for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
        const f = F(x, y); if (f < T) continue;
        if (f < T + HS(x, y, 41) * 0.09) continue;                         // grainy edge
        const fl = F(x + ldx, y + ldy), fs = F(x - ldx, y - ldy);
        let c = cols.body;
        if (fl < T) c = cols.rim;
        else if (fl < T * 2.4) c = dith(x, y, 0.65) ? cols.lit : cols.body;
        else if (fl < T * 4 && dith(x, y, 0.3)) c = cols.lit;
        if (c === cols.body && fs < T * 1.8) c = dith(x, y, 0.7) ? cols.shade : cols.body;
        if (c === cols.body && f < T * 1.6 && dith(x, y, 0.5)) c = cols.shade;
        if (cols.warm && c === cols.shade && y > y1 - (y1 - y0) * 0.35 && dith(x, y, 0.5)) c = cols.warm;
        L.set(x, y, c);
      }
    };
    const C1 = { body: hx('#3a3872'), shade: hx('#262458'), lit: hx('#7a74b8'), rim: hx('#c8c2f0') };
    const C2 = { body: hx('#2e2c64'), shade: hx('#1e1e4c'), lit: hx('#5a56a0'), rim: hx('#9a94d8'), warm: hx('#5a3a5c') };
    cloudBank([[60, 28, 60, 14], [120, 38, 70, 18], [190, 52, 60, 16], [250, 66, 55, 14], [300, 80, 48, 12], [340, 92, 40, 10], [150, 60, 40, 10], [220, 74, 30, 8]], C1, 5, -4);
    cloudBank([[400, 96, 46, 10], [440, 102, 52, 12], [490, 98, 40, 9], [530, 106, 44, 10], [470, 110, 30, 6]], C1, 4, -4);
    cloudBank([[20, 150, 70, 14], [90, 158, 90, 18], [180, 164, 70, 14], [250, 170, 50, 10], [560, 150, 60, 12], [600, 158, 40, 10]], C2, 4, -3);
    cloudBank([[330, 40, 40, 6], [370, 46, 34, 5]], C1, 5, -4);
    // city haze: the light pollution over the skyline (a warm band low down), then the far towers, then a nearer row
    for (let y = 120; y < 200; y++) for (let x = 0; x < FAR_W; x++) if (dith(x, y, ((y - 120) / 80) * 0.55)) L.set(x, y, hx('#4c4180'));
    for (let y = 168; y < 198; y++) for (let x = 0; x < FAR_W; x++) if (dith(x, y, ((y - 168) / 30) * 0.35)) L.set(x, y, hx('#6a4a78'));
    const tower = (x0, w, top, col, win, lit, wcol) => {
      for (let y = top; y < GROUND; y++) for (let x = x0; x < x0 + w; x++) L.set(x, y, col);
      if (win) for (let y = top + 4; y < GROUND - 6; y += 6) for (let x = x0 + 3; x < x0 + w - 3; x += 5) if (HS(x, y, 5) < lit) { const c = HS(x, y, 6) > 0.7 ? hx('#ffd98a') : wcol; L.set(x, y, c); L.set(x + 1, y, c); }
    };
    for (let k = 0; k < 26; k++) {
      const x0 = Math.floor(HS(k, 7, 3) * FAR_W), w = 15 + Math.floor(HS(k, 8, 3) * 40), top = 130 + Math.floor(HS(k, 9, 3) * 45);
      tower(x0, w, top, hx('#3b3670'), true, 0.12, hx('#8a86c0'));
    }
    // 東京タワー beside the moon (its top shows above the school building seen through the gate): a tapered lattice
    // with the red / white bands and warning lights
    const tx = 380, tt = 52, tb = 190;
    for (let y = tt; y < tb; y++) {
      const t = (y - tt) / (tb - tt), hw = 1 + t * t * 14, c = ((y - tt) % 18) < 9 ? hx('#7a2a3a') : hx('#c8c4d8');
      for (let x = Math.round(tx - hw); x <= Math.round(tx + hw); x++) if (Math.abs(x - tx) > hw - 2 || (y % 6 === 0) || dith(x, y, 0.25)) L.set(x, y, c);
    }
    rect(L, tx - 6, 118, 12, 5, hx('#c8c4d8')); rect(L, tx - 10, 150, 20, 6, hx('#c8c4d8'));
    L.set(tx, tt - 1, hx('#ff4040')); L.set(tx, tt - 2, hx('#ff4040')); L.set(tx - 6, 117, hx('#ff4040')); L.set(tx + 6, 117, hx('#ff4040'));
    for (let k = 0; k < 18; k++) {
      const x0 = Math.floor(HS(k, 17, 4) * FAR_W), w = 18 + Math.floor(HS(k, 18, 4) * 33), top = 160 + Math.floor(HS(k, 19, 4) * 39);
      tower(x0, w, top, hx('#232650'), true, 0.3, hx('#b8c4ff'));
      if (HS(k, 20, 4) > 0.6) { L.set(x0 + (w >> 1), top - 1, hx('#ff5a5a')); L.set(x0 + (w >> 1), top - 2, hx('#ff5a5a')); L.set(x0 + (w >> 1), top - 3, hx('#ff5a5a')); }
      if (HS(k, 21, 4) > 0.5) { const sx = x0 + 3 + Math.floor(HS(k, 22, 4) * (w - 10)), sc = HS(k, 23, 4) > 0.5 ? hx('#ff5ad0') : hx('#5ad0ff'); rect(L, sx, top + 8, 6, 2, sc); }   // a neon sign
    }
    return L;
  }

  // ---------------------------------------------------------------- near layer: the street at 52 px / m
  function paintNear() {
    const L = layer(W, H);
    // ---- behind the wall (a dithered ground fog rises from the wall top into the yards)
    for (let y = 150; y < 200; y++) for (let x = 0; x < W; x++) if (dith(x, y, (y - 150) / 70)) L.set(x, y, hx('#222452'));
    // the school building seen through the gate (×0.3): three floors of long windows, a parapet, the entrance
    rect(L, 282, 96, 208, 92, hx('#151a3a')); rect(L, 282, 96, 208, 3, hx('#20264a')); rect(L, 282, 99, 208, 1, hx('#0f1330'));
    for (let row = 0; row < 3; row++) for (let x = 292; x < 484; x += 12) {
      const y = 106 + row * 26, lit = HS(x, row, 23) < 0.14;
      rect(L, x, y, 7, 9, lit ? hx('#ffd98a') : hx('#0f1330')); if (lit) rect(L, x, y + 5, 7, 4, hx('#e0b850')); else L.set(x + 1, y + 1, hx('#2a3060'));
    }
    rect(L, 374, 160, 24, 28, hx('#0f1330')); rect(L, 370, 156, 32, 4, hx('#2a3060')); rect(L, 384, 168, 4, 20, hx('#3a4a8a'));   // entrance + canopy + glass door
    for (let y = 60; y < 188; y++) L.set(302, y, hx('#5a5f8a')); rect(L, 303, 62, 7, 4, hx('#e8e8f0')); L.set(306, 64, hx('#e84a5f'));   // flagpole
    // the apartment block on the left (×0.4): two visible floors of 21×25 windows with frames, balconies, a roof
    const AX0 = 0, AX1 = 246;
    rect(L, AX0, 64, AX1 - AX0, 124, hx('#1a1d44')); rect(L, AX0, 64, AX1 - AX0, 3, hx('#2a2e5c')); rect(L, AX0, 67, AX1 - AX0, 1, hx('#0f1130'));
    for (let y = 68; y < 188; y++) for (let x = AX0; x < AX1; x++) if (HS(x, y, 45) < 0.06) L.set(x, y, hx('#1e2250'));   // wall texture
    const win = (x, y, lit, curtain) => {
      rect(L, x - 1, y - 1, 23, 27, hx('#2c3060'));                                     // frame
      rect(L, x, y, 21, 25, lit ? hx('#ffd98a') : hx('#0f1130'));
      if (lit) { rect(L, x, y + 13, 21, 12, hx('#e0b850')); if (curtain) { rect(L, x, y, 6, 25, hx('#f0c890')); rect(L, x + 15, y, 6, 25, hx('#f0c890')); } }
      else { L.set(x + 2, y + 2, hx('#2a3060')); L.set(x + 3, y + 2, hx('#2a3060')); }
      rect(L, x + 10, y, 1, 25, hx('#2c3060')); rect(L, x, y + 12, 21, 1, hx('#2c3060'));   // sash
    };
    for (let k = 0; k < 4; k++) {
      const x = 24 + k * 56;
      win(x, 80, HS(k, 1, 41) < 0.5, HS(k, 2, 41) < 0.5);
      rect(L, x - 6, 108, 33, 2, hx('#3a3e70')); for (let i = 0; i < 33; i += 3) L.set(x - 6 + i, 104, hx('#3a3e70')); rect(L, x - 6, 104, 1, 6, hx('#3a3e70')); rect(L, x + 26, 104, 1, 6, hx('#3a3e70'));   // balcony rail
      win(x, 142, HS(k, 3, 41) < 0.4, HS(k, 4, 41) < 0.5);
    }
    rect(L, 186, 44, 22, 20, hx('#2a2e5c')); rect(L, 188, 42, 18, 2, hx('#3a3e70')); rect(L, 196, 32, 2, 12, hx('#5a5f8a')); rect(L, 190, 34, 14, 1, hx('#5a5f8a'));   // water tank + antenna
    for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) if (x * x + y * y <= 85) L.set(214 + x, 122 + y, x * x + y * y <= 55 ? hx('#f4ecd0') : hx('#5a4a30'));
    for (const [dx, dy] of [[0, -1], [0, -2], [0, -3], [0, -4], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]) L.set(214 + dx, 122 + dy, hx('#302010'));   // the shop clock
    // sakura trees behind the wall (×0.6), in the reference's way: clumps of blossom shaded from the upper right,
    // a darker rim on each clump, dark branches showing in the gaps, the odd brighter petal
    const sakura = (cx, cy, rx, ry, seed) => {
      for (let y = cy + ry * 0.5; y < 190; y++) for (let i = -3; i <= 3; i++) L.set(cx + i, y, i < -1 ? hx('#3a2a38') : i > 1 ? hx('#1a1020') : hx('#2a1c30'));
      const GAP = hx('#2a1c30');
      ellipse(L, cx, cy, rx * 0.86, ry * 0.86, hx('#3a2240'));
      for (const [bx, by] of [[-rx * 0.6, -ry * 0.3], [rx * 0.55, -ry * 0.45], [-rx * 0.25, -ry * 0.8], [rx * 0.2, -ry * 0.9], [rx * 0.75, ry * 0.05], [-rx * 0.8, ry * 0.1]]) { line(L, cx, cy + ry * 0.4, cx + bx, cy + by, GAP); line(L, cx + 1, cy + ry * 0.4, cx + bx + 1, cy + by, hx('#1a1020')); }
      const SH = hx('#6a3454'), MID = hx('#a85a7c'), LIT = hx('#d88aa4'), HI = hx('#f4bcd0'), RIM = hx('#4a2440');
      const n = Math.round(rx * ry / 48), clumps = [];
      for (let k = 0; k < n; k++) {
        const a = HS(k, 1, seed) * Math.PI * 2, r = Math.sqrt(HS(k, 2, seed)) * 0.9;
        clumps.push([Math.round(cx + Math.cos(a) * r * rx), Math.round(cy + Math.sin(a) * r * ry), 5 + Math.round(HS(k, 3, seed) * 7)]);
      }
      clumps.sort((p, q) => p[1] - q[1]);   // top first: the lower clumps overlap the ones behind them
      for (const [px, py, pr] of clumps) {
        for (let y = py - pr - 1; y <= py + pr + 1; y++) for (let x = px - pr - 1; x <= px + pr + 1; x++) {
          const d = Math.hypot(x - px, y - py) / pr + HS(x, y, seed + 5) * 0.14;
          if (d > 1.04) continue;
          const lx = (x - px) / pr, ly = (y - py) / pr, l = lx * 0.6 - ly * 0.8;   // light from the upper right (moon / lamps)
          if (d > 0.9) { L.set(x, y, l < 0.2 || dith(x, y, 0.5) ? RIM : SH); continue; }
          const c = l > 0.5 ? HI : l > 0.05 ? LIT : l > -0.45 ? MID : SH;
          L.set(x, y, HS(x, y, seed + 6) < 0.04 ? hx('#fff0f4') : c);
        }
      }
    };
    sakura(118, 96, 70, 52, 13); sakura(586, 90, 78, 58, 17); sakura(704, 112, 54, 42, 19);
    // ---- the wall (1.0 m): a block wall with a coping, mortar joints, grime, a poster; open between the gate pillars
    const wall = (x0, x1) => {
      for (let y = 188; y < GROUND; y++) for (let x = x0; x < x1; x++) {
        const t = (y - 188) / (GROUND - 188), joint = ((y - 192) % 12 === 0 && y > 191) || ((x + (Math.floor((y - 192) / 12) & 1) * 12) % 24 === 0 && y > 191);
        L.set(x, y, y === 188 ? hx('#7a7fae') : y === 189 ? hx('#6a6f9c') : y === 190 || y === 191 ? hx('#3a3e66') : joint ? hx('#232850') : dith(x, y, t * 0.8 + HS(x, y, 27) * 0.15) ? hx('#252a4e') : hx('#2d3258'));
      }
      for (let k = 0; k < 6; k++) { const gx = x0 + Math.floor(HS(k, x0, 29) * (x1 - x0)), gh = 6 + Math.floor(HS(k, x0, 30) * 20); for (let y = 194; y < 194 + gh; y++) if (dith(gx, y, 0.5)) L.set(gx, y, hx('#1e2244')); }
    };
    wall(0, 256); wall(516, W);
    rect(L, 150, 198, 16, 22, hx('#e8e4d8')); rect(L, 152, 200, 12, 4, hx('#b8202c')); for (let y = 206; y < 216; y += 3) rect(L, 152, y, 12, 1, hx('#302a40')); L.set(150, 198, hx('#a8a498'));   // a poster
    // ---- the gate: 0.5-m pillars 2.2 m tall (×1), the 1.8-m iron gate between them, the school plate and emblem
    const pillar = (x0) => {
      for (let y = 126; y < GROUND; y++) for (let x = x0; x < x0 + 26; x++) {
        const edgeL = x <= x0 + 1, edgeR = x >= x0 + 24, band = (y - 126) % 22 === 0;
        L.set(x, y, edgeL ? hx('#6a6f9c') : edgeR ? hx('#2a2e52') : band ? hx('#353a66') : dith(x, y, (y - 126) / 130 + HS(x, y, 31) * 0.1) ? hx('#3d4270') : hx('#4a4f80'));
      }
      rect(L, x0 - 2, 122, 30, 2, hx('#8a8fbe')); rect(L, x0 - 2, 124, 30, 2, hx('#6a6f9c')); rect(L, x0 - 1, 126, 28, 1, hx('#2a2e52'));   // cap
    };
    pillar(256); pillar(490);
    rect(L, 262, 150, 14, 14, hx('#b8202c')); rect(L, 263, 151, 12, 12, hx('#c82a38'));
    const mask = ['....xx....xx', '...xxxxxxxx.', '..xxxx.xx.xx', '..xxxxxxxxxx', '.xxx.xxxx.xx', '..xxxxxxxxx.', '...xx.xx.xx.', '....xxxxxx..'];
    mask.forEach((r, j) => r.split('').forEach((ch, i) => { if (ch === 'x') L.set(263 + i, 153 + j, hx('#fff4e0')); }));   // the school emblem (oni)
    rect(L, 496, 146, 14, 44, hx('#e8e8f0')); rect(L, 496, 146, 14, 1, hx('#a8a8b8')); rect(L, 496, 189, 14, 1, hx('#a8a8b8'));
    for (let k = 0; k < 5; k++) { rect(L, 499, 150 + k * 8, 8, 2, hx('#302a40')); rect(L, 500, 153 + k * 8, 6, 1, hx('#302a40')); rect(L, 502, 152 + k * 8, 1, 3, hx('#302a40')); }   // the school name plate
    // the yard floor and the iron gate (bars every 8 px, three rails, a latch in the middle)
    for (let y = 188; y < GROUND; y++) for (let x = 282; x < 490; x++) L.set(x, y, dith(x, y, (y - 188) / 60) ? hx('#1c2044') : hx('#232858'));
    for (let x = 282; x < 490; x++) { L.set(x, 146, hx('#6a6f9c')); L.set(x, 147, hx('#4a4f80')); L.set(x, 148, hx('#2f3462')); L.set(x, 192, hx('#4a4f80')); L.set(x, 193, hx('#2f3462')); L.set(x, 236, hx('#4a4f80')); L.set(x, 237, hx('#2f3462')); }
    for (let x = 286; x < 490; x += 8) for (let y = 149; y < GROUND; y++) { L.set(x, y, hx('#4a4f80')); L.set(x + 1, y, hx('#2f3462')); if (y === 144 || y === 145) { L.set(x, y, hx('#5a5f8a')); L.set(x + 1, y, hx('#5a5f8a')); } }
    for (let x = 286; x < 490; x += 8) L.set(x, 143, hx('#8a8fbe'));   // spear tips
    rect(L, 382, 186, 8, 12, hx('#2a2e52')); rect(L, 383, 188, 6, 3, hx('#8a8fbe'));   // the latch
    // ---- the utility pole on the sidewalk (×1, runs out of the frame), its crossarm, transformer, wires and the street lamp
    for (let y = 0; y < GROUND; y++) for (let x = 605; x < 619; x++) L.set(x, y, x < 607 ? hx('#7a7fae') : x > 616 ? hx('#3a3e66') : dith(x, y, 0.5 + HS(x, y, 33) * 0.2) ? hx('#5a5f8a') : hx('#666b9a'));
    for (let y = 0; y < GROUND; y += 30) { rect(L, 605, y, 14, 1, hx('#4a4f80')); }
    rect(L, 578, 38, 66, 3, hx('#4a4f80')); rect(L, 578, 38, 66, 1, hx('#6a6f9c')); for (const ix of [582, 596, 626, 640]) { rect(L, ix, 34, 3, 4, hx('#c8c4d8')); rect(L, ix, 33, 3, 1, hx('#e8e8f0')); }   // crossarm + insulators
    rect(L, 619, 60, 14, 22, hx('#2e3358')); rect(L, 619, 60, 14, 2, hx('#4a4f80')); rect(L, 621, 64, 10, 14, hx('#262a50')); rect(L, 619, 82, 14, 2, hx('#1e2244'));   // transformer
    const wire = (x0, y0, x1, y1, sag) => { for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0), y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t); L.set(x, Math.round(y), hx('#141a3a')); } };
    wire(0, 26, 583, 34, 9); wire(0, 34, 597, 34, 10); wire(627, 34, W, 22, 4); wire(641, 34, W, 30, 4); wire(0, 46, 605, 52, 7);
    rect(L, 566, 56, 42, 3, hx('#4a4f80')); rect(L, 566, 56, 42, 1, hx('#6a6f9c')); rect(L, 560, 58, 18, 8, hx('#3a3e66')); rect(L, 561, 59, 16, 6, hx('#5a5f8a'));   // the lamp arm and head
    for (let y = 61; y < 66; y++) for (let x = 562; x < 576; x++) L.set(x, y, dith(x, y, 0.6) ? hx('#fff6d0') : hx('#ffe080'));
    // ---- the ground: tiled sidewalk with the yellow tactile strip, the kerb, the asphalt road with its markings
    for (let y = GROUND; y < 252; y++) for (let x = 0; x < W; x++) {
      const tile = (Math.floor(x / 12) + Math.floor((y - GROUND) / 6)) & 1, joint = x % 12 === 0 || (y - GROUND) % 6 === 0;
      L.set(x, y, y === GROUND ? hx('#7a7fae') : joint ? hx('#2f3462') : tile ? hx('#4a4f80') : hx('#444a78'));
    }
    for (let x = 0; x < W; x++) for (let y = 245; y < 249; y++) L.set(x, y, ((x % 4 === 1 || x % 4 === 2) && (y === 246 || y === 247)) ? hx('#d8b83a') : hx('#c9a830'));   // 点字ブロック
    rect(L, 0, 252, W, 1, hx('#8a8fbe')); rect(L, 0, 253, W, 2, hx('#3a3e66'));   // the kerb
    const g = ['#3e4374', '#2f3462', '#262a52', '#1e2246', '#181b3a'].map(hx);
    for (let y = 255; y < H; y++) { const t = (y - 255) / (H - 255); for (let x = 0; x < W; x++) L.set(x, y, dith(x, y, t * 2.2 - Math.floor(t * 2.2)) ? g[Math.min(4, 2 + Math.floor(t * 2.2))] : g[Math.min(4, 1 + Math.floor(t * 2.2))]); }
    for (let x = 0; x < W; x++) if (x % 16 < 10) L.set(x, 257, hx('#c9cce6'));   // the edge line
    for (let x = 300; x < 470; x += 18) for (let y = 261; y < H - 2; y++) for (let i = 0; i < 9; i++) if (dith(x + i, y, 0.75)) L.set(x + i, y, hx('#c9cce6'));   // the crossing in front of the gate
    for (let y = -3; y <= 3; y++) for (let x = -7; x <= 7; x++) if ((x * x) / 49 + (y * y) / 9 <= 1) L.set(180 + x, 263 + y, (x + y) % 2 ? hx('#2a2e58') : hx('#3a3e6a'));   // a manhole
    rect(L, 396, 250, 10, 2, hx('#1a1d38')); for (let i = 0; i < 5; i++) L.set(397 + i * 2, 250, hx('#3a3e66'));   // a storm drain
    // ---- after the rain: the wet road carries a faint violet sheen and every light becomes a streak (the reference)
    for (let y = 255; y < H; y++) for (let x = 0; x < W; x++) if (HS(x, y, 47) < 0.08 + (y - 255) / 60) L.set(x, y, rgba('#5a4a8a', 22 + Math.round((y - 255) * 1.5)));
    for (let y = 255; y < H; y++) for (let x = 555; x < 705; x++) { const d = Math.hypot((x - 630) / 72, (y - 262) / 9); if (d < 1 && dith(x, y, (1 - d) * 0.7)) L.set(x, y, rgba('#8a7ab8', 70)); }   // a puddle
    // the street lamp: its cone of light down to the sidewalk, and its reflection on the tiles and the road
    for (let y = 66; y < GROUND; y++) { const t = (y - 66) / (GROUND - 66), hw = 4 + t * 34; for (let x = Math.round(569 - hw); x <= Math.round(569 + hw); x++) { const e = 1 - Math.abs(x - 569) / hw, a = 30 * (1 - t * 0.85) * e; if (a >= 4 && dith(x, y, Math.min(1, a / 10))) L.set(x, y, rgba('#ffd890', Math.max(8, Math.round(a)))); } }
    streak(L, 560, 580, GROUND, 252, '#ffe0a0', 60); streak(L, 556, 584, 255, H, '#ffe0a0', 85);
    for (let k = 0; k < 4; k++) if (HS(k, 1, 41) < 0.5 || HS(k, 3, 41) < 0.4) streak(L, 26 + k * 56, 44 + k * 56, 255, H, '#ffd98a', 26);   // lit windows, faintly
    streak(L, 300, 470, 262, H, '#8a7ab8', 14);
    return L;
  }

  // the sheet-scale game shows everything at half size: 360×135 world, 240×135 view
  function half(L) {
    const w = L.w >> 1, h = L.h >> 1, c = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c[y * w + x] = L.c[(y * 2) * L.w + x * 2];
    return { w, h, c };
  }
  let FAR = null, NEAR = null;
  function paint() { if (!FAR) { FAR = paintFar(); NEAR = paintNear(); } return { far: FAR, near: NEAR }; }

  // ---------------------------------------------------------------- living background (「背景加入會動的物體」)
  // Everything is a pure function of the sim time t (ms), so nothing needs state: falling cherry petals swaying in
  // the wind (most behind the fighters, a few in front), the gate and street lamps flickering, windows of the
  // apartment switching on and off, clouds drifting over the moon, stars twinkling, a flight of bats now and then,
  // and a cat that walks the wall top every so often. Items are stage coordinates: { far, x, y, w, h, col, a, front }.
  const PINK = ['#ffb7cc', '#f7a3bd', '#ffd6e0', '#e88fa8'];   // CSS colours: the draw list's rects take strings
  const WINDOWS = [];
  for (let k = 0; k < 4; k++) WINDOWS.push([24 + k * 56, 80], [24 + k * 56, 142]);
  function anim(t, broken) {
    const out = [], s = t / 1000, H = HS, hx = (c) => c; broken = broken || new Set();
    // petals
    for (let k = 0; k < 34; k++) {
      const vy = 14 + H(k, 1, 21) * 16, per = 1.4 + H(k, 2, 21) * 2.2, amp = 5 + H(k, 3, 21) * 10;
      const y = ((H(k, 4, 21) * 300 + s * vy) % (GROUND + 30)) - 12;
      const x = ((H(k, 5, 21) * W + s * (10 + H(k, 6, 21) * 12) + Math.sin(s / per * Math.PI * 2 + k) * amp) % W + W) % W;
      const big = H(k, 7, 21) > 0.6, front = k % 5 === 0;
      out.push({ x: Math.round(x), y: Math.round(y), w: big ? 3 : 2, h: 2, col: PINK[k & 3], a: front ? 0.9 : 0.75, front });
      if (big) out.push({ x: Math.round(x) + 1, y: Math.round(y) - 1, w: 1, h: 1, col: PINK[(k + 1) & 3], a: 0.6, front });
    }
    // lamp flicker: the wide halos are painted (lamp props / near layer); this is only their wobble
    for (const [k, lx0, ly0, lw, lh, r, id] of [[0, 261, 106, 16, 16, 20, 'lampL'], [1, 495, 106, 16, 16, 20, 'lampR'], [2, 561, 59, 16, 6, 18, 'street']]) {
      if (broken.has(id)) continue;                        // a smashed lamp gives no light
      const f = 0.55 + 0.45 * Math.sin(s * 9 + k * 2) * Math.sin(s * 3.3 + k) + (H(Math.floor(s * 12) + k, 8, 21) > 0.9 ? -0.35 : 0);
      out.push({ x: lx0 - r, y: ly0 - r, w: lw + r * 2, h: lh + r * 2, col: hx('#ffd070'), a: 0.02 + 0.04 * f });
      out.push({ x: lx0 - (r >> 1), y: ly0 - (r >> 1), w: lw + r, h: lh + r, col: hx('#ffe4a0'), a: 0.04 + 0.06 * f });
    }
    // the vending machine's cold light wobbles too (its halo and reflection are in the prop picture), gone once smashed
    if (!broken.has('vend')) {
      const f = 0.85 + 0.15 * Math.sin(s * 7.3) + (H(Math.floor(s * 9), 13, 21) > 0.94 ? -0.5 : 0);
      out.push({ x: 34, y: 148, w: 48, h: 92, col: hx('#c0e8ff'), a: 0.03 * f });
    }
    // windows switching (the apartment block, 21×25 panes)
    for (let k = 0; k < 4; k++) {
      const slot = Math.floor(s / 1.1) + k * 7, on = H(slot, 9, 21) > 0.5, [wx, wy] = WINDOWS[Math.floor(H(slot, 10, 21) * WINDOWS.length) % WINDOWS.length];
      out.push({ x: wx, y: wy, w: 21, h: 25, col: on ? hx('#ffd98a') : hx('#0f1130'), a: 1 });
      if (on) out.push({ x: wx, y: wy + 13, w: 21, h: 12, col: hx('#e0b850'), a: 1 });
      out.push({ x: wx + 10, y: wy, w: 1, h: 25, col: hx('#2c3060'), a: 1 }); out.push({ x: wx, y: wy + 12, w: 21, h: 1, col: hx('#2c3060'), a: 1 });
    }
    // wisps drifting over the moon (far layer)
    for (const [k, y0, len, col, spd] of [[0, 62, 70, '#2c2b66', 3.2], [1, 74, 48, '#272560', 2.4], [2, 92, 90, '#232258', 1.8]]) {
      const x0 = ((k * 170 + s * spd) % (FAR_W + 140)) - 70;
      for (let x = 0; x < len; x += 2) {
        const bump = (x % 13 < 9) ? 2 : 0;
        out.push({ far: true, x: x0 + x, y: y0 + ((x / 2) & 1) - bump, w: 2, h: 2 + bump, col: hx(col), a: 0.9 });
      }
    }
    // twinkling stars (far)
    for (let k = 0; k < 14; k++) {
      const x = Math.floor(H(k, 1, 11) * FAR_W), y = Math.floor(Math.pow(H(k, 2, 11), 1.5) * 150);
      const tw = 0.5 + 0.5 * Math.sin(s * (1.5 + H(k, 12, 21) * 3) + k * 1.7);
      out.push({ far: true, x, y, w: 1, h: 1, col: hx('#ffffff'), a: tw });
    }
    // the warning lights on the far tower blink
    if (Math.floor(s * 1.2) & 1) { out.push({ far: true, x: 379, y: 49, w: 3, h: 2, col: hx('#ff6060'), a: 0.9 }); }
    // bats crossing the sky every 14 s (far)
    const bp = (s % 14) / 14;
    if (bp < 0.45) for (let k = 0; k < 3; k++) {
      const bx = FAR_W + 40 - bp / 0.45 * (FAR_W + 80) + k * 22, by = 58 + k * 9 + Math.sin(s * 6 + k) * 4, flap = Math.floor(s * 10 + k) & 1;
      out.push({ far: true, x: bx, y: by, w: 2, h: 1, col: hx('#0a0b1c'), a: 1 });
      out.push({ far: true, x: bx - 3, y: by - flap, w: 3, h: 1, col: hx('#0a0b1c'), a: 1 });
      out.push({ far: true, x: bx + 2, y: by - flap, w: 3, h: 1, col: hx('#0a0b1c'), a: 1 });
    }
    // a cat walking the wall top (right of the gate) every 26 s, behind the fighters
    const cp = (s % 26) / 26;
    if (cp > 0.7) {
      const u = (cp - 0.7) / 0.3, cx = 712 - u * 180, cy = 180, step = Math.floor(s * 6) & 1;
      const C = hx('#0c0d1e');
      out.push({ x: cx, y: cy + 2, w: 11, h: 4, col: C, a: 1 });                       // body
      out.push({ x: cx - 4, y: cy + 1, w: 5, h: 4, col: C, a: 1 });                    // head (walking left)
      out.push({ x: cx - 4, y: cy - 1, w: 1, h: 2, col: C, a: 1 }); out.push({ x: cx - 1, y: cy - 1, w: 1, h: 2, col: C, a: 1 });   // ears
      out.push({ x: cx + 11, y: cy - 2 + step, w: 1, h: 5, col: C, a: 1 });          // tail
      out.push({ x: cx + 1 + step, y: cy + 6, w: 1, h: 2, col: C, a: 1 }); out.push({ x: cx + 8 - step, y: cy + 6, w: 1, h: 2, col: C, a: 1 });   // legs
      out.push({ x: cx - 3, y: cy + 2, w: 1, h: 1, col: hx('#ffe060'), a: 1 });        // an eye
    }
    return out;
  }

  // ---------------------------------------------------------------- breakable props (「場景可以破壞的東西」)
  // Every prop is painted pixel by pixel at the stage's density and at its real size (52 px / m: a 183-cm vending
  // machine is 95 px tall, a mama-chari 91 px long, a 70-cm cone 36 px), one picture per state (0 intact →
  // 1 damaged → 2 broken), inside a box big enough for its broken pose. The lit ones (lamps, the vending machine)
  // carry their own soft halo and their reflection on the wet ground in the picture, so both vanish when smashed.
  // Stage coordinates: hit = the intact silhouette the attacks are tested against [x, y = top edge, w, h], box =
  // the picture area, hp = hits to break. game.js turns the pictures into canvases and draws them behind the
  // fighters; anim() skips the flicker of a smashed lamp / machine.
  const PROPS = [
    { id: 'vend', kind: 'vend', hp: 4, hit: [36, 145, 44, 95], box: [20, 125, 120, 145] },
    { id: 'bike', kind: 'bike', hp: 2, hit: [150, 188, 91, 52], box: [140, 180, 112, 60] },
    { id: 'lampL', kind: 'lamp', hp: 2, hit: [261, 106, 16, 16], box: [229, 70, 80, 200] },
    { id: 'lampR', kind: 'lamp', hp: 2, hit: [495, 106, 16, 16], box: [463, 70, 80, 200] },
    { id: 'sign', kind: 'sign', hp: 2, hit: [530, 193, 29, 47], box: [524, 193, 62, 47] },
    { id: 'bin', kind: 'bin', hp: 2, hit: [582, 193, 23, 47], box: [576, 190, 70, 50] },
    { id: 'cone1', kind: 'cone', hp: 1, hit: [640, 204, 20, 36], box: [640, 204, 44, 36] },
    { id: 'cone2', kind: 'cone', hp: 1, hit: [672, 204, 20, 36], box: [672, 204, 44, 36] },
  ];
  function breakables() {
    return PROPS.map((p) => ({ id: p.id, kind: p.kind, hp: p.hp, hp0: p.hp, state: 0, hits: new Set(), x: p.hit[0], y: p.hit[1], w: p.hit[2], h: p.hit[3], box: p.box.slice() }));
  }

  function paintVend(state) {   // 44×95 standing at (16, 20) of a 120×145 box (183 × 85 cm); broken: on its side, cans rolling out
    const L = layer(120, 145); const W0 = 44, H0 = 95, S = layer(W0, H0), dim = state > 0, OX = 16, OY = 20;
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
      const edge = x === 0 || y === 0 || x === W0 - 1 || y === H0 - 1;
      S.set(x, y, edge ? OUT : x <= 1 ? hx('#4a6fd0') : x >= W0 - 3 ? hx('#141f44') : dith(x, y, y / H0 * 0.8) ? hx('#1b3470') : hx('#22407f'));
    }
    rect(S, 1, 1, W0 - 2, 1, hx('#5a80e0')); rect(S, 1, 2, W0 - 2, 4, hx('#3b5fc0'));
    for (let i = 0; i < 5; i++) rect(S, 6 + i * 7, 3, 4, 2, dim ? hx('#8fa0d0') : hx('#ffffff'));   // the brand strip
    // the lit product window: four shelves of six cans, shelf lights, price tags
    const wx = 4, wy = 8, ww = 36, wh = 44;
    for (let y = wy; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) {
      const rim = x === wx || y === wy || x === wx + ww - 1 || y === wy + wh - 1;
      S.set(x, y, rim ? OUT : dim ? (dith(x, y, 0.5) ? hx('#2c3558') : hx('#354070')) : dith(x, y, (y - wy) / wh) ? hx('#8fc8ff') : hx('#bfe4ff'));
    }
    const CANS = [['#e84a5f', '#ff9fb0', '#a02040'], ['#ffd24a', '#fff0a0', '#b08a20'], ['#5ad0ff', '#c0f0ff', '#2a80b0'], ['#7ae06a', '#c8ffb0', '#3a9030'], ['#f4f4f8', '#ffffff', '#9a9ab0'], ['#ff8a3a', '#ffc090', '#b04a10']];
    for (let j = 0; j < 4; j++) {
      const sy = wy + 2 + j * 10;
      for (let i = 0; i < 6; i++) {
        const cx = wx + 2 + i * 6;
        if (dim && HS(i, j, 31) < 0.35) { rect(S, cx, sy + 4, 4, 2, hx('#20284c')); continue; }   // fallen cans
        const [c, hi, lo] = CANS[(i + j * 2) % CANS.length].map(hx);
        for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) S.set(cx + x, sy + y, x === 0 ? hi : x === 3 ? lo : c);
        S.set(cx + 1, sy, hx('#ffffff')); S.set(cx + 2, sy, hx('#ffffff'));
      }
      for (let x = wx + 1; x < wx + ww - 1; x++) { S.set(x, sy + 6, dim ? hx('#1d2548') : hx('#7aa9d0')); S.set(x, sy + 7, x % 6 === 4 ? (dim ? hx('#1d2548') : hx('#ffe08a')) : (dim ? hx('#20284c') : hx('#5a80b0'))); }
    }
    // the coin panel: a display, coin slot, lit buttons, bill slot; the dispenser hatch; the base
    rect(S, 4, 55, 36, 12, hx('#1a2a5c')); rect(S, 4, 55, 36, 1, hx('#2c4590'));
    rect(S, 6, 57, 10, 4, dim ? hx('#2c3558') : hx('#0a0f2a')); for (let i = 0; i < 3; i++) rect(S, 7 + i * 3, 58, 2, 2, dim ? hx('#3a4266') : hx('#7ad4ff'));   // the display digits
    rect(S, 19, 57, 1, 5, OUT); rect(S, 22, 57, 8, 1, OUT); rect(S, 22, 60, 8, 1, hx('#3a5090'));
    rect(S, 32, 57, 6, 8, dim ? hx('#2c3558') : hx('#7ad4ff')); rect(S, 33, 58, 2, 1, dim ? hx('#3a4266') : hx('#ffffff')); rect(S, 6, 63, 12, 2, hx('#3a5090'));
    rect(S, 6, 72, 32, 13, OUT); rect(S, 7, 73, 30, 11, hx('#101a3c')); rect(S, 7, 73, 30, 1, hx('#3a4a8a')); rect(S, 19, 78, 6, 1, hx('#3a4a8a'));
    rect(S, 1, 88, 42, 6, hx('#141f44')); rect(S, 1, 88, 42, 1, hx('#2c3558')); rect(S, 2, 93, 40, 1, OUT);
    if (state === 1) {   // cracks across the glass and a dent in the side
      line(S, 12, 11, 22, 30, OUT); line(S, 22, 30, 18, 46, OUT); line(S, 22, 30, 33, 40, OUT); line(S, 27, 10, 23, 20, hx('#5a7ab0'));
      for (let y = 36; y < 52; y++) { S.set(41, y, OUT); S.set(42, y, hx('#22407f')); }
    }
    if (state < 2) {
      if (!dim) { glow(L, OX + 22, OY + 30, 46, 52, '#9fd8ff', 34, 1.8); streak(L, OX + 4, OX + 40, OY + 95, OY + 107, '#c0e8ff', 50); streak(L, OX + 2, OX + 42, OY + 110, 145, '#c0e8ff', 70); }
      blit(L, S, OX, OY);
    } else {   // tipped over to the right, the glass dark, cans rolling out, a drink puddle
      const R = rot90cw(S); blit(L, R, OX, OY + 51);
      line(L, OX + 18, OY + 56, OX + 34, OY + 78, OUT); line(L, OX + 34, OY + 78, OX + 52, OY + 84, OUT);
      for (const [k, x, y] of [[0, 97, 90], [2, 93, 84], [1, 101, 86], [3, 89, 91], [4, 100, 80]]) { const [c, hi, lo] = CANS[k].map(hx); rect(L, OX + x, OY + y, 4, 3, c); L.set(OX + x, OY + y, hi); L.set(OX + x + 3, OY + y + 2, lo); }
      for (let x = OX + 84; x < OX + 104; x++) if (dith(x, OY + 94, 0.5)) L.set(x, OY + 94, hx('#3a4a8a'));
    }
    return L;
  }
  function paintLamp(state) {   // an 80×200 box: the halo around the 16×16 lamp at (32, 36), its light on the pillar, its streak on the ground
    const L = layer(80, 200);
    const ox = 32, oy = 36, P = (x, y, c) => L.set(ox + x, oy + y, c);
    if (state < 2) {
      glow(L, ox + 8, oy + 8, 40, 34, '#ffd070', state ? 22 : 40, 1.7);
      streak(L, ox - 2, ox + 18, 170, 182, '#ffe0a0', state ? 26 : 48); streak(L, ox - 6, ox + 22, 185, 200, '#ffe0a0', state ? 40 : 70);
    }
    rect(L, ox + 1, oy, 14, 2, hx('#5a5070')); rect(L, ox, oy + 2, 16, 2, hx('#3a3050')); rect(L, ox + 7, oy - 2, 2, 2, hx('#3a3050'));   // roof + finial
    rect(L, ox, oy + 4, 1, 10, hx('#3a3050')); rect(L, ox + 15, oy + 4, 1, 10, hx('#3a3050')); rect(L, ox, oy + 14, 16, 2, hx('#3a3050')); rect(L, ox + 1, oy + 14, 14, 1, hx('#5a5070'));
    if (state < 2) {
      const a = state ? hx('#ffe8a8') : hx('#fff2c0'), b = state ? hx('#e8c060') : hx('#ffd870');
      for (let y = 4; y < 14; y++) for (let x = 1; x < 15; x++) P(x, y, dith(x, y, 0.5) ? a : b);
      rect(L, ox + 6, oy + 7, 4, 4, hx('#ffffff')); rect(L, ox + 7, oy + 6, 2, 1, hx('#ffffff'));
      P(7, 12, hx('#5a5070')); P(8, 12, hx('#5a5070'));
      if (state) { for (const [x, y] of [[3, 5], [4, 6], [5, 7], [6, 8], [6, 9], [7, 10], [8, 11], [10, 5], [11, 6]]) P(x, y, hx('#3a3050')); rect(L, ox + 12, oy + 4, 3, 3, hx('#2a2240')); }
    } else {
      rect(L, ox + 1, oy + 4, 14, 10, hx('#2a2240')); rect(L, ox + 7, oy + 5, 2, 3, hx('#5a5070')); rect(L, ox + 6, oy + 8, 4, 2, hx('#3a3050'));
      for (const [x, y] of [[1, 4], [2, 4], [1, 5], [1, 6], [14, 12], [13, 13], [14, 13], [14, 11], [8, 13]]) P(x, y, hx('#e0b850'));
    }
    return L;
  }
  function paintBin(state) {   // 23×47 (90 × 45 cm); broken: on its side with the garbage out
    const L = layer(70, 50); const S = layer(25, 47);
    for (let y = 4; y < 47; y++) for (let x = 1; x < 24; x++) {
      const edge = x === 1 || x === 23 || y === 46, band = y === 14 || y === 34;
      S.set(x, y, edge ? hx('#1a1d38') : band ? hx('#8a90b0') : y === 15 || y === 35 ? hx('#3f4666') : x <= 3 ? hx('#8a90b0') : x >= 20 ? hx('#3f4666') : x >= 17 ? hx('#4c5476') : hx('#5c6486'));
    }
    rect(S, 8, 8, 9, 5, hx('#1a1d38')); rect(S, 9, 7, 7, 1, hx('#1a1d38')); rect(S, 9, 13, 7, 1, hx('#2a2e52'));   // the throw-in hole
    rect(S, 7, 20, 11, 8, hx('#2a2e52')); rect(S, 8, 21, 9, 6, hx('#e8e8f0')); rect(S, 9, 23, 3, 2, hx('#2a2e52')); rect(S, 13, 23, 3, 2, hx('#2a2e52'));   // the label
    const lidY = state ? 1 : 2;
    rect(S, 0, lidY + 2, 25, 2, hx('#8a90b0')); rect(S, 1, lidY, 23, 2, hx('#a8acc8')); rect(S, 2, lidY - 1, 21, 1, hx('#b8bcd8')); rect(S, 10, lidY - 2, 5, 1, hx('#8a90b0'));   // the domed lid
    if (state) { rect(S, 17, 24, 5, 10, hx('#3f4666')); for (const [x, y] of [[18, 25], [20, 28], [19, 31], [21, 30]]) S.set(x, y, hx('#1a1d38')); rect(S, 0, lidY, 12, 2, hx('#a8acc8')); }
    if (state < 2) blit(L, S, 5, 3);
    else {
      const R = rot90cw(S); blit(L, R, 2, 25);
      rect(L, 50, 46, 5, 2, hx('#e8e8f0')); rect(L, 55, 44, 3, 3, hx('#e8e8f0')); rect(L, 59, 45, 5, 3, hx('#c9cce6')); L.set(59, 45, hx('#ffffff')); rect(L, 64, 47, 4, 2, hx('#ffd24a'));
      rect(L, 44, 42, 7, 3, hx('#7ad4ff')); rect(L, 51, 43, 2, 1, hx('#3a80b0'));                                         // a bottle
      rect(L, 32, 44, 16, 3, hx('#8a90b0')); rect(L, 33, 43, 14, 1, hx('#b8bcd8'));                                       // the lid, flat
    }
    return L;
  }
  function paintSign(state) {   // an A-frame 29×47 (90 × 55 cm) with a no-entry sign; broken: flat on the ground
    const L = layer(62, 47);
    if (state < 2) {
      const sh = (y) => (state && y < 20 ? 3 : state && y < 30 ? 1 : 0);   // damaged: the top leans to the right
      rect(L, 2, 30, 2, 17, hx('#5c6486')); rect(L, 33, 30, 2, 17, hx('#5c6486')); rect(L, 0, 45, 6, 2, hx('#3f4666')); rect(L, 31, 45, 6, 2, hx('#3f4666'));   // rear legs + feet
      for (let y = 0; y < 38; y++) for (let x = 4; x < 33; x++) {
        const edge = x === 4 || x === 32 || y === 0 || y === 37;
        L.set(x + sh(y), y, edge ? hx('#8a90b0') : y >= 2 && y <= 8 ? hx('#b8202c') : x === 5 ? hx('#ffffff') : hx('#f4ecd0'));
      }
      for (let k = 0; k < 4; k++) { rect(L, 8 + k * 6 + sh(3), 3, 4, 1, hx('#fff4e0')); rect(L, 8 + k * 6 + sh(5), 5, 4, 1, hx('#fff4e0')); rect(L, 9 + k * 6 + sh(4), 4, 1, 3, hx('#fff4e0')); rect(L, 11 + k * 6 + sh(6), 6, 1, 2, hx('#fff4e0')); }   // 立入禁止
      ring(L, 18 + sh(20), 20, 5.2, 7.5, hx('#d8202c')); rect(L, 13 + sh(20), 19, 11, 3, hx('#ffffff'));                 // no-entry
      for (let x = 8; x < 29; x++) { if (x % 4 !== 3) L.set(x + sh(30), 30, hx('#302a40')); if (x < 26 && x % 3 !== 2) L.set(x + sh(33), 33, hx('#302a40')); }
      rect(L, 6, 36, 2, 11, hx('#a8acc8')); rect(L, 29, 36, 2, 11, hx('#a8acc8'));                                        // front legs
      if (state) { line(L, 11, 3, 20, 30, hx('#302a40')); line(L, 20, 30, 15, 37, hx('#302a40')); line(L, 3, 30, 0, 46, hx('#5c6486')); }
    } else {
      rect(L, 4, 39, 47, 8, hx('#8a90b0')); rect(L, 5, 40, 45, 6, hx('#f4ecd0')); rect(L, 6, 40, 6, 6, hx('#b8202c'));
      ellipse(L, 26, 43, 6, 2.5, hx('#d8202c')); rect(L, 22, 43, 9, 1, hx('#ffffff'));
      for (let x = 36; x < 49; x += 2) L.set(x, 42, hx('#302a40'));
      line(L, 50, 38, 60, 32, hx('#5c6486')); rect(L, 1, 45, 4, 2, hx('#3f4666'));
    }
    return L;
  }
  function paintCone(state) {   // 20×36 (70 cm); knocked over: on its side, tip to the right
    const L = layer(44, 36); const S = layer(20, 36);
    rect(S, 0, 32, 20, 4, hx('#1a1a2a')); rect(S, 0, 32, 20, 1, hx('#3a3a50')); rect(S, 2, 31, 16, 1, hx('#2a2a3a'));
    for (let y = 0; y < 32; y++) {
      const hw = 1.5 + (y / 32) * 6, x0 = Math.round(10 - hw), x1 = Math.round(10 + hw), band = (y >= 8 && y <= 12) || (y >= 18 && y <= 21);
      for (let x = x0; x <= x1; x++) S.set(x, y, x === x0 || x === x1 ? hx('#6a2a10') : x === x0 + 1 ? (band ? hx('#ffffff') : hx('#ffb070')) : x >= x1 - 2 ? (band ? hx('#b8b8c8') : hx('#c04a10')) : band ? hx('#f4f4f8') : hx('#ff7a2a'));
    }
    S.set(10, 0, hx('#ffb070')); S.set(9, 1, hx('#ffb070'));
    if (state < 2) blit(L, S, 0, 0); else blit(L, rot90cw(S), 0, 16);
    return L;
  }
  function paintBike(state) {   // a mama-chari 91×52 (175 × 100 cm), red frame, front basket, rear rack; broken: fallen flat
    const L = layer(112, 60);
    const TYRE = hx('#0c0d1e'), RIM = hx('#9aa0c0'), SPOKE = hx('#5c6486'), HUB = hx('#c9cce6'), RED = hx('#e84a5f'), DRED = hx('#a02040'), HRED = hx('#ff8fa0'), DARK = hx('#302a40'), STEEL = hx('#b8bcd8');
    if (state < 2) {
      const S = layer(91, 52);
      const wheel = (cx, cy) => { ring(S, cx, cy, 15.2, 17.5, TYRE); ring(S, cx, cy, 13.2, 15.2, RIM); ring(S, cx, cy, 14.2, 15.2, hx('#c9cce6')); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 8; line(S, cx - Math.cos(a) * 13, cy - Math.sin(a) * 13, cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, SPOKE); } ring(S, cx, cy, 0, 2.6, HUB); ring(S, cx, cy, 2.6, 3.6, DARK); };
      wheel(19, 34); wheel(72, 34);
      rect(S, 8, 11, 22, 3, DARK); rect(S, 9, 10, 20, 1, hx('#4a4a60')); rect(S, 28, 13, 2, 9, STEEL);                     // rear rack + stay
      line(S, 19, 34, 42, 38, DRED); line(S, 19, 33, 42, 37, RED); line(S, 19, 32, 42, 36, HRED);                          // chain stay
      line(S, 42, 37, 36, 8, DRED); line(S, 43, 37, 37, 8, RED);                                                           // seat tube
      line(S, 19, 32, 36, 9, RED); line(S, 20, 32, 37, 9, DRED);                                                           // seat stay
      for (let x = 37; x <= 62; x++) { const t = (x - 37) / 25, y = 10 + 22 * t * t; S.set(x, Math.round(y), RED); S.set(x, Math.round(y) + 1, DRED); S.set(x, Math.round(y) - 1, HRED); }   // the step-through down tube
      line(S, 62, 12, 68, 6, RED); line(S, 63, 12, 69, 6, DRED); line(S, 66, 8, 72, 34, RED); line(S, 67, 8, 73, 34, DRED);   // head tube + fork
      ellipse(S, 44, 38, 7, 5, DARK); ellipse(S, 44, 38, 5, 3.5, hx('#4a4a60')); rect(S, 47, 41, 5, 2, STEEL); rect(S, 39, 33, 4, 1, STEEL);   // chain guard, pedals
      rect(S, 30, 4, 12, 4, DARK); rect(S, 32, 3, 8, 1, hx('#4a4a60')); rect(S, 36, 8, 2, 3, STEEL);                        // saddle + post
      rect(S, 60, 2, 16, 2, STEEL); rect(S, 58, 2, 3, 3, DARK); rect(S, 75, 2, 3, 3, DARK); rect(S, 64, 0, 3, 2, hx('#ffd24a'));   // handlebar, grips, bell
      for (let y = 8; y < 22; y++) for (let x = 69; x < 91; x++) if (x === 69 || x === 90 || y === 8 || y === 21) S.set(x, y, RIM); else if ((x + y) & 1) S.set(x, y, SPOKE);   // the wire basket
      rect(S, 69, 8, 22, 1, STEEL); rect(S, 70, 22, 20, 1, DARK);
      rect(S, 62, 16, 8, 8, DARK); rect(S, 63, 17, 6, 6, hx('#c0a060')); rect(S, 64, 18, 4, 4, hx('#e8d090'));               // the headlamp
      if (state) { for (let y = 8; y < 22; y++) S.set(90, y, 0); line(S, 86, 6, 91, 20, RIM); line(S, 60, 2, 76, 5, STEEL); rect(S, 30, 5, 12, 3, DARK); }   // bent basket, twisted bar
      // leaning on the wall when damaged: rows shift by height
      for (let y = 0; y < 52; y++) for (let x = 0; x < 91; x++) { const c = S.c[y * 91 + x]; if (c) L.set(10 + x + (state ? Math.round((52 - y) * 0.22) : 0), 8 + y, c); }
    } else {   // fallen: the rear wheel flat on the ground, the front wheel still tilted, the frame lying low, the basket spilled
      ellipse(L, 26, 55, 17, 4, TYRE); ellipse(L, 26, 55, 15, 3, RIM); ellipse(L, 26, 55, 13, 2, hx('#1a1d38')); rect(L, 25, 54, 3, 2, HUB);
      ellipse(L, 82, 47, 12, 12, TYRE, 0.72); ellipse(L, 82, 47, 10.5, 10.5, RIM, 0.8); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 6; line(L, 82 - Math.cos(a) * 9, 47 - Math.sin(a) * 9, 82 + Math.cos(a) * 9, 47 + Math.sin(a) * 9, SPOKE); } rect(L, 81, 46, 3, 3, HUB);
      line(L, 26, 52, 70, 50, RED); line(L, 26, 53, 70, 51, DRED); line(L, 36, 52, 48, 40, RED); line(L, 48, 40, 68, 46, RED); line(L, 30, 50, 48, 40, DRED);
      rect(L, 44, 36, 12, 3, DARK); rect(L, 12, 44, 22, 3, DARK); rect(L, 86, 30, 2, 12, STEEL); rect(L, 84, 28, 16, 2, STEEL);   // saddle, rack, handlebar
      for (let y = 50; y < 58; y++) for (let x = 92; x < 112; x++) if (x === 92 || x === 111 || y === 50 || y === 57) L.set(x, y, RIM); else if ((x + y) & 1) L.set(x, y, SPOKE);
      rect(L, 100, 44, 8, 5, hx('#e8d090')); rect(L, 104, 41, 4, 3, hx('#ffd24a'));   // the headlamp and bell on the ground
    }
    return L;
  }
  const PAINTERS = { vend: paintVend, lamp: paintLamp, bin: paintBin, sign: paintSign, cone: paintCone, bike: paintBike };
  const propCache = new Map();
  function propImage(kind, state) {   // { w, h, c } for the prop kind in that state, painted once
    const key = kind + ':' + state;
    if (!propCache.has(key)) propCache.set(key, PAINTERS[kind](state));
    return propCache.get(key);
  }

  root.STAGE = { W, H, VW, GROUND, FAR_W, PXM, paint, half, anim, breakables, propImage, name: '東京鬼高校・夜の校門前', en: 'TOKYO ONI HIGH — NIGHT GATE' };
})(typeof window !== 'undefined' ? window : globalThis);
