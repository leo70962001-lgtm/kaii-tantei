// stage.js — 東京鬼高校・校門前 (rebuilt from scratch, 「場景整個重來」「參考夜景先做一版」): a 720 px wide street in
// front of the school gate at night, in the way of the konbini-street pin (981784787524549284): a lit convenience store
// on the left with a pink neon sign, the gate in the middle with a huge neon-lit cherry tree spreading over it from the
// school grounds, an apartment block on the right, a curved street lamp, poles and wires, a wet road that mirrors every
// light, petals on the ground. Seen through a 480×270 camera window.
//
// Scale: the fighter is 82 world px = 158 cm → 52 px per metre on the fight plane (the sidewalk, y = GROUND); things
// behind the gate are drawn smaller by their distance (the school ×0.3, the mid-rise blocks of the MID layer ×0.25).
// Depth = four parallax layers: far 0.35 (sky, drifting clouds, hazy city), mid 0.6 (blocks, the railway with its
// train, mist), near 1 (the street), front 1.25 (blossom branches in the corners).
// Every colour comes from the current theme TH: the night palette is the authored one, the other hours (dusk, the neon
// rain, the pastel noon) are derived from it plus their own sky / cloud / haze / light entries.
(function (root) {
  'use strict';
  const PX = root.PX;
  const W = 720, H = 270, VW = 480, GROUND = 240, FAR_W = 600, FRONT_W = 800, MID_W = 660, MID_RATE = 0.6, PXM = 52;
  const hx = PX.hex;
  const rgba = (hex, a) => ((hx(hex) & 0x00ffffff) | ((a & 255) << 24)) >>> 0;
  const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const dith = (x, y, t) => t * 16 > bayer[y & 3][x & 3] + 0.5;
  const HS = PX.hash;

  // ---------------------------------------------------------------- layers and small painters
  function layer(w, h) {
    const c = new Uint32Array(w * h);
    return { w, h, c, set(x, y, col) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) c[y * w + x] = col; }, get(x, y) { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < w && y < h ? c[y * w + x] : 0; } };
  }
  function wrapLayer(w, h) {   // x wraps: a layer that tiles horizontally (the drifting clouds)
    const c = new Uint32Array(w * h), wx = (x) => (((x | 0) % w) + w) % w;
    return { w, h, c, set(x, y, col) { y |= 0; if (y >= 0 && y < h) c[y * w + wx(x)] = col; }, get(x, y) { y |= 0; return y >= 0 && y < h ? c[y * w + wx(x)] : 0; } };
  }
  const rect = (L, x, y, w, h, col) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) L.set(x + i, y + j, col); };
  function line(L, x0, y0, x1, y1, col) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) { L.set(x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function ring(L, cx, cy, r0, r1, col) { for (let y = Math.floor(cy - r1); y <= cy + r1; y++) for (let x = Math.floor(cx - r1); x <= cx + r1; x++) { const d = Math.hypot(x - cx, y - cy); if (d >= r0 && d < r1) L.set(x, y, col); } }
  function ellipse(L, cx, cy, rx, ry, col, inner) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d <= 1 && (inner === undefined || d > inner)) L.set(x, y, col); } }
  function blit(L, S, ox, oy) { for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const c = S.c[y * S.w + x]; if (c) L.set(ox + x, oy + y, c); } }
  function rot90cw(S) { const R = layer(S.h, S.w); for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) R.set(S.h - 1 - y, x, S.c[y * S.w + x]); return R; }     // the top goes to the right
  function flipX(S) { const R = layer(S.w, S.h); for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) R.c[y * S.w + (S.w - 1 - x)] = S.c[y * S.w + x]; return R; }
  function rot90ccw(S) { const R = layer(S.h, S.w); for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) R.set(y, S.w - 1 - x, S.c[y * S.w + x]); return R; }    // the top goes to the left
  // a translucent colour over whatever is there: mixed into an opaque pixel, kept translucent over nothing
  function mixPx(L, x, y, col, a) {
    const d = L.get(x, y);
    if (!d || ((d >>> 24) & 255) < 255) { L.set(x, y, ((col & 0x00ffffff) | (Math.max(a, d ? (d >>> 24) & 255 : 0) << 24)) >>> 0); return; }
    const t = a / 255, r = ((d & 255) * (1 - t) + (col & 255) * t) | 0, g = (((d >> 8) & 255) * (1 - t) + ((col >> 8) & 255) * t) | 0, b = (((d >> 16) & 255) * (1 - t) + ((col >> 16) & 255) * t) | 0;
    L.set(x, y, (0xff000000 | (b << 16) | (g << 8) | r) >>> 0);
  }
  function glow(L, cx, cy, rx, ry, hex, aMax, pow) {   // a soft dithered radial glow
    const col = hx(hex);
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry); if (d >= 1) continue;
      const a = aMax * Math.pow(1 - d, pow || 1.6);
      if (a < 6) { if (dith(x, y, a / 6)) mixPx(L, x, y, col, 6); continue; }
      mixPx(L, x, y, col, Math.round(a));
    }
  }
  function streak(L, x0, x1, yTop, yBot, hex, aMax) {   // a light's reflection on the wet ground, breaking up with distance
    for (let y = yTop; y < yBot; y++) for (let x = x0; x < x1; x++) {
      const t = (y - yTop) / Math.max(1, yBot - yTop), edge = Math.min(x - x0, x1 - 1 - x) / Math.max(1, (x1 - x0) / 2);
      const a = aMax * (1 - t * 0.7) * Math.min(1, edge * 1.6) * (HS(x, y >> 1, 43) < 0.75 ? 1 : 0.35);
      if (a >= 5) mixPx(L, x, y, hx(hex), Math.round(a));
    }
  }
  const OUT = hx('#0a0f2a');

  // ---------------------------------------------------------------- palettes (「選擇場景」: four hours of one street)
  const c2 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const h2 = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mixc = (a, b, t) => { const A = c2(a), B = c2(b); return h2(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const lift = (h, k, tint) => { const [r, g, b] = c2(h); let R = 255 - (255 - r) * (1 - k), G = 255 - (255 - g) * (1 - k * 0.96), B = 255 - (255 - b) * (1 - k * 1.12); if (tint) { const T = c2(tint); R = R * 0.86 + T[0] * 0.14; G = G * 0.86 + T[1] * 0.14; B = B * 0.86 + T[2] * 0.14; } return h2(R, G, B); };
  function derive(base, f, over) {
    const o = {};
    for (const k in base) { const v = base[k]; o[k] = typeof v === 'string' && v[0] === '#' ? f(v) : Array.isArray(v) ? v.map((x) => (typeof x === 'string' && x[0] === '#' ? f(x) : x)) : (v && typeof v === 'object') ? derive(v, f, null) : v; }
    return Object.assign(o, over || {});
  }
  const NIGHT = {
    id: 'night', name: '夜の校門前', en: 'NIGHT GATE', day: false, rain: false, dense: true, cloudSpeed: 2.5,
    sky: ['#04061a', '#060a24', '#0a1030', '#0e163c', '#121e4a', '#182858', '#203468', '#2a4078', '#344c88'], stars: 220, moon: true, sun: null,
    cloud: { body: '#2c2262', shade: '#1c1648', lit: '#5a4a98', rim: '#a08ad0', warm: '#5a2a5c' }, cum: ['#c8b8f0', '#7a68b8', '#524698', '#241c50', '#3c3278', '#302868'],
    haze: ['#1e3a78', '#3a4a90'], farBody: '#0c1430', farEdge: '#1c2a58', farWin: ['#e8f4ff', '#9ad8ff', '#5ad0ff', '#ffffff'], farLit: 0.3,
    midBody: '#101a3a', midEdge: '#24325e', midWin: '#d0ecff', midWin2: '#7ac0ff', midLit: 0.34, mist: '#24346a',
    storeWall: '#2a2450', storeEdge: '#3a3466', storeSign: '#e8eef6', signA: '#3a8aff', signB: '#5ad0ff', signInk: '#1a2a50', awning: '#3a7ae0', awning2: '#e8f0ff', storeGlass: '#cfe4fa', storeGlassTop: '#dceeff', shelf: '#6a7aa0', storeDoor: '#9aa0b0', storeGlow: '#c0e8ff', teal: '#16302e', teal2: '#245048', redSign: '#c8302c', redSign2: '#e84a3a', poster: '#ece6dc', posterInk: '#d8302c',
    neon: '#5ad0ff', neonText: '#e8faff', neonBox: '#0a2040', neon2: '#ff5ad0',
    pillar: '#3c3868', pillarLight: '#5c5694', pillarDark: '#242048', cap: '#7c76ae', gate: '#3a3e66', gateLight: '#5c6190', gateDark: '#2c3060', plate: '#e8e8f0', plateInk: '#302a40', emblem: '#b8202c', emblemInk: '#fff4e0', yard: '#1c1a40',
    school: '#101838', schoolTrim: '#1c2650', schoolWin: '#0b1130', schoolLit: '#e8f4ff', schoolLit2: '#a8d0f0',
    apt: '#1e1c48', aptEdge: '#2e2c64', aptDark: '#151438', aptWin: '#0b1130', aptFrame: '#2c3466', aptLit: ['#e8f4ff', '#a8d0f0'], balcony: '#3c4074', ac: '#3a3e70', shutter: '#2a2e5a', shutter2: '#383c6c', door: '#101430', doorLit: '#ffe0a0', pipe: '#2a2e5c',
    pole: '#5a5f8a', poleLight: '#7a7fae', poleDark: '#3a3e66', wire: '#141a3a', lampHead: '#3a3e66', lampGlass: '#fff6d0', lampGlass2: '#ffe080', lampGlow: '#ffe8b0', insulator: '#c8c4d8',
    bark: '#1c1838', bark2: '#3a3058', bark3: '#100c20', sakura: ['#5a2a80', '#8c40a8', '#c068d0', '#e498e8', '#f6c8f4'], gap: '#221a44', chain: '#8a80b0', konbiniGlass: '#f6e6c4', konbiniGlassTop: '#f0dcb4', konbiniGlow: '#ffd8a0', signBand: '#7aa0c0', signInk2: '#1a3050', lintelA: '#e8605a', lintelB: '#e8605a',
    sidewalk: '#444a78', sidewalk2: '#4a4f80', joint: '#2f3462', top: '#7a7fae', tactile: '#c9a830', tactile2: '#d8b83a', kerb: '#8a8fbe', kerb2: '#3a3e66',
    road: ['#3e4374', '#2f3462', '#262a52', '#1e2246', '#181b3a'], roadLine: '#c9cce6', sheen: '#4a4a9a', puddle: '#7a80c0', petals: ['#d8a0f0', '#b878d8', '#f0d0ff', '#8a48b8'], drain: '#1a1d38',
    winLit: ['#e8f4ff', '#a8d0f0'],
    wood: '#4e3454', wood2: '#66466a', brick: '#3a2848', panel: '#e8ecf8', deckFace: '#7a5cb0', deckTile: '#9a80cc', pillarLit: '#b060b8', pillarLit2: '#7a3a90', fence: '#2a3a3a', fence2: '#3e5050', bush: '#1e3a34', bush2: '#2e5a4a', zebra: '#b8b0e8', gantry: '#4a80ff',
  };
  const THEMES = {
    night: NIGHT,
    dusk: derive(NIGHT, (c) => mixc(lift(c, 0.12), '#3a6a8a', 0.2), { id: 'dusk', name: '夕暮れの校門前', en: 'DUSK GATE', moon: false, sun: null, stars: 40,   // the konbini pin's blue hour
      sky: ['#101c34', '#162840', '#1e3650', '#264660', '#2e5670', '#38667e', '#44768c', '#52869a', '#6296a8'],
      cloud: { body: '#4a5a78', shade: '#324058', lit: '#c8a0a8', rim: '#f0c8c0', warm: '#a86878' }, cum: ['#f0d0c8', '#c8a0a8', '#8a6a80', '#3a3a58', '#5a5a78', '#4a4a68'], haze: ['#4a6a88', '#7a6a80'],
      farWin: ['#ffd8a0', '#ffe8c0'], farLit: 0.08, midLit: 0.12, dense: false, sakura: ['#8a4a60', '#b86878', '#d88898', '#eca8b0', '#f8c8cc'], petals: ['#eca8b0', '#d88898', '#f8c8cc', '#b86878'],
      aptLit: ['#ffd8a0', '#e8b070'], schoolLit: '#ffd8a0', schoolLit2: '#e8b070', winLit: ['#ffd8a0', '#e8b070'], neon: '#ff8ab0', neon2: '#7ad0e0', signA: '#ff8ab0', signB: '#ffb070',
      storeGlow: '#ffc890', konbiniGlow: '#ffd0a0', road: ['#4a4a58', '#3c3c4c', '#323244', '#2a2a3c', '#222234'], sidewalk: '#4a4652', sidewalk2: '#524e5a', joint: '#36323e', top: '#8a8290', kerb: '#9a929e', kerb2: '#3a3640' }),
    konbini: derive(NIGHT, (c) => mixc(lift(c, 0.12), '#3a6a8a', 0.2), { id: 'konbini', layout: 'konbini', name: '桜のコンビニ前', en: 'SAKURA KONBINI', moon: false, sun: null, stars: 40,
      sky: ['#101c34', '#162840', '#1e3650', '#264660', '#2e5670', '#38667e', '#44768c', '#52869a', '#6296a8'],
      cloud: { body: '#4a5a78', shade: '#324058', lit: '#c8a0a8', rim: '#f0c8c0', warm: '#a86878' }, cum: ['#f0d0c8', '#c8a0a8', '#8a6a80', '#3a3a58', '#5a5a78', '#4a4a68'], haze: ['#4a6a88', '#7a6a80'],
      farWin: ['#ffd8a0', '#ffe8c0'], farLit: 0.08, midLit: 0.12, dense: false, sakura: ['#8a5060', '#c07888', '#e09aa4', '#f0b8c0', '#f8d4d8'], petals: ['#f4c0c8', '#e8a0ac', '#fbd8dc', '#d08898'],
      aptLit: ['#ffd8a0', '#e8b070'], schoolLit: '#ffd8a0', schoolLit2: '#e8b070', winLit: ['#ffd8a0', '#e8b070'], neon: '#ff8ab0', neon2: '#7ad0e0', signA: '#ff8ab0', signB: '#ffb070',
      storeGlow: '#ffc890', konbiniGlow: '#ffd0a0', konbiniGlass: '#f2e6d6', konbiniGlassTop: '#ece0cc', signBand: '#8ab0d0', bark: '#3a2e34', bark2: '#6e505b', bark3: '#241a20', road: ['#4a4a58', '#3c3c4c', '#323244', '#2a2a3c', '#222234'], sidewalk: '#4a4652', sidewalk2: '#524e5a', joint: '#36323e', top: '#8a8290', kerb: '#9a929e', kerb2: '#3a3640' }),
    cyber: derive(NIGHT, (c) => mixc(c, '#1a5060', 0.16), { id: 'cyber', name: '雨のネオン街', en: 'NEON RAIN', moon: false, stars: 60, dense: true, rain: true, cloudSpeed: 3,
      sky: ['#04080e', '#061018', '#081622', '#0a1c2a', '#0c2232', '#0e2838', '#123040', '#163848', '#1a4050'],
      cloud: { body: '#123040', shade: '#0a1c2a', lit: '#2a5a6a', rim: '#5aa0b0', warm: '#4a2a5a' }, cum: ['#7ac0d0', '#3a7080', '#1e4a58', '#0a1c2a', '#163848', '#123040'], haze: ['#1a4a5a', '#3a2a5a'],
      farWin: ['#ff5ad0', '#5ad0ff'], farLit: 0.3, midLit: 0.4, sakura: ['#8a2a70', '#c0409a', '#e864b8', '#ff8ad4', '#ffc4ea'], petals: ['#ff9cd6', '#f070bc', '#ffd0ea', '#d04a98'], winLit: ['#ff8ad4', '#c050a0'], aptLit: ['#ff8ad4', '#c050a0'], schoolLit: '#ff8ad4', schoolLit2: '#c050a0', neon: '#ff5ad0', neon2: '#5ad0ff', signA: '#ff5ad0', signB: '#ff9a3a', midWin: '#ff8ad4', midWin2: '#c050a0' }),
    pastel: derive(NIGHT, (c) => lift(c, 0.5, '#c8b8e8'), { id: 'pastel', name: '桜の午後', en: 'PASTEL NOON', day: true, moon: false, stars: 0, cloudSpeed: 4,
      sky: ['#6a7ad0', '#7a8ad8', '#8c98e0', '#a0a8e4', '#b4b4e8', '#c4bce8', '#d4c4e8', '#e4cce8', '#f0d4e8'],
      cloud: { body: '#f0ecf8', shade: '#c4bce0', lit: '#ffffff', rim: '#ffffff', warm: '#f8e0e8' }, cum: ['#ffffff', '#f6f2fc', '#e6def4', '#b8acd8', '#dcd4ee', '#d0c8ea'], haze: ['#c8c0e8', '#ead4ea'],
      farWin: ['#ffffff'], farLit: 0.02, midLit: 0.04, dense: false, winLit: ['#fff4e0', '#f0e0c0'], petals: ['#ff9ad8', '#f078c8', '#ffc0ea', '#d858b0'], aptLit: ['#fff4e0', '#f0e0c0'], schoolLit: '#fff4e0', schoolLit2: '#f0e0c0', storeGlass: '#f6e8d4', storeGlassTop: '#f8ecdc',
      sakura: ['#b040a0', '#d858b0', '#f078c8', '#ff9ad8', '#ffc0ea'], lampGlass: '#e8f0f8', lampGlass2: '#d0dce8' }),
  };
  const THEME_IDS = ['konbini', 'night', 'dusk', 'cyber', 'pastel'];
  let TH = THEMES.night;
  function setTheme(id) { TH = THEMES[id] || THEMES.night; return TH; }
  const T = (k) => hx(TH[k]);   // a theme colour as a packed pixel

  // ---------------------------------------------------------------- far: sky, drifting clouds, hazy city
  function paintFar() {
    let L = layer(FAR_W, H);
    const sky = TH.sky.map(hx);
    for (let y = 0; y < H; y++) {
      const t = Math.pow(y / 226, 1.25) * (sky.length - 1), i = Math.min(sky.length - 2, Math.floor(t)), f = t - i;
      for (let x = 0; x < FAR_W; x++) L.set(x, y, dith(x, y, Math.min(1, f)) ? sky[i + 1] : sky[i]);
    }
    for (let k = 0; k < TH.stars; k++) {
      const x = Math.floor(HS(k, 1, 11) * FAR_W), y = Math.floor(Math.pow(HS(k, 2, 11), 1.5) * 150), b = HS(k, 3, 11);
      L.set(x, y, b > 0.86 ? hx('#ffffff') : b > 0.5 ? hx('#b3bcf0') : hx('#6f78bc'));
      if (b > 0.95) { L.set(x + 1, y, hx('#6f78bc')); L.set(x - 1, y, hx('#6f78bc')); L.set(x, y + 1, hx('#6f78bc')); L.set(x, y - 1, hx('#6f78bc')); }
    }
    if (TH.sun) { glow(L, TH.sun[0], TH.sun[1], 150, 70, '#ffb070', 120, 1.3); glow(L, TH.sun[0], TH.sun[1], 70, 30, '#ffe0a0', 110, 1.2); }
    if (TH.moon) {   // a small moon high on the right (the reference's sky is mostly neon-lit indigo)
      const mx = 520, my = 46, mr = 16;
      for (let y = my - 46; y <= my + 46; y++) for (let x = mx - 46; x <= mx + 46; x++) {
        const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
        if (d <= mr) { const lx = (x - mx) / mr, ly = (y - my) / mr; L.set(x, y, lx + ly > 1.0 ? hx('#d9b28e') : lx + ly > 0.5 ? hx('#efd1ac') : hx('#fbe8cc')); }
        else if (d <= mr + 8 && dith(x, y, (mr + 8 - d) / 14)) L.set(x, y, hx('#5a4a8c'));
        else if (d <= mr + 24 && dith(x, y, (mr + 24 - d) / 70)) L.set(x, y, hx('#3e3470'));
      }
      for (const [dx, dy, r] of [[-5, -3, 3], [5, 3, 2], [-2, 7, 2]]) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) L.set(mx + dx + x, my + dy + y, hx('#dcbb98'));
    }
    // clouds in their own wrapping layer (they drift): elongated banks with a lit rim, cauliflower cumulus
    const CL = wrapLayer(FAR_W, H), C1 = derive(TH.cloud, (c) => c), CC = {}; for (const k in C1) CC[k] = hx(C1[k]);
    const cloudBank = (blobs, ldx, ldy, warm) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [cx, cy, rx, ry] of blobs) { x0 = Math.min(x0, cx - rx - 2); x1 = Math.max(x1, cx + rx + 2); y0 = Math.min(y0, cy - ry - 2); y1 = Math.max(y1, cy + ry + 2); }
      const F = (x, y) => { let f = 0; for (const [cx, cy, rx, ry] of blobs) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d < 1) f += (1 - d) * (1 - d); } return f; };
      const Tt = 0.16;
      for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
        const f = F(x, y); if (f < Tt) continue;
        if (f < Tt + HS(x, y, 41) * 0.09) continue;
        const fl = F(x + ldx, y + ldy), fs = F(x - ldx, y - ldy);
        let c = CC.body;
        if (fl < Tt) c = CC.rim; else if (fl < Tt * 2.4) c = dith(x, y, 0.65) ? CC.lit : CC.body; else if (fl < Tt * 4 && dith(x, y, 0.3)) c = CC.lit;
        if (c === CC.body && fs < Tt * 1.8) c = dith(x, y, 0.7) ? CC.shade : CC.body;
        if (c === CC.body && f < Tt * 1.6 && dith(x, y, 0.5)) c = CC.shade;
        if (warm && c === CC.shade && y > y1 - (y1 - y0) * 0.35 && dith(x, y, 0.5)) c = CC.warm;
        CL.set(x, y, c);
      }
    };
    if (TH.layout !== 'konbini') { cloudBank([[60, 12, 60, 10], [120, 18, 70, 12], [190, 28, 60, 11], [250, 36, 55, 10], [300, 44, 48, 9], [340, 50, 40, 8], [150, 32, 40, 8], [220, 40, 30, 6]], 5, -4, false);
    cloudBank([[400, 40, 46, 8], [440, 44, 52, 9], [490, 40, 40, 7], [530, 46, 44, 8], [470, 50, 30, 5]], 4, -4, false); }
    cloudBank([[20, 50, 70, 8], [90, 54, 90, 9], [180, 56, 70, 8], [250, 58, 50, 6], [560, 52, 60, 7], [600, 56, 40, 6]], 4, -3, true);
    const cumulus = (bx, by, w, seed, ldx) => {
      const lobes = [], n = 4 + Math.floor(w / 20);
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; lobes.push([bx + t * w, by - (0.3 + 0.7 * Math.sin(t * Math.PI)) * w * 0.3 - HS(k, 1, seed) * 6, 7 + HS(k, 2, seed) * 6 + Math.sin(t * Math.PI) * w * 0.07]); }
      for (let k = 0; k < n - 1; k++) { const t = (k + 1) / n; lobes.push([bx + t * w, by - 6 - HS(k, 4, seed) * 6, 8 + Math.sin(t * Math.PI) * w * 0.06]); }
      const F = (x, y) => y <= by && lobes.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r);
      const CU = TH.cum.map(hx);
      for (let y = by - w * 0.6; y <= by; y++) for (let x = bx - 14; x <= bx + w + 14; x++) {
        if (!F(x, y)) continue;
        const nearEdge = !F(x + 2, y) || !F(x - 2, y) || !F(x, y - 2) || !F(x, y + 2);
        if (nearEdge && HS(x, y, seed + 3) < 0.3) continue;
        const lit = !F(x + ldx * 2, y - 2), mid = !F(x + ldx * 5, y - 5), shade = !F(x - ldx * 3, y + 3) || y > by - 4;
        CL.set(x, y, lit ? CU[0] : mid ? (dith(x, y, 0.55) ? CU[1] : CU[2]) : shade ? CU[3] : dith(x, y, 0.5) ? CU[4] : CU[5]);
      }
    };
    if (TH.layout !== 'konbini') { cumulus(486, 54, 70, 51, -1); cumulus(96, 44, 64, 53, 1); cumulus(300, 48, 44, 55, 1); cumulus(560, 40, 32, 57, -1); }   // the konbini's sky is clear
    if (TH.day) { cumulus(200, 34, 100, 59, 1); cumulus(400, 26, 60, 61, 1); }
    const SKY = L; L = layer(FAR_W, H);
    // the city: light pollution over the skyline, a far rank of towers in haze, a nearer rank with lit windows and neon
    for (let y = 16; y < 56; y++) for (let x = 0; x < FAR_W; x++) if (dith(x, y, ((y - 16) / 40) * 0.55)) L.set(x, y, hx(TH.haze[0]));
    for (let y = 40; y < 56; y++) for (let x = 0; x < FAR_W; x++) if (dith(x, y, ((y - 40) / 16) * 0.35)) L.set(x, y, hx(TH.haze[1]));
    for (const [y0, y1, sag] of [[6, 9, 3], [10, 12, 4], [15, 16, 3]]) for (let x = 0; x < FAR_W; x++) { const t = x / FAR_W; L.set(x, Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)), T('wire')); }   // distant wires
    rect(L, 470, 6, 2, 48, hx('#0a0c1e')); rect(L, 463, 12, 16, 1, hx('#0a0c1e')); rect(L, 465, 10, 1, 3, hx('#0a0c1e')); rect(L, 476, 10, 1, 3, hx('#0a0c1e'));   // a distant pole
    if (TH.layout === 'konbini') { farRoofs(L); return { sky: SKY, clouds: CL, city: L }; }
    const body = T('farBody'), edge = T('farEdge'), wins = TH.farWin.map(hx);
    const tower = (x0, w, top, lit, k) => {
      for (let y = top; y < GROUND; y++) for (let x = x0; x < x0 + w; x++) L.set(x, y, x === x0 || y === top ? edge : body);
      for (let x = x0 + 2; x < x0 + w - 3; x += 4) {   // windows lit in vertical strips (a column is on or off), plus a few floors lit right across
        const colOn = HS(x, k, 61) < lit * 1.5, c = wins[Math.floor(HS(x, k, 6) * wins.length)];
        for (let y = top + 3; y < GROUND - 6; y += 5) {
          const floorOn = HS(k, y, 62) < 0.07, on = (colOn && HS(x, y, 5) < 0.75) || floorOn;
          if (on) rect(L, x, y, 2, 3, floorOn ? wins[0] : c); else { L.set(x, y + 2, edge); L.set(x + 1, y + 2, edge); }
        }
      }
      const r = HS(x0, top, 8);
      if (r > 0.7) { rect(L, x0 + (w >> 1) - 1, top - 6, 2, 6, edge); L.set(x0 + (w >> 1) - 1, top - 7, hx('#ff5a5a')); }
      else if (r > 0.45) { rect(L, x0 + 3, top - 3, 6, 3, edge); rect(L, x0 + w - 8, top - 2, 5, 2, edge); }
      if (HS(k, 21, 4) > 0.55) { const sx = x0 + 3 + Math.floor(HS(k, 22, 4) * Math.max(1, w - 10)), sc = HS(k, 23, 4) > 0.5 ? T('neon') : T('neon2'); rect(L, sx, top + 8, 6, 2, sc); }
    };
    for (let k = 0; k < 26; k++) { const x0 = Math.floor(HS(k, 7, 3) * FAR_W), w = 15 + Math.floor(HS(k, 8, 3) * 40), top = 130 + Math.floor(HS(k, 9, 3) * 45); tower(x0, w, top, TH.farLit * 0.6, k + 100); }
    if (TH.dense) for (let k = 0; k < 34; k++) { const x0 = Math.floor(HS(k, 27, 3) * FAR_W), w = 12 + Math.floor(HS(k, 28, 3) * 26), top = Math.floor(HS(k, 29, 3) * 50); tower(x0, w, top, 0.35, k + 200); }   // the skyline above the viaduct, the tallest reaching the top of the picture
    rect(L, 60, 30, 18, 10, hx('#e8ecf8')); rect(L, 62, 32, 14, 6, hx('#c8d0f0')); if (!TH.day) glow(L, 69, 35, 20, 10, '#e8ecf8', 60, 1.4);   // a lit billboard on a tower
    rect(L, 248, 6, 4, 60, T('neon2')); rect(L, 248, 6, 1, 60, hx('#ff9ae8'));                                          // a magenta mast with a blue lattice gantry
    line(L, 250, 14, 330, 40, T('gantry')); line(L, 250, 22, 330, 48, T('gantry')); for (let i = 0; i <= 8; i++) { const x = 250 + i * 10, y = 14 + i * 3.25; line(L, x, y, x + 10, y + 11, T('gantry')); }
    const tx = 380, tt = 4, tb = 190;   // 東京タワー (only its top shows above the viaduct)
    for (let y = tt; y < tb; y++) {
      const t = (y - tt) / (tb - tt), hw = 1 + t * t * 14, c = ((y - tt) % 18) < 9 ? hx('#7a2a3a') : hx('#c8c4d8');
      for (let x = Math.round(tx - hw); x <= Math.round(tx + hw); x++) if (Math.abs(x - tx) > hw - 2 || (y % 6 === 0) || dith(x, y, 0.25)) L.set(x, y, c);
    }
    rect(L, tx - 5, 30, 10, 4, hx('#c8c4d8')); rect(L, tx - 8, 48, 16, 5, hx('#c8c4d8')); L.set(tx, tt - 1, hx('#ff4040')); L.set(tx, tt - 2, hx('#ff4040'));
    for (let k = 0; k < 18; k++) { const x0 = Math.floor(HS(k, 17, 4) * FAR_W), w = 18 + Math.floor(HS(k, 18, 4) * 33), top = 160 + Math.floor(HS(k, 19, 4) * 39); tower(x0, w, top, TH.farLit, k); if (HS(k, 24, 4) > 0.8) for (let y = top + 2; y < GROUND; y += 2) { L.set(x0 + 2, y, T('neon2')); L.set(x0 + w - 3, y, T('neon2')); } }
    return { sky: SKY, clouds: CL, city: L };
  }

  // ---------------------------------------------------------------- real proportions (「場景物體的大小要跟人的大小做真實的比例」)
  // The fighters are 82 px = 158 cm on the near sidewalk: 52 px/m, feet at y 240, the eye-level horizon near y 160.
  // The far kerb at y 188 puts the block 2.7× further from the camera, so it is painted at 18 px/m: a storey 54 px
  // (3 m), a window 18×22 (1 × 1.2 m), a door 18×36 (1 × 2 m), shops two storeys, the school wall 1.8 m with 0.9 m of
  // chain-link, gate pillars 2.2 m, fences 1 m, bushes 0.3–0.5 m, lanterns 30 × 50 cm, tree crowns 6–9 m on 0.4–0.5 m
  // trunks. The viaduct stands another 10 m back (12 px/m: the train 34 px = 3 m tall, cars 240 px = 20 m, passing
  // at 49 km/h). On the near sidewalk everything is at 52 px/m: the guardrail 42 px (0.8 m), lamps 2.75 m (what a jump attack reaches), the signal
  // post with the vehicle head 4.2 m up and the pedestrian head at 2.5 m, the vending machine 183 cm, the bicycle
  // 175 cm, the cherry tree's trunk 0.4 m with its crown (clusters 12–25 cm) mostly above the picture. The picture's
  // stack (towers / train / shops / street) stays, compressed: the skyscrapers show above the viaduct (y < 54).
  const MID_PXM = 18, MID_BASE = 188;
  let TREES = null, SAKURA = null, MASKL = null;
  // a cherry tree: a dark trunk and twisting limbs (recursive), the crown = small clusters of flowers hung along the twigs
  function sakuraOn(L, cx, cy, rx, ry, seed, opts) {
    opts = opts || {}; const near = L === MASKL, light = opts.light === undefined ? 1 : opts.light;
    const BARK = T('bark'), BARK2 = T('bark2'), BARK3 = T('bark3');
    const mark = (x, y) => { if (near) TREES.set(x, y, 1); };
    const limbLine = (x0, y0, x1, y1, w) => { for (let o = -w / 2; o < w / 2; o++) { const c = o < -w / 4 - 0.5 ? BARK2 : o > w / 4 ? BARK3 : BARK; line(L, x0 + o, y0, x1 + o, y1, c); if (near) line(TREES, x0 + o, y0, x1 + o, y1, 1); }
      if (opts.puff > 1.5) { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 2)); for (let i = 0; i <= n; i++) { const t = i / n, px = Math.round(x0 + (x1 - x0) * t - w / 2), py = Math.round(y0 + (y1 - y0) * t); if (HS(px, py, seed + 41) < 0.3) L.set(px, py - 1, hx(TH.sakura[3])); else if (HS(px, py, seed + 42) < 0.25) L.set(px + 1, py, BARK2); } } };   // petals lodged on the upper edge, flecks of bark
    const limbs = [];
    const grow = (x, y, ang, len, w, depth, k) => {
      const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
      limbs.push([x, y, x1, y1, w, depth]);
      if (depth <= 0) return;
      const n = 2 + (HS(k, depth, seed) > 0.45 ? 1 : 0);
      for (let i = 0; i < n; i++) { const spread = 0.45 + HS(k * 7 + i, depth, seed) * 0.5, a = ang + (i - (n - 1) / 2) * spread + (HS(k * 3 + i, depth + 9, seed) - 0.5) * 0.5; grow(x1, y1, a, len * (0.6 + HS(k + i, depth + 3, seed) * 0.25), Math.max(1, w * 0.62), depth - 1, k * 4 + i + 1); }
    };
    if (opts.trunk !== false) {
      const base = cy + ry * 0.38, bottom = opts.bottom || 190, tw = opts.trunkW || 6;
      for (let y = base; y < bottom; y++) { const w = tw + (y - base) / 40; for (let i = -w / 2; i < w / 2; i++) { const xx = cx + i + Math.round(Math.sin(y * 0.15 + seed) * 1.2); const crack = opts.puff > 1.5 && ((xx + seed) % 7 === 0) && HS(xx, y >> 3, seed + 44) < 0.6, ridge = opts.puff > 1.5 && ((xx + seed) % 7 === 3) && HS(xx, y >> 2, seed + 46) < 0.35; const tt = (i + w / 2) / w; L.set(xx, y, crack ? BARK3 : ridge ? hx(mixc(TH.bark2, '#ffffff', 0.18)) : HS(xx, y, seed + 43) < 0.08 ? BARK2 : opts.puff > 1.5 ? (tt < 0.1 ? hx(mixc(TH.bark2, '#ffffff', 0.3)) : tt < 0.34 ? BARK2 : tt < 0.68 ? BARK : tt < 0.9 ? BARK3 : hx(mixc(TH.bark3, '#000000', 0.5))) : i < -w / 4 ? BARK2 : i > w / 4 ? BARK3 : BARK); mark(xx, y); } }   // a cylinder: bright rim, light, mid, dark, edge
      if (opts.skeleton) opts.skeleton.forEach(([x0, y0, x1, y1, w], k) => { limbs.push([x0, y0, x1, y1, w, 3]); grow(x1, y1, Math.atan2(y1 - y0, x1 - x0), Math.hypot(x1 - x0, y1 - y0) * 0.42, Math.max(2, w * 0.55), 2, 31 + k * 5); });   // the pin's limbs: given, then twigs grown from their ends
      else { grow(cx, base, -Math.PI / 2 + (HS(1, 1, seed) - 0.5) * 0.5, ry * 0.42, tw - 1, 3, 1);
      grow(cx, base + 6, -Math.PI / 2 - 0.9 * (HS(2, 1, seed) > 0.5 ? 1 : -1), ry * 0.32, 3, 2, 9);
      if (opts.big) grow(cx, base + 12, -Math.PI / 2 + 0.9 * (HS(2, 1, seed) > 0.5 ? 1 : -1), ry * 0.3, 3, 2, 17); }
    } else grow(cx, cy, opts.ang || Math.PI / 2, opts.len || ry * 0.45, 5, 3, 1);
    limbs.sort((p, q) => q[4] - p[4]);
    for (const [x0, y0, x1, y1, w] of limbs) limbLine(x0, y0, x1, y1, w);
    const TONES = TH.sakura.map(hx), WHITE = hx('#fff2f8'), GAP = T('gap');
    const cluster = (fx, fy, r, k) => {
      if (opts.grain) {   // the pin's blossom: a scatter of tiny flowers, dense in the middle and lacy at the edge, lit top-right, a rose shade underneath, white glints
        for (let y = Math.floor(fy - r); y <= fy + r; y++) for (let x = Math.floor(fx - r); x <= fx + r; x++) {
          const d = Math.hypot(x - fx, y - fy) / r; if (d > 1) continue;
          const n = HS(x, y, seed + 6 + k), pfill = 0.92 * Math.pow(1 - d, 0.55); if (n > pfill) continue;
          const l = ((x - fx) / r) * 0.5 * light - ((y - fy) / r) * 0.8 + (HS(x, y, seed + 7) - 0.5) * 0.7, under = (y - fy) / r > 0.45 && HS(x, y, seed + 8) < 0.5;
          L.set(x, y, HS(x, y, seed + 9) < 0.06 ? WHITE : under ? TONES[HS(x, y, seed + 10) < 0.5 ? 0 : 1] : l > 0.45 ? TONES[4] : l > 0.05 ? TONES[3] : l > -0.35 ? TONES[2] : TONES[1]); mark(x, y);
        }
        return;
      }
      for (let y = Math.floor(fy - r); y <= fy + r; y++) for (let x = Math.floor(fx - r); x <= fx + r; x++) {
        const d = Math.hypot(x - fx, y - fy) / r + HS(x, y, seed + 5) * 0.25; if (d > 1) continue;
        const n = HS(x, y, seed + 6 + k); if (n < (opts.lace ? 0.34 : opts.sparse ? 0.24 : opts.puff > 1.5 ? 0.2 : 0.13)) continue;
        const l = ((x - fx) / r) * 0.55 * light - ((y - fy) / r) * 0.75 + (HS(x, y, seed + 7) - 0.5) * (opts.puff > 1.5 ? 0.25 : 0.5);
        L.set(x, y, n > (opts.puff > 1.5 ? 0.93 : 0.96) ? WHITE : l > 0.55 ? TONES[4] : l > 0.15 ? TONES[3] : l > -0.25 ? TONES[2] : l > -0.6 ? TONES[1] : TONES[0]); mark(x, y);
      }
    };
    let k = 0;
    for (const [x0, y0, x1, y1, w, depth] of limbs) {
      const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(2, Math.round(len / 3.5)), per = opts.lace ? 1 : opts.sparse || opts.puff > 1.5 ? (depth === 0 ? 2 : 1) : depth === 0 ? 3 : depth === 1 ? 2 : 1;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t;
        for (let c = 0; c < per; c++) {
          const ox = (HS(i * 13 + c, 21, seed + k) - 0.5) * (10 + w * 2), oy = (HS(i * 13 + c, 22, seed + k) - 0.5) * 12, fx = bx + ox, fy = by + oy;
          if (((fx - cx) / rx) ** 2 + ((fy - cy) / ry) ** 2 > 1.05) continue;
          cluster(fx, fy, ((opts.sparse ? 2 : 2.5) + HS(i + c, 23, seed + k) * (opts.sparse ? 2.2 : 3.0)) * (opts.puff || 1), k);
        }
      }
      k++;
    }
    for (const [x0, y0, x1, y1, w, depth] of limbs) if (depth === 0 && HS(x0 + x1, y0 + y1, seed + 45) < 0.35) line(L, x0, y0, x1, y1, BARK3);   // twigs threading through the blossoms
    if (opts.puff > 1.5) { for (const [x0, y0, x1, y1, w, depth] of limbs) if (depth >= 2 && HS(x0 * 3 + x1, y0 + y1 * 3, seed + 47) < 0.6) limbLine(x0, y0, x1, y1, Math.max(2, w * 0.8)); let kk = 0; for (const [x0, y0, x1, y1, w, depth] of limbs) { if (depth >= 2 && HS(x0 + y1, y0 + x1, seed + 48) < 0.5) { const t = HS(kk, 49, seed), fx = x0 + (x1 - x0) * t, fy = y0 + (y1 - y0) * t; cluster(fx + (HS(kk, 50, seed) - 0.5) * 8, fy - 2, 5 * (opts.puff || 1) * 0.9, kk); } kk++; } }   // the pin's thick branches in front of the blossoms, a few clusters over them again
    for (let g = 0; g < 8; g++) { const gx = cx + (HS(g, 31, seed) - 0.5) * rx * 1.4, gy = cy + (HS(g, 32, seed) - 0.5) * ry * 1.2; for (let y = gy - 2; y <= gy + 2; y++) for (let x = gx - 3; x <= gx + 3; x++) if (L.get(x, y) && HS(x, y, seed + 33) < 0.5) L.set(x, y, GAP); }
  }
  const WINDOWS = [];   // switching panes [x, y, w, h] in mid-layer coordinates
  // ---------------------------------------------------------------- 「再把背景重新製作」: the konbini stage, remade after the pin
  // (Lily30 Griffin's konbini under a cherry tree at the blue hour). No road: the fighters stand on the pavement in front of
  // the store, which is ~3 m behind them — painted in the MID layer (rate 0.6 = 1.67× the fighters' depth, 31 px/m, base
  // y 208): the store 10 m wide with its glass 2.2 m (68 px), the sign band 0.58 m, the vending machines and ATM in front,
  // the blue road sign, a dark neighbour house on the right with one warm window, a walled house on the left. The great
  // tree and the utility pole stand on the pavement (NEAR, 52 px/m): the trunk 0.5 m wide, the crown filling the top-left,
  // branches over the store, wires across the sky. The store's light spills onto the pavement; petals drift everywhere.
  function paintMidKonbini() {
    const L = layer(MID_W, H); MASKL = L; TREES = layer(MID_W, H); WINDOWS.length = 0;
    const B = 208;
    const win = (x, y, w, h, lit) => {   // a window; a lit one is a light mask: bright centre falling to dark edges, an inner frame, a halo on the wall
      if (lit && !TH.day) glow(L, x + w / 2, y + h / 2, w * 1.1, h * 0.9, TH.aptLit[0], 30, 1.6);
      rect(L, x - 1, y - 1, w + 2, h + 2, T('aptFrame'));
      if (lit) { const c0 = hx(TH.aptLit[0]), c1 = hx(TH.aptLit[1]), c2 = hx(mixc(TH.aptLit[1], '#000000', 0.45)); for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const d = Math.max(Math.abs(xx + 0.5 - x - w / 2) / (w / 2), Math.abs(yy + 0.5 - y - h / 2) / (h / 2)); L.set(xx, yy, d < 0.5 ? c0 : d < 0.82 ? (dith(xx, yy, (d - 0.5) / 0.32) ? c1 : c0) : c2); } rect(L, x + 1, y + 1, w - 2, 1, c2); rect(L, x + 1, y + 1, 1, h - 2, c2); }
      else { rect(L, x, y, w, h, T('aptWin')); rect(L, x + 2, y + 2, 4, 1, T('aptFrame')); }
      rect(L, x + (w >> 1), y, 1, h, T('aptFrame')); rect(L, x - 1, y + h + 1, w + 2, 1, T('aptDark')); WINDOWS.push([x, y, w, h]);
    };
    const wall = (x0, x1, top, key, edgeKey) => { rect(L, x0, top, x1 - x0, B - top, T(key)); rect(L, x0, top, x1 - x0, 2, T(edgeKey)); rect(L, x0, top, 1, B - top, T(edgeKey)); rect(L, x1 - 1, top, 1, B - top, T('aptDark')); const sp = hx(mixc(TH[key], TH[edgeKey], 0.5)); for (let y = top + 2; y < B; y++) for (let x = x0 + 1; x < x1 - 1; x++) if (HS(x, y, 45) < 0.025) L.set(x, y, sp); };
    const roof = (x0, x1, y0, h) => { rect(L, x0 - 4, y0, x1 - x0 + 8, h, T('aptDark')); rect(L, x0 - 4, y0, x1 - x0 + 8, 1, hx(mixc(TH.aptDark, '#ffffff', 0.25))); for (let x = x0 - 4; x < x1 + 4; x += 6) rect(L, x, y0 + 1, 1, h - 1, hx(mixc(TH.aptDark, '#000000', 0.3))); rect(L, x0 - 4, y0 + h - 1, x1 - x0 + 8, 1, hx(mixc(TH.aptDark, '#000000', 0.4))); };   // a tiled eave
    const chain = (x0, x1, y0, y1) => { const c = T('chain'); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if ((x + y) % 4 === 0 || (x - y + 4000) % 4 === 0) L.set(x, y, c); for (let x = x0; x < x1; x += 24) rect(L, x, y0 - 2, 2, y1 - y0 + 2, T('fence2')); rect(L, x0, y0 - 2, x1 - x0, 1, T('fence2')); };
    const bushes = (x0, x1, r0) => { for (let x = x0; x < x1; x += 14) { const r = r0 + Math.floor(HS(x, 71, 5) * 4); ellipse(L, x + 7, B - 1, r + 1, r, T('bush')); ellipse(L, x + 6, B - 2, r - 1, r - 2, T('bush2')); } };
    const acunit = (x, y) => { rect(L, x, y, 24, 18, T('ac')); rect(L, x, y, 24, 1, T('pole')); for (const dy of [4, 8, 12, 16]) rect(L, x + 1, y + dy, 22, 1, T('aptDark')); };
    // ---- the left: a two-storey house behind a 1.8 m wall with chain-link, a gate, a hedge; a sparse far tree behind it
    wall(0, 200, 40, 'apt', 'aptEdge'); roof(0, 200, 32, 8);
    for (const y of [62, 112]) for (let x = 22; x < 190; x += 50) win(x, y, 18, 24, x === 72 && y === 112);   // one window lit (0.6 × 0.8 m)
    acunit(150, 96); rect(L, 197, 40, 1, B - 40, hx('#5a5a7a'));
    sakuraOn(L, 60, 60, 70, 46, 21, { trunkW: 7, bottom: 156, sparse: true, light: -1, grain: true });
    chain(0, 130, 136, 152); chain(176, 200, 136, 152);
    for (let x = 0; x < 200; x++) for (let y = 152; y < B - 4; y++) if (x < 130 || x >= 176) L.set(x, y, y === 152 ? T('cap') : dith(x, y, 0.5) ? T('pillar') : T('pillarDark'));   // the wall
    for (const px0 of [130, 168]) { rect(L, px0, 142, 8, B - 4 - 142, T('pillar')); rect(L, px0, 142, 1, B - 4 - 142, T('pillarLight')); rect(L, px0 - 1, 141, 10, 2, T('cap')); }   // the gate pillars
    for (let x = 140; x < 168; x += 5) rect(L, x, 148, 2, B - 4 - 148, T('gateLight')); rect(L, 138, 147, 30, 1, T('gateLight')); rect(L, 138, B - 5, 30, 1, T('gateDark'));   // the gate bars
    rect(L, 0, B - 4, MID_W, 4, T('sidewalk2')); rect(L, 0, B - 4, MID_W, 1, T('top'));   // the store's front line / the pavement's far edge
    bushes(4, 126, 6); bushes(178, 198, 5);
    // ---- the konbini (x 230–490 = 8.4 m, base 208), proportioned like the pin's: a tiled roof, a 1 m sign band with big
    // lettering, the tube and downlights, a wide coral lintel with large text, the 2.6 m glass front, the open door
    rect(L, 200, 88, 30, B - 92, hx(mixc(TH.storeWall, '#000000', 0.35))); rect(L, 214, 96, 1, B - 100, hx('#5a5a7a'));   // the store's dark side wall and a downpipe
    wall(230, 490, 88, 'storeWall', 'storeEdge'); roof(230, 490, 76, 14);
    rect(L, 230, 90, 260, 30, T('signBand')); rect(L, 230, 90, 260, 1, hx('#c8d8e8')); for (let y = 112; y < 119; y++) for (let x = 230; x < 490; x++) mixPx(L, x, y, hx('#ffffff'), Math.round(6 + (y - 112) * 5)); rect(L, 230, 119, 260, 1, T('signInk2'));   // the sign band (1 m), lit from below
    for (const [x, w] of [[298, 24], [330, 26], [364, 24], [396, 26]]) { rect(L, x - 1, 95, w + 2, 20, hx('#c8d8e8')); rect(L, x, 96, w, 18, T('signInk2')); rect(L, x + 4, 99, w - 8, 3, T('signBand')); rect(L, x + 4, 106, w - 8, 3, T('signBand')); rect(L, x + 4, 100, 2, 10, T('signBand')); rect(L, x + w - 8, 102, 2, 8, T('signBand')); }   // four big characters
    if (!TH.day) glow(L, 360, 105, 120, 20, TH.signBand, 26, 1.4);
    rect(L, 230, 120, 260, 1, hx('#e8f0f8')); rect(L, 230, 121, 260, 6, hx('#f4f0e8')); rect(L, 234, 121, 90, 6, hx('#ffffff')); rect(L, 235, 122, 88, 4, T('lintelA')); rect(L, 396, 121, 90, 6, hx('#ffffff')); rect(L, 397, 122, 88, 4, T('lintelB'));   // the tube; the lintel as two framed coral boxes
    for (let x = 236; x < 322; x += 9) rect(L, x, 122, 5, 4, hx('#fff0e0')); for (let x = 400; x < 486; x += 9) rect(L, x, 122, 5, 4, hx('#fff0e0')); for (let x = 332; x < 390; x += 7) rect(L, x, 123, 4, 2, hx('#d84a3a'));   // its text
    for (let x = 236; x < 488; x += 18) { rect(L, x, 120, 4, 1, hx('#fff8e8')); if (!TH.day) glow(L, x + 2, 123, 8, 6, '#ffe8b0', 50, 1.5); }   // downlights
    rect(L, 230, 127, 260, B - 127, T('storeEdge'));
    for (let y = 129; y < B - 1; y++) for (let x = 232; x < 488; x++) L.set(x, y, dith(x, y, (y - 127) / 84) ? T('konbiniGlass') : T('konbiniGlassTop'));   // the glass (2.6 m), warm light
    for (const tx of [244, 300, 396, 444]) rect(L, tx, 131, 36, 2, hx('#fffaf0')); rect(L, 359, 131, 1, 7, hx('#3a3a5a')); rect(L, 356, 138, 7, 3, hx('#fff0d0'));   // tube lamps, a pendant
    for (const y of [152, 174, 196]) { rect(L, 234, y, 252, 1, T('shelf')); rect(L, 234, y + 1, 252, 1, hx(mixc(TH.konbiniGlass, '#000000', 0.22))); for (let x = 235; x < 485; x += 4) rect(L, x, y - 10, 3, 10, [hx('#ff9ad0'), hx('#8ae0c0'), hx('#8ad0ff'), hx('#c8a8ff'), hx('#fff0d0'), hx('#ff8a7a'), hx('#f4f4f8')][(x * 7 + y) % 7]); }   // packed shelves
    rect(L, 340, 129, 40, B - 131, hx('#d8c8a8')); for (let y = 133; y < B - 2; y += 5) rect(L, 340, y, 40, 1, hx('#c8b898')); for (let x = 346; x < 380; x += 7) rect(L, x, 131, 1, B - 133, hx('#c8b898'));   // the open door (1.3 m): the tiled floor
    rect(L, 338, 129, 2, B - 131, hx('#2a2a3a')); rect(L, 380, 129, 2, B - 131, hx('#2a2a3a')); rect(L, 338, 129, 44, 1, hx('#2a2a3a')); rect(L, 340, 130, 40, 1, hx(mixc('#d8c8a8', '#000000', 0.3))); rect(L, 340, 130, 1, B - 132, hx(mixc('#d8c8a8', '#000000', 0.3)));   // the door frame and its recess
    for (const mx of [300, 420, 456]) rect(L, mx, 129, 2, B - 131, hx('#2a2a3a'));   // the glass mullions
    rect(L, 343, 156, 10, 48, hx('#3a3a5a')); for (let y = 159; y < 200; y += 6) rect(L, 344, y, 8, 3, [hx('#ff8ad0'), hx('#ffffff'), hx('#5ad0ff'), hx('#ffd24a')][(y / 6 | 0) & 3]);   // the magazine rack
    rect(L, 364, 176, 12, 22, hx('#f4f0e8')); for (let y = 180; y < 195; y += 4) rect(L, 366, y, 8, 1, hx('#8a8aa0')); rect(L, 362, 198, 16, 2, hx('#3a3a5a'));   // the A-frame board
    rect(L, 384, 138, 10, 12, hx('#f0e8e0')); rect(L, 385, 139, 8, 2, hx('#d84a3a')); rect(L, 385, 143, 8, 4, hx('#3a7ae0'));   // a poster
    rect(L, 230, B - 4, 260, 4, hx('#c8b898')); rect(L, 336, B - 6, 48, 6, hx('#d8c8a8'));   // the entrance step
    const vm = (x, col, col2) => { rect(L, x, 151, 26, 57, col); rect(L, x, 151, 26, 1, hx('#ffffff')); rect(L, x + 2, 154, 22, 24, hx('#dce8f8')); for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) rect(L, x + 3 + i * 4, 156 + r * 8, 3, 6, [hx('#ff8a7a'), hx('#8ad0ff'), hx('#ffd0a0'), hx('#8ae0c0')][(i + r) & 3]); rect(L, x + 2, 180, 22, 24, col2); rect(L, x + 5, 183, 16, 3, hx('#1a1a2a')); rect(L, x + 5, 194, 16, 7, hx('#1a1a2a')); rect(L, x, 204, 26, 4, hx('#1a1a2a')); if (!TH.day) glow(L, x + 13, 166, 20, 16, '#e8f4ff', 40, 1.4); };   // a vending machine (183 × 80 cm)
    vm(240, hx('#2a8a4a'), hx('#1e6a38')); rect(L, 244, 184, 8, 8, hx('#ff9ad0')); vm(272, hx('#dce4ec'), hx('#3a7ae0'));
    rect(L, 263, 152, 3, 56, hx(mixc('#2a8a4a', '#000000', 0.45))); rect(L, 295, 152, 3, 56, hx(mixc('#dce4ec', '#000000', 0.4))); rect(L, 479, 157, 3, 51, hx(mixc('#dce4ec', '#000000', 0.4)));   // the machines' dark side faces
    rect(L, 456, 156, 26, 52, hx('#dce4ec')); rect(L, 456, 156, 26, 3, hx('#3a7ae0')); rect(L, 460, 164, 18, 14, hx('#c8e8ff')); rect(L, 460, 184, 18, 8, hx('#8a90a0')); rect(L, 456, 204, 26, 4, hx('#1a1a2a'));   // the ATM
    rect(L, 497, 120, 3, B - 120, T('poleDark')); ellipse(L, 498, 114, 8, 8, hx('#2a5ad0')); ellipse(L, 498, 114, 6, 6, hx('#e8f0ff')); rect(L, 493, 113, 11, 3, hx('#2a5ad0'));   // the blue road sign on its pole
    // ---- the right: the dark neighbour house (two storeys, tiled roof), one warm window, a mint board, bushes
    wall(506, MID_W, 22, 'apt', 'aptEdge'); roof(506, MID_W, 14, 8);
    win(532, 46, 20, 26, false); win(584, 46, 20, 26, false); win(532, 102, 20, 26, true); win(584, 102, 20, 26, false); win(636, 102, 20, 26, false);
    rect(L, 512, 130, 40, 16, hx('#8ad0b8')); rect(L, 513, 131, 38, 14, hx('#a8e0c8')); rect(L, 516, 134, 32, 8, hx('#8ad0b8')); for (let x = 519; x < 545; x += 6) rect(L, x, 136, 3, 4, hx('#fff8f0'));   // the mint board
    rect(L, 508, 22, 1, B - 22, hx('#5a5a7a')); acunit(600, 150);
    bushes(510, 650, 6);
    rect(L, 570, 160, 30, B - 160, T('door')); rect(L, 573, 163, 24, 30, T('doorLit')); rect(L, 584, 163, 2, 30, T('door'));   // its door
    if (!TH.day) { for (let y = 190; y < B; y++) for (let x = 230; x < 490; x++) mixPx(L, x, y, hx(TH.konbiniGlow), 22); for (let y = 130; y < B - 4; y++) for (let x = 497; x < 501; x++) mixPx(L, x, y, hx(TH.konbiniGlow), 50); }   // the store's light on its step and the sign pole
    windowSpans();
    return L;
  }
  function paintNearKonbini() {
    const L = layer(W, H);
    // ---- the pavement from the store's line (y 208) to the bottom: slabs growing toward the camera, lighter joints, three tones
    for (let y = 208; y < H; y++) for (let x = 0; x < W; x++) { const band = y < 232 ? 6 : 8, base = y < 232 ? 208 : 232, row = Math.floor((y - base) / band) + (y < 232 ? 0 : 4), xx = x + (row & 1) * 13, col = Math.floor(xx / 26), joint = xx % 26 === 0 || (y - base) % band === 0, v = HS(col, row, 77); const bevel = (y - base) % band === 1 && xx % 26 !== 0; L.set(x, y, joint ? T('joint') : bevel ? hx(mixc(TH.sidewalk, '#ffffff', 0.12)) : v < 0.3 ? T('sidewalk2') : v < 0.85 ? T('sidewalk') : hx(mixc(TH.sidewalk, TH.joint, 0.4))); }
    rect(L, 0, 208, W, 1, T('top'));
    if (!TH.day) { for (let y = 208; y < 256; y++) for (let x = 170; x < 560; x++) { const fy = 1 - (y - 208) / 48, fx = 1 - 0.7 * Math.abs(x - 365) / 195, t = fy * fy * Math.max(0, fx); if (t > 0) mixPx(L, x, y, hx('#c8907a'), Math.round(120 * t)); }   // the pin's warm peach-brown pavement, fading away from the store
      for (let y = 208; y < 250; y++) for (let x = 300; x < 520; x++) { const t = 1 - Math.hypot((x - 408) / 110, (y - 208) / 34); if (t > 0) mixPx(L, x, y, hx(TH.konbiniGlow), Math.round(50 * t)); } for (let y = 208; y < 236; y++) for (let x = 130; x < 260; x++) { const t = 1 - Math.hypot((x - 195) / 70, (y - 208) / 24); if (t > 0) mixPx(L, x, y, hx('#c8e8ff'), Math.round(30 * t)); } }   // the store's light and the vending machines' glow on the pavement
    for (let y = 252; y < H; y++) for (let x = 0; x < W; x++) if (dith(x, y, (y - 252) / 30)) mixPx(L, x, y, hx('#000000'), 60);
    rect(L, 300, 226, 12, 4, hx('#1a1a2a')); for (let i = 0; i < 12; i += 2) rect(L, 301 + i, 227, 1, 2, hx('#4a4a6a'));   // a drain grate
    // ---- the great tree on the pavement: shadow, trunk 0.5 m with bark, the crown filling the top-left, branches over the store
    ellipse(L, 222, 236, 26, 4, hx('#0c0a1a'));
    sakuraOn(L, 220, 24, 300, 150, 37, { big: true, trunkW: 30, bottom: 237, light: 1, puff: 2.2, lace: true, grain: true, skeleton: [[222, 124, 470, 30, 14], [330, 86, 300, 8, 8], [400, 60, 520, 96, 7], [218, 128, 110, 20, 11], [160, 74, 60, 40, 6], [222, 116, 236, -10, 9], [228, 60, 300, 24, 6]] });   // the pin's tree: the trunk forks into three thick limbs, the long one over the store
    for (let i = 0; i < 5; i++) rect(L, 220 - 22 + i, 233 + i, 44 - 2 * i, 1, T('bark2'));   // the root flare
    // ---- the utility pole in front of it: the crossarm at the top, wires sagging across the sky, the transformer, signs, the drop cable
    { const PL = [hx(mixc(TH.poleDark, '#000000', 0.4)), hx(mixc(TH.poleLight, '#ffffff', 0.35)), T('poleLight'), T('poleLight'), T('poleLight'), T('pole'), T('pole'), T('pole'), T('pole'), T('poleDark'), T('poleDark'), T('poleDark'), hx(mixc(TH.poleDark, '#000000', 0.3)), hx(mixc(TH.poleDark, '#000000', 0.55))];   // a cylinder: edge, bright rim, light, mid, dark, edge
      for (let y = 0; y < 238; y++) for (let x = 196; x < 210; x++) L.set(x, y, PL[x - 196]);
      for (let y = 22; y < 238; y += 30) { rect(L, 196, y, 14, 1, PL[13]); rect(L, 197, y + 1, 12, 1, PL[1]); }   // the concrete rings
      for (let y = 160; y < 238; y++) for (let x = 196; x < 210; x++) mixPx(L, x, y, hx('#000000'), Math.round((y - 160) * 0.5));   // darker toward the ground
      rect(L, 192, 226, 22, 12, T('poleDark')); rect(L, 192, 226, 22, 1, PL[1]); rect(L, 192, 226, 1, 12, PL[2]); rect(L, 213, 226, 1, 12, PL[13]); }   // the concrete footing
    // the pole over the trunk's left edge, as in the pin
    rect(L, 170, 4, 66, 3, T('poleDark')); rect(L, 170, 4, 66, 1, T('poleLight')); for (const ix of [174, 188, 218, 232]) { rect(L, ix, 0, 3, 4, T('insulator')); }
    rect(L, 182, 30, 14, 22, T('aptDark')); rect(L, 182, 30, 14, 2, T('pole')); rect(L, 184, 34, 10, 14, T('storeWall')); rect(L, 182, 52, 14, 2, T('poleDark'));   // the transformer
    const wire = (x0, y0, x1, y1, sag) => { for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0), y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t); L.set(x, Math.round(y), T('wire')); } };
    wire(234, 2, W, 14, 10); wire(234, 6, W, 22, 12); wire(220, 12, W, 30, 9); wire(0, 8, 172, 4, 3); wire(0, 14, 172, 8, 3); line(L, 190, 7, 189, 30, T('wire'));
    ellipse(L, 203, 120, 6, 6, hx('#2a5ad0')); ellipse(L, 203, 120, 4, 4, hx('#e8f0ff')); rect(L, 200, 119, 6, 2, hx('#2a5ad0')); rect(L, 198, 150, 10, 14, hx('#e8e8f0')); rect(L, 200, 153, 6, 1, hx('#d84a3a')); rect(L, 200, 156, 6, 1, hx('#2a2a4a')); rect(L, 200, 159, 6, 1, hx('#2a2a4a'));   // a round sign, a notice
    for (const [gx, gy] of [[190, 236], [194, 238], [212, 237], [238, 235], [246, 238], [80, 250], [420, 246], [640, 258]]) { rect(L, gx, gy, 2, 2, hx('#3a7a4a')); L.set(gx + 1, gy - 1, hx('#5aa060')); L.set(gx, gy + 1, hx('#2a5a38')); }   // grass tufts
    const PET = TH.petals.map(hx);   // fallen petals: thickest under the tree and at the store's door
    for (let y = 209; y < H; y++) for (let x = 0; x < W; x++) {
      const dens = (y < 232 ? 0.022 : y < 250 ? 0.014 : 0.009) + 0.06 * Math.max(0, 1 - Math.abs(x - 220) / 170) + 0.04 * Math.max(0, 1 - Math.abs(x - 408) / 120); if (HS(x, y, 61) >= dens) continue;
      const c = PET[Math.floor(HS(x, y, 62) * 4)], e = PET[3], hi = hx('#fff0f4'), tilt = HS(x, y, 65) < 0.5;
      if (y < 232) { L.set(x, y, c); if (HS(x, y, 63) < 0.4) L.set(x + 1, y, c); }   // far: specks
      else if (y < 250) { rect(L, x, y, 3, 1, c); rect(L, x + (tilt ? 1 : 0), y + 1, 2, 1, e); }   // mid: 3×2 ovals
      else { rect(L, x, y, 4, 2, c); rect(L, x + (tilt ? 1 : 2), y + 2, 2, 1, e); L.set(x + 1 + (tilt ? 1 : 0), y, hi); if (HS(x, y, 66) < 0.3) { rect(L, x - 1, y + 1, 1, 1, e); rect(L, x + 4, y, 1, 1, c); } }   // near: 4×2 / 5×3 ovals with a lit centre
    }
    SAKURA = sakuraOn;
    return L;
  }
  function farRoofs(L) {   // the konbini stage's far layer: dark house roofs and a few warm windows behind the store, distant wires
    const body = T('farBody'), edge = T('farEdge');
    for (let k = 0; k < 14; k++) { const x0 = Math.floor(HS(k, 7, 3) * FAR_W), w = 40 + Math.floor(HS(k, 8, 3) * 60), top = 50 + Math.floor(HS(k, 9, 3) * 40); for (let y = top; y < GROUND; y++) for (let x = x0; x < x0 + w; x++) L.set(x, y, x === x0 || y === top ? edge : body); for (let i = 0; i < 4; i++) rect(L, x0 + 2 + i * 2, top - 2 - i * 2, w - 4 - i * 4, 2, edge); if (HS(k, 21, 4) > 0.6) rect(L, x0 + 8 + Math.floor(HS(k, 22, 4) * (w - 20)), top + 12, 5, 6, hx(mixc(TH.farWin[0], '#000000', 0.35))); }
    for (const [y0, y1, sag] of [[6, 9, 3], [10, 12, 4], [15, 16, 3]]) for (let x = 0; x < FAR_W; x++) { const t = x / FAR_W; L.set(x, Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)), T('wire')); }
    rect(L, 470, 6, 2, 60, hx('#0a0c1e')); rect(L, 463, 12, 16, 1, hx('#0a0c1e'));
  }
  const PROPS_KONBINI = [
    { id: 'vend', kind: 'vend', hp: 4, hit: [560, 145, 44, 95], box: [544, 125, 120, 145] },
    { id: 'bike', kind: 'bike', hp: 2, hit: [620, 188, 91, 52], box: [610, 180, 112, 60] },
    { id: 'lampL', kind: 'lamp', hp: 2, hit: [80, 88, 16, 16], box: [48, 52, 80, 218] },
    { id: 'sign', kind: 'sign', hp: 2, hit: [430, 193, 29, 47], box: [424, 193, 62, 47] },
    { id: 'bin', kind: 'bin', hp: 2, hit: [480, 193, 23, 47], box: [474, 190, 70, 50] },
    { id: 'cone1', kind: 'cone', hp: 1, hit: [676, 204, 20, 36], box: [660, 204, 40, 36] },
    { id: 'cone2', kind: 'cone', hp: 1, hit: [698, 204, 20, 36], box: [682, 204, 40, 36] },
  ];
  function paintMid() {   // the block across the road at 18 px/m
    if (TH.layout === 'konbini') return paintMidKonbini();   // otherwise the boulevard block: a storey 54 px, a window 18×22, a door 18×36; bases at y 188 (MID_BASE)
    const L = layer(MID_W, H); MASKL = L; TREES = layer(MID_W, H); WINDOWS.length = 0;
    const B = MID_BASE;
    const win = (x, y, w, h, lit) => { rect(L, x - 1, y - 1, w + 2, h + 2, T('aptFrame')); rect(L, x, y, w, h, lit ? hx(TH.aptLit[0]) : T('aptWin')); if (lit) rect(L, x, y + (h >> 1), w, h - (h >> 1), hx(TH.aptLit[1])); else rect(L, x + 2, y + 2, 3, 1, T('aptFrame')); rect(L, x + (w >> 1), y, 1, h, T('aptFrame')); rect(L, x - 1, y + h + 1, w + 2, 1, T('aptDark')); WINDOWS.push([x, y, w, h]); };
    // the viaduct behind everything (another 10 m back): ties and rails, the tiled parapet, the girders with X bracing
    // and lights beneath, the K-1 plate; its pillars stand in the gaps between the buildings, lit pink
    for (let x = 0; x < MID_W; x += 6) rect(L, x, 52, 2, 2, T('pole')); rect(L, 0, 54, MID_W, 2, T('pole')); rect(L, 0, 56, MID_W, 2, T('gateLight'));
    rect(L, 0, 58, MID_W, 12, T('deckFace')); for (let y = 61; y < 70; y += 4) rect(L, 0, y, MID_W, 1, T('deckTile')); for (let x = 0; x < MID_W; x += 12) rect(L, x, 58, 1, 12, T('deckTile'));   // the tiled parapet
    rect(L, 0, 70, MID_W, 9, T('gate')); rect(L, 0, 79, MID_W, 3, T('gateDark')); rect(L, 0, 82, MID_W, 1, T('midEdge'));
    for (let x = 0; x < MID_W; x += 26) { line(L, x, 71, x + 24, 78, T('gateDark')); line(L, x + 24, 71, x, 78, T('gateDark')); }
    for (let x = 12; x < MID_W; x += 30) rect(L, x, 80, 3, 2, T('midWin'));
    rect(L, 330, 60, 22, 11, T('plate')); for (const [x, w] of [[333, 3], [338, 1], [341, 7]]) rect(L, x, 63, w, 5, T('plateInk'));   // K-1
    for (const x of [123, 253, 397, 477, 577]) { rect(L, x, 83, 16, B - 6 - 83, T('pillarLit')); rect(L, x, 83, 2, B - 6 - 83, hx('#d898e0')); rect(L, x + 14, 83, 2, B - 6 - 83, T('pillarLit2')); rect(L, x, B - 14, 16, 8, T('gateDark')); if (!TH.day) glow(L, x + 8, 134, 16, 50, TH.pillarLit, 34, 1.5); }
    rect(L, 0, B - 6, MID_W, 6, T('sidewalk2')); rect(L, 0, B - 6, MID_W, 1, T('top')); rect(L, 0, B - 1, MID_W, 1, T('kerb'));
    const wall = (x0, x1, top, key, edgeKey) => { rect(L, x0, top, x1 - x0, B - top, T(key)); rect(L, x0, top, x1 - x0, 2, T(edgeKey)); rect(L, x0, top, 1, B - top, T(edgeKey)); rect(L, x1 - 1, top, 1, B - top, T('aptDark')); const sp = hx(mixc(TH[key], TH[edgeKey], 0.5)); for (let y = top + 2; y < B; y++) for (let x = x0 + 1; x < x1 - 1; x++) if (HS(x, y, 45) < 0.025) L.set(x, y, sp); };
    const shopfront = (x0, x1, y0, glassKey, awn) => {   // a lit ground-floor shop: glass down to the sidewalk, shelves of goods, a 1 m door, an awning above
      rect(L, x0 + 2, y0, x1 - x0 - 4, B - y0, T('storeEdge'));
      for (let y = y0 + 2; y < B - 1; y++) for (let x = x0 + 4; x < x1 - 4; x++) L.set(x, y, dith(x, y, (y - y0) / (B - y0)) ? T(glassKey) : T('storeGlassTop'));
      for (let y = y0 + 12; y < B - 4; y += 11) { rect(L, x0 + 5, y, x1 - x0 - 10, 1, T('shelf')); for (let x = x0 + 6; x < x1 - 6; x += 5) rect(L, x, y - 5, 4, 5, [hx('#e84a5f'), hx('#5ad0ff'), hx('#7ae06a'), hx('#ffd24a'), hx('#ff8a3a'), hx('#c9cce6')][(x + y) % 6]); }
      const dx = (x0 + x1) >> 1, dh = B - 2 - y0; rect(L, dx - 9, y0 + 2, 18, dh, hx(TH.day ? '#f6e4c2' : '#dcecff')); rect(L, dx - 9, y0 + 2, 1, dh, T('storeDoor')); rect(L, dx + 8, y0 + 2, 1, dh, T('storeDoor')); rect(L, dx - 1, y0 + 2, 1, dh, T('storeDoor')); rect(L, dx - 7, y0 + 20, 2, 3, T('storeDoor')); rect(L, dx + 4, y0 + 20, 2, 3, T('storeDoor'));
      if (awn) { for (let x = x0 + 1; x < x1 - 1; x++) for (let y = y0 - 8; y < y0; y++) L.set(x, y, ((x >> 2) & 1) ? T(awn[0]) : T(awn[1])); for (let x = x0 + 1; x < x1 - 1; x++) L.set(x, y0 + ((x & 3) < 2 ? 0 : 1), T('signInk')); }
    };
    const vsign = (x, y, h, col, inkCol) => { rect(L, x, y, 14, h, T('neonBox')); rect(L, x + 1, y + 1, 12, h - 2, hx(col)); for (let k = 0; k < Math.floor((h - 6) / 16); k++) { const yy = y + 5 + k * 16; rect(L, x + 4, yy, 6, 1, hx(inkCol)); rect(L, x + 6, yy + 1, 2, 8, hx(inkCol)); rect(L, x + 3, yy + 4, 8, 1, hx(inkCol)); rect(L, x + 4, yy + 9, 6, 1, hx(inkCol)); } if (!TH.day) glow(L, x + 7, y + h / 2, 28, h / 2 + 12, col, 50, 1.5); };
    const acunit = (x, y) => { rect(L, x, y, 14, 11, T('ac')); rect(L, x, y, 14, 1, T('pole')); for (const dy of [3, 6, 9]) rect(L, x + 1, y + dy, 12, 1, T('aptDark')); };   // an outdoor unit 80 × 60 cm
    const roofbits = (x0, x1, top, mast) => { for (let x = x0 + 2; x < x1 - 2; x += 4) rect(L, x, top - 12, 1, 12, T('balcony')); rect(L, x0 + 2, top - 12, x1 - x0 - 4, 1, T('balcony')); if (mast) { rect(L, x0 + 10, top - 30, 2, 18, T('pole')); rect(L, x0 + 6, top - 26, 10, 1, T('pole')); L.set(x0 + 10, top - 31, hx('#ff5a5a')); } };   // a rooftop rail (0.7 m), an antenna mast
    const bushes = (x0, x1) => { for (let x = x0; x < x1; x += 12) { const r = 5 + Math.floor(HS(x, 71, 5) * 4); ellipse(L, x + 6, B - 1, r + 1, r, T('bush')); ellipse(L, x + 5, B - 2, r - 1, r - 2, T('bush2')); } };   // 0.3–0.5 m
    const fence = (x0, x1) => { for (let x = x0; x < x1; x += 12) rect(L, x, B - 18, 2, 18, T('fence2')); rect(L, x0, B - 16, x1 - x0, 1, T('fence2')); rect(L, x0, B - 9, x1 - x0, 1, T('fence')); };   // a 1 m pipe fence
    const chain = (x0, x1, y0, y1) => { const c = T('chain'); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if ((x + y) % 4 === 0 || (x - y + 4000) % 4 === 0) L.set(x, y, c); for (let x = x0; x < x1; x += 20) rect(L, x, y0 - 2, 2, y1 - y0 + 2, T('fence2')); rect(L, x0, y0 - 2, x1 - x0, 1, T('fence2')); };   // chain-link (the pin's lattice)
    const lantern = (x, y) => { rect(L, x, y, 6, 9, hx('#ff5a4a')); rect(L, x + 1, y - 1, 4, 1, hx('#2a1a20')); rect(L, x + 1, y + 9, 4, 1, hx('#2a1a20')); rect(L, x + 2, y + 3, 2, 3, hx('#ffd0a0')); if (!TH.day) glow(L, x + 3, y + 4, 9, 9, '#ff7a5a', 40, 1.4); };   // a 30 × 50 cm paper lantern
    // A: the pharmacy — three storeys and a roof, the tall blue sign down its left edge, a wooden fascia, the red eave with
    // its lanterns over the lit shop
    wall(0, 126, 26, 'storeWall', 'storeEdge'); roofbits(0, 126, 26, true);
    for (const y of [36, 90]) for (let x = 24; x < 110; x += 32) win(x, y, 18, 22, HS(x, y, 41) < 0.5);
    acunit(100, 62);
    shopfront(0, 126, 152, 'storeGlass', null);
    rect(L, 16, 126, 110, 14, T('wood')); for (let y = 129; y < 140; y += 4) rect(L, 16, y, 110, 1, T('wood2')); for (let x = 30; x < 126; x += 22) rect(L, x, 126, 1, 14, T('wood2'));   // the wooden fascia
    rect(L, 14, 140, 112, 7, T('emblem')); rect(L, 14, 140, 112, 1, hx(mixc(TH.emblem, '#ffffff', 0.3))); rect(L, 14, 146, 112, 1, hx(mixc(TH.emblem, '#000000', 0.3)));   // the red eave
    for (let x = 20; x < 122; x += 17) lantern(x, 148);
    vsign(2, 40, 90, TH.neon, TH.neonText);
    rect(L, 54, 114, 12, 11, hx('#2a5a3a')); rect(L, 58, 116, 4, 7, hx('#5af0a0')); rect(L, 56, 118, 8, 3, hx('#5af0a0')); if (!TH.day) glow(L, 60, 119, 12, 10, '#5af0a0', 40, 1.4);   // the pharmacy's green cross
    rect(L, 123, 28, 1, B - 28, hx('#5a5a7a')); rect(L, 113, 73, 1, 53, hx('#5a5a7a'));   // a downpipe, the AC's pipe
    // B: the school — the building (three storeys) behind a 1.8 m wall topped with chain-link, a 3 m gate between two
    // 2.2 m pillars with lamps, the great cherry tree in the yard (the wall and gate are drawn after it)
    rect(L, 136, 26, 120, B - 26, T('school')); rect(L, 136, 26, 120, 2, T('schoolTrim')); rect(L, 136, 26, 1, B - 26, T('schoolTrim'));
    for (const y of [40, 94, 148]) for (let x = 142; x < 250; x += 28) { const lit = HS(x, y, 23) < 0.2; rect(L, x, y, 22, 20, lit ? T('schoolLit') : T('schoolWin')); if (lit) rect(L, x, y + 10, 22, 10, T('schoolLit2')); rect(L, x + 10, y, 2, 20, T('schoolTrim')); rect(L, x, y + 20, 22, 1, T('schoolTrim')); }
    rect(L, 186, 6, 2, 20, T('pole')); rect(L, 188, 7, 8, 5, hx('#e8e8f0'));   // the flagpole on the roof
    sakuraOn(L, 196, 68, 84, 58, 13, { big: true, trunkW: 9, bottom: B - 4, light: -1 });   // crown 9 × 6 m, trunk 0.5 m
    for (const [x0, x1] of [[136, 166], [240, 256]]) { chain(x0, x1, 140, 156); for (let x = x0; x < x1; x++) for (let y = 156; y < B - 6; y++) L.set(x, y, y === 156 ? T('cap') : dith(x, y, 0.5) ? T('pillar') : T('pillarDark')); }
    for (const px0 of [166, 230]) { rect(L, px0, 146, 10, B - 6 - 146, T('pillar')); rect(L, px0, 146, 1, B - 6 - 146, T('pillarLight')); rect(L, px0 - 1, 145, 12, 2, T('cap')); rect(L, px0 + 3, 137, 4, 8, hx(TH.lampGlass)); if (!TH.day) glow(L, px0 + 5, 141, 9, 9, TH.lampGlass, 40, 1.4); }
    for (let x = 178; x < 230; x += 5) rect(L, x, 150, 2, B - 6 - 150, T('gateLight')); rect(L, 176, 149, 54, 1, T('gateLight')); rect(L, 176, 168, 54, 1, T('gateLight')); rect(L, 176, B - 7, 54, 1, T('gateDark'));   // the gate bars
    rect(L, 231, 152, 6, 20, T('plate'));   // the name plate
    bushes(138, 164); bushes(242, 254);
    // C: the konbini after the pin (a warm-lit store under the tree): the light-blue sign band with dark lettering, a row of
    // downlights, the orange / green lintel strips, packed shelves behind the glass, the open sliding door with the tiled
    // floor and the magazine rack, two vending machines and a freezer on the sidewalk in front, a poster, a bin, a drain, a sign
    wall(266, 400, 80, 'storeWall', 'storeEdge'); roofbits(266, 400, 80, false);
    for (let x = 276; x < 390; x += 30) win(x, 90, 18, 22, HS(x, 90, 41) < 0.5);
    rect(L, 267, 73, 1, B - 73, hx('#5a5a7a')); rect(L, 398, 73, 1, B - 73, hx('#5a5a7a'));   // downpipes
    rect(L, 266, 134, 134, 10, T('signBand')); rect(L, 266, 134, 134, 1, hx('#c8d8e8')); rect(L, 266, 143, 134, 1, T('signInk2'));   // the sign band (0.55 m, a quarter of the glass as measured)
    for (const [x, w] of [[298, 8], [309, 9], [321, 8], [332, 10], [345, 8], [356, 9]]) { rect(L, x, 136, w, 6, T('signInk2')); rect(L, x + 2, 137, w - 4, 1, T('signBand')); rect(L, x + 2, 140, w - 4, 1, T('signBand')); }   // the lettering
    if (!TH.day) glow(L, 333, 139, 70, 10, TH.signBand, 30, 1.4);
    rect(L, 266, 144, 134, 1, hx('#e8f0f8')); rect(L, 266, 145, 134, 3, hx('#f4f0e8')); rect(L, 266, 145, 46, 3, T('lintelA')); rect(L, 354, 145, 46, 3, T('lintelB'));   // the tube and the lintel strips
    for (let x = 270; x < 308; x += 6) rect(L, x, 146, 3, 1, hx('#fff0e0')); for (let x = 358; x < 396; x += 6) rect(L, x, 146, 3, 1, hx('#fff0e0')); for (let x = 318; x < 350; x += 5) rect(L, x, 146, 2, 1, hx('#d84a3a'));   // their text
    for (let x = 270; x < 398; x += 14) { rect(L, x, 144, 3, 1, hx('#fff8e8')); if (!TH.day) glow(L, x + 1, 147, 6, 5, '#ffe8b0', 50, 1.5); }   // downlights under the sign
    rect(L, 266, 148, 134, B - 148, T('storeEdge'));   // the glass front (2.2 m): warm light, the ceiling lamps, shelves packed with goods
    for (let y = 150; y < B - 1; y++) for (let x = 268; x < 398; x++) L.set(x, y, dith(x, y, (y - 148) / 42) ? T('konbiniGlass') : T('konbiniGlassTop'));
    rect(L, 276, 151, 26, 2, hx('#fffaf0')); rect(L, 350, 151, 26, 2, hx('#fffaf0')); rect(L, 337, 151, 1, 4, hx('#3a3a5a')); rect(L, 335, 155, 5, 3, hx('#fff0d0'));   // two tube lamps and a pendant
    for (const y of [164, 175, 186]) { rect(L, 270, y, 128, 1, T('shelf')); for (let x = 271; x < 397; x += 3) rect(L, x, y - 6, 2, 6, [hx('#ff9ad0'), hx('#8ae0c0'), hx('#8ad0ff'), hx('#c8a8ff'), hx('#fff0d0'), hx('#ff8a7a'), hx('#f4f4f8')][(x * 7 + y) % 7]); }
    rect(L, 324, 150, 20, B - 152, hx('#d8c8a8')); for (let y = 152; y < B - 2; y += 4) rect(L, 324, y, 20, 1, hx('#c8b898')); for (let x = 328; x < 344; x += 5) rect(L, x, 152, 1, B - 154, hx('#c8b898'));   // the open door (2.2 m): the tiled floor
    rect(L, 323, 150, 1, B - 152, T('storeDoor')); rect(L, 344, 150, 1, B - 152, T('storeDoor')); rect(L, 323, 150, 22, 1, T('storeDoor'));
    rect(L, 326, 160, 6, 26, hx('#3a3a5a')); for (let y = 162; y < 184; y += 4) rect(L, 327, y, 4, 2, [hx('#ff8ad0'), hx('#ffffff'), hx('#5ad0ff'), hx('#ffd24a')][(y >> 2) & 3]);   // the magazine rack
    rect(L, 336, 160, 6, 6, hx('#f0e8e0')); rect(L, 337, 161, 4, 1, hx('#d84a3a')); rect(L, 337, 163, 4, 2, hx('#3a7ae0'));   // a poster on the door
    rect(L, 337, 174, 7, 12, hx('#f4f0e8')); for (let y = 176; y < 184; y += 3) rect(L, 338, y, 5, 1, hx('#8a8aa0')); rect(L, 336, 186, 9, 1, hx('#3a3a5a'));   // the A-frame board in the doorway
    const vm = (x, col, col2) => { rect(L, x, 155, 14, 33, col); rect(L, x, 155, 14, 1, hx('#ffffff')); rect(L, x + 1, 157, 12, 12, hx('#dce8f8')); for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) rect(L, x + 2 + i * 3, 158 + r * 6, 2, 4, [hx('#ff8a7a'), hx('#8ad0ff'), hx('#ffd0a0'), hx('#8ae0c0')][(i + r) & 3]); rect(L, x + 1, 171, 12, 15, col2); rect(L, x + 3, 173, 8, 2, hx('#1a1a2a')); rect(L, x + 3, 180, 8, 4, hx('#1a1a2a')); rect(L, x, 186, 14, 2, hx('#1a1a2a')); if (!TH.day) glow(L, x + 7, 163, 12, 10, '#e8f4ff', 40, 1.4); };   // a vending machine (183 × 78 cm)
    vm(272, hx('#2a8a4a'), hx('#1e6a38')); rect(L, 274, 174, 4, 5, hx('#ff9ad0')); vm(288, hx('#dce4ec'), hx('#3a7ae0'));
    rect(L, 372, 172, 18, 16, hx('#dce4f0')); rect(L, 372, 172, 18, 2, hx('#3a7ae0')); rect(L, 374, 176, 14, 8, hx('#c8e8ff')); rect(L, 372, 186, 18, 2, hx('#1a1a2a'));   // the ice-cream freezer
    rect(L, 268, 186, 130, 2, hx('#c8b898')); rect(L, 320, 185, 28, 3, hx('#d8c8a8'));   // the entrance step
    if (!TH.day) for (let y = B - 6; y < B; y++) for (let x = 300; x < 372; x++) mixPx(L, x, y, hx('#ffd8a0'), Math.round(90 * (1 - Math.abs(x - 336) / 36) * (B - y) / 6));   // the store's light on the pavement
    rect(L, 394, 150, 2, 38, T('poleDark')); ellipse(L, 395, 146, 5, 5, hx('#2a5ad0')); rect(L, 392, 145, 7, 2, hx('#ffffff'));   // the parking sign
    rect(L, 350, 182, 8, 3, hx('#2a2a3a')); rect(L, 351, 183, 6, 1, hx('#5a5a7a'));   // the drain grate by the step
    rect(L, 362, 179, 7, 9, hx('#2a3a6a')); rect(L, 362, 179, 7, 2, hx('#4a5a9a'));   // a bin by the door
    // D: narrow and tall — the pink vertical neon down its right edge, the red NO.1 sign, the lantern shop below
    wall(410, 480, 26, 'apt', 'aptEdge'); roofbits(410, 480, 26, false);
    for (const y of [36, 90]) for (let x = 418; x < 456; x += 24) win(x, y, 18, 22, HS(x, y, 43) < 0.5);
    acunit(420, 118);
    rect(L, 412, 130, 50, 14, T('redSign')); rect(L, 413, 131, 48, 12, T('redSign2')); for (const [x, w] of [[417, 3], [423, 3], [429, 2], [435, 5], [443, 3], [450, 2]]) rect(L, x, 134, w, 7, hx('#fff0f0')); rect(L, 435, 134, 5, 1, hx('#fff0f0')); if (!TH.day) glow(L, 437, 137, 32, 12, TH.redSign2, 40, 1.4);
    rect(L, 410, 146, 70, B - 146, T('storeEdge')); for (let y = 148; y < B - 1; y++) for (let x = 412; x < 478; x++) L.set(x, y, dith(x, y, 0.5) ? hx('#ffb070') : hx('#ffd0a0'));
    rect(L, 436, 152, 18, B - 152, hx('#5a2a30')); rect(L, 438, 154, 14, 20, hx('#c04a3a')); rect(L, 438, 154, 14, 1, hx('#2a1a20')); rect(L, 444, 154, 2, 20, hx('#5a2a30'));   // the doorway with its noren
    for (let x = 414; x < 478; x += 16) lantern(x, 150);
    vsign(464, 40, 72, TH.neon2, '#fff0f8');
    for (let i = 0; i < 40; i += 3) rect(L, 416 + i, 102, 1, 11, T('balcony')); rect(L, 416, 102, 40, 1, T('balcony')); rect(L, 416, 113, 40, 3, T('balcony')); rect(L, 411, 28, 1, B - 28, hx('#5a5a7a'));   // a balcony rail on the second storey, a downpipe
    bushes(412, 434); bushes(456, 478);
    // E: the apartment (two storeys, balconies) — a lit shop window on the ground floor, the entrance door, a fence and bushes
    wall(490, 580, 80, 'apt', 'aptEdge'); roofbits(490, 580, 80, false);
    for (let x = 496; x < 570; x += 28) { win(x, 90, 18, 22, HS(x, 90, 47) < 0.45); for (let i = 0; i < 24; i += 3) rect(L, x - 3 + i, 100, 1, 13, T('balcony')); rect(L, x - 3, 100, 24, 1, T('balcony')); rect(L, x - 3, 113, 24, 3, T('balcony')); }
    rect(L, 494, 146, 48, B - 146, T('aptFrame')); rect(L, 496, 148, 44, B - 149, T('storeGlass')); rect(L, 496, 148, 44, 10, T('storeGlassTop')); for (const y of [164, 178]) { rect(L, 498, y, 40, 1, T('shelf')); for (let x = 499; x < 537; x += 5) rect(L, x, y - 5, 4, 5, [hx('#5ad0ff'), hx('#ff8ad0'), hx('#ffd24a'), hx('#7ae06a')][(x >> 2) % 4]); } if (!TH.day) glow(L, 518, 168, 30, 24, TH.storeGlow, 30, 1.4);
    rect(L, 554, 150, 20, B - 150, T('door')); rect(L, 556, 152, 16, 20, T('doorLit')); rect(L, 563, 152, 2, 20, T('door')); rect(L, 557, 176, 3, 2, hx('#e8e8f0'));
    fence(492, 552); bushes(494, 550);
    rect(L, 500, 101, 3, 6, hx('#f4f4f8')); rect(L, 505, 101, 3, 6, hx('#7ab0ff')); rect(L, 510, 101, 4, 5, hx('#ffd0a0')); rect(L, 560, 108, 5, 4, hx('#2e5a4a')); rect(L, 561, 106, 3, 2, hx('#3a8a5a')); rect(L, 556, 158, 3, 2, hx('#ffe8a0')); rect(L, 579, 82, 1, B - 82, hx('#5a5a7a'));   // laundry, a plant, the doorbell, a downpipe
    // F: three storeys with the pink neon board on the roof; the picture's right-hand shop on the ground floor
    wall(590, MID_W, 26, 'storeWall', 'storeEdge'); roofbits(590, MID_W, 26, true);
    rect(L, 596, 0, 62, 26, T('neonBox')); rect(L, 598, 2, 58, 22, T('neon2')); for (let x = 604; x < 650; x += 12) rect(L, x, 7, 7, 12, hx('#fff0f8')); if (!TH.day) glow(L, 627, 13, 44, 20, TH.neon2, 46, 1.4);
    for (const y of [36, 90]) for (let x = 600; x < 640; x += 28) win(x, y, 18, 22, HS(x, y, 49) < 0.4);
    acunit(640, 62);
    rect(L, 592, 134, MID_W - 592, B - 134, T('teal')); rect(L, 592, 134, MID_W - 592, 2, T('teal2')); rect(L, 592, 134, 2, B - 134, T('teal2'));   // the dark teal shop
    rect(L, 608, 136, 40, 6, T('teal2')); for (let x = 611; x < 646; x += 6) rect(L, x, 137, 3, 4, hx('#5ad0a0'));   // its green-lit sign strip
    const arch = (x, y, w, h, c) => { rect(L, x, y + 4, w, h - 4, c); rect(L, x + 2, y + 2, w - 4, 2, c); rect(L, x + 4, y + 1, w - 8, 1, c); rect(L, x + 6, y, w - 12, 1, c); };
    arch(610, 144, 30, B - 144, T('teal2')); arch(612, 146, 26, B - 146, T('storeGlassTop'));   // the arched doorway (2.4 m), lit white-cyan
    for (const y of [158, 170, 182]) { rect(L, 614, y, 22, 2, hx('#3a80ff')); for (let x = 615; x < 635; x += 5) rect(L, x, y - 5, 4, 5, [hx('#5ad0ff'), hx('#ffffff'), hx('#ff8ad0')][(x >> 2) % 3]); }   // blue shelves
    rect(L, 626, 160, 7, 28, hx('#1a2030')); rect(L, 627, 156, 5, 5, hx('#e8c8b0'));   // someone in the doorway (1.6 m)
    vsign(594, 128, 48, TH.neon2, '#fff0f8');   // the pink vertical neon beside the door
    rect(L, 644, 140, 14, B - 140, T('deckTile')); rect(L, 646, 142, 10, B - 144, hx(mixc(TH.deckTile, '#ffffff', 0.15))); rect(L, 647, 152, 8, B - 152, T('pillarLit')); rect(L, 648, 154, 6, B - 156, hx('#ff8ad8'));   // the lavender panel with a pink door
    // the far-side cherry trees (crowns 6–7 m) in front of the shops, their tops reaching the viaduct
    sakuraOn(L, 60, 62, 66, 46, 21, { trunkW: 7, bottom: B - 4, sparse: true }); sakuraOn(L, 520, 62, 60, 44, 17, { trunkW: 7, bottom: B - 4, light: -1, sparse: true }); sakuraOn(L, 650, 60, 56, 42, 19, { trunkW: 7, bottom: B - 4, sparse: true }); sakuraOn(L, 262, 60, 66, 56, 27, { trunkW: 8, bottom: B - 4, sparse: true, light: -1 });
    if (!TH.day) { for (let y = 116; y < B - 4; y++) for (let x = 262; x < 268; x++) mixPx(L, x, y, hx(TH.konbiniGlow), 70); for (let y = 146; y < B - 6; y++) for (let x = 236; x < 240; x++) mixPx(L, x, y, hx(TH.konbiniGlow), 40); for (let y = 176; y < B; y++) for (let x = 268; x < 400; x++) mixPx(L, x, y, hx(TH.konbiniGlow), 26); }   // the store's light on the tree trunk, the gate pillar and the sidewalk beside it
    windowSpans();
    return L;
  }
  function paintNear() {
    if (TH.layout === 'konbini') return paintNearKonbini();
    const L = layer(W, H);
    // ---- the road between the block's kerb (y 188) and the near kerb (y 232): a centre line, the crossing, wet sheen
    const g = TH.road.map(hx), R0 = MID_BASE, R1 = 232;
    for (let y = R0; y < R1; y++) { const t = (y - R0) / (R1 - R0); for (let x = 0; x < W; x++) L.set(x, y, dith(x, y, t * 2.2 - Math.floor(t * 2.2)) ? g[Math.max(0, Math.min(4, 3 - Math.floor(t * 2.2)))] : g[Math.max(0, Math.min(4, 4 - Math.floor(t * 2.2)))]); }
    rect(L, 0, R0, W, 1, T('kerb'));
    for (let x = 0; x < W; x++) if (x % 20 < 12) { L.set(x, 209, T('roadLine')); L.set(x, 210, T('roadLine')); }
    for (let x = 300; x < 470; x += 22) for (let y = R0 + 3; y < R1 - 2; y++) for (let i = 0; i < 14; i++) { const e = (i === 0 || i === 13 || y === R0 + 3 || y === R1 - 3); if (!e || dith(x + i, y, 0.5)) mixPx(L, x + i, y, T('zebra'), 150); }
    for (let y = R0; y < R1; y++) for (let x = 0; x < W; x++) if (HS(x, y, 47) < 0.08 + (R1 - 1 - y) / 80) mixPx(L, x, y, T('sheen'), 18 + Math.round((R1 - 1 - y) * 0.9 * (TH.rain ? 1.6 : 1)));
    if (!TH.day) for (const [x0, x1, key, a] of [[4, 122, 'storeGlow', 40], [270, 396, 'konbiniGlow', 40], [414, 476, 'storeGlow', 30], [464, 478, 'neon2', 55], [610, 640, 'storeGlow', 30]]) streak(L, Math.round(x0 / 0.6 - 20), Math.round(x1 / 0.6 - 20), R0 + 1, R1, TH[key], a);
    if (!TH.day) for (let y = R0; y < R1; y++) for (let x = 320; x < 470; x++) { const t = 1 - Math.hypot((x - 395) / 78, (y - R0 - 4) / 16); if (t > 0) mixPx(L, x, y, hx(TH.konbiniGlow), Math.round(46 * t)); }   // the konbini's light washing the road in front of it
    // ---- the near sidewalk (tiles, the tactile strip) down to the bottom; the guardrail along its kerb (0.8 m = 42 px, open at the crossing)
    rect(L, 0, 230, W, 2, T('kerb2')); rect(L, 0, 232, W, 1, T('top'));
    for (let y = 233; y < H; y++) for (let x = 0; x < W; x++) { const row = Math.floor((y - 233) / 8), xx = x + (row & 1) * 13, col = Math.floor(xx / 26), joint = xx % 26 === 0 || (y - 233) % 8 === 0, v = HS(col, row, 77); L.set(x, y, joint ? T('joint') : v < 0.3 ? T('sidewalk2') : v < 0.85 ? T('sidewalk') : hx(mixc(TH.sidewalk, TH.joint, 0.4))); }   // 50 cm slabs
    for (let x = 0; x < W; x++) for (let y = 244; y < 248; y++) L.set(x, y, ((x % 4 === 1 || x % 4 === 2) && (y === 245 || y === 246)) ? T('tactile2') : T('tactile'));
    for (let y = 252; y < H; y++) for (let x = 0; x < W; x++) if (dith(x, y, (y - 252) / 30)) mixPx(L, x, y, hx('#000000'), 60);
    // ---- the near-side great tree (trunk 0.4 m, its crown mostly above the picture), the utility pole with its wires
    ellipse(L, 96, GROUND - 1, 18, 3, hx('#0c0a1a'));
    sakuraOn(L, 96, 24, 170, 96, 31, { big: true, trunkW: 18, bottom: GROUND, light: 1, puff: 2.4 });
    for (let i = 0; i < 4; i++) rect(L, 96 - 15 + i, GROUND - 4 + i, 30 - 2 * i, 1, T('bark2'));   // the root flare
    rect(L, 340, 252, 12, 4, hx('#1a1a2a')); for (let i = 0; i < 12; i += 2) rect(L, 341 + i, 253, 1, 2, hx('#4a4a6a'));   // a drain grate
    ellipse(L, 560, 220, 9, 3, hx('#1a1c30')); ellipse(L, 560, 220, 7, 2, hx('#2a2c48')); rect(L, 555, 220, 10, 1, hx('#3a3c58'));   // a manhole
    for (let y = 0; y < GROUND; y++) for (let x = 606; x < 620; x++) L.set(x, y, x < 608 ? T('poleLight') : x > 617 ? T('poleDark') : dith(x, y, 0.5 + HS(x, y, 33) * 0.2) ? T('pole') : T('poleLight'));
    for (let y = 0; y < GROUND; y += 30) rect(L, 606, y, 14, 1, T('poleDark'));
    rect(L, 579, 26, 66, 3, T('poleDark')); rect(L, 579, 26, 66, 1, T('poleLight')); for (const ix of [583, 597, 627, 641]) { rect(L, ix, 22, 3, 4, T('insulator')); rect(L, ix, 21, 3, 1, hx('#e8e8f0')); }
    rect(L, 620, 44, 14, 22, T('aptDark')); rect(L, 620, 44, 14, 2, T('pole')); rect(L, 622, 48, 10, 14, T('storeWall')); rect(L, 620, 66, 14, 2, T('poleDark'));
    ellipse(L, 613, 120, 6, 6, hx('#2a5ad0')); ellipse(L, 613, 120, 4, 4, hx('#e8f0ff')); rect(L, 610, 119, 6, 2, hx('#2a5ad0')); rect(L, 608, 150, 10, 14, hx('#e8e8f0')); rect(L, 610, 153, 6, 1, hx('#d84a3a')); rect(L, 610, 156, 6, 1, hx('#2a2a4a')); rect(L, 610, 159, 6, 1, hx('#2a2a4a')); line(L, 626, 29, 628, 44, T('wire'));   // a round sign and a notice on the pole, the drop cable
    for (const [gx, gy] of [[600, 238], [604, 240], [623, 239], [627, 237], [300, 258], [452, 262]]) { rect(L, gx, gy, 2, 2, hx('#3a7a4a')); L.set(gx + 1, gy - 1, hx('#5aa060')); L.set(gx, gy + 1, hx('#2a5a38')); }   // grass tufts
    const wire = (x0, y0, x1, y1, sag) => { for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0), y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t); L.set(x, Math.round(y), T('wire')); } };
    wire(0, 14, 584, 22, 9); wire(0, 22, 598, 22, 10); wire(628, 22, W, 10, 4); wire(642, 22, W, 18, 4); wire(0, 34, 606, 40, 7);
    // ---- the signal post at the crossing: the vehicle signal on its arm 4.2 m up, the pedestrian signal at 2.5 m
    rect(L, 300, 8, 3, 224, T('poleDark')); rect(L, 300, 8, 1, 224, T('poleLight')); rect(L, 302, 8, 44, 3, T('poleDark')); rect(L, 326, 11, 22, 12, T('aptDark')); rect(L, 327, 12, 20, 10, hx('#1a1a2a'));
    rect(L, 329, 14, 5, 6, hx('#ff3a3a')); rect(L, 335, 14, 5, 6, hx('#5a4a20')); rect(L, 341, 14, 5, 6, hx('#204020')); if (!TH.day) glow(L, 331, 17, 10, 8, '#ff3a3a', 60, 1.3);
    rect(L, 293, 96, 16, 14, T('aptDark')); rect(L, 294, 97, 14, 12, hx('#1a1a2a'));
    rect(L, 296, 99, 4, 4, TH.day ? hx('#5a2020') : hx('#ff3a3a')); rect(L, 302, 99, 4, 4, hx('#204020')); rect(L, 296, 104, 10, 3, hx('#2a2a3a')); if (!TH.day) glow(L, 298, 101, 10, 8, '#ff3a3a', 60, 1.3);
    rect(L, 468, 60, 4, 172, T('neonBox')); rect(L, 469, 61, 2, 170, T('neon2')); if (!TH.day) glow(L, 470, 146, 16, 90, TH.neon2, 40, 1.5);   // the magenta post (3.3 m)
    const PET = TH.petals.map(hx);   // fallen petals, thickest under the near tree
    for (let y = R0 + 1; y < H; y++) for (let x = 0; x < W; x++) { let dens = 0.012 + 0.09 * Math.max(0, 1 - Math.abs(x - 96) / 150); if (y < 232) dens *= 0.5; if (HS(x, y, 61) < dens) { const c = PET[Math.floor(HS(x, y, 62) * 4)]; L.set(x, y, c); if (HS(x, y, 63) < 0.4) L.set(x + 1, y, c); if (y >= 232 && HS(x, y, 64) < 0.12) { L.set(x, y + 1, c); L.set(x + 1, y + 1, c); L.set(x, y, hx('#fff0f8')); } } }
    SAKURA = sakuraOn;
    return L;
  }
  function paintRail() {   // the guardrail along the near kerb (0.8 m, open at the crossing) in its own layer: over the traffic, under the props and fighters
    const L = layer(W, H);
    if (TH.layout === 'konbini') return L;   // no road here
    const rail = (x0, x1) => {
      for (let x = x0; x < x1; x += 40) { rect(L, x, 190, 3, 42, T('poleLight')); rect(L, x, 190, 1, 42, hx('#ffffff')); rect(L, x - 1, 230, 5, 2, T('poleDark')); }
      rect(L, x0, 190, x1 - x0, 3, hx('#e8ecf4')); rect(L, x0, 193, x1 - x0, 1, T('poleDark')); rect(L, x0, 212, x1 - x0, 2, hx('#d8dce8')); rect(L, x0, 214, x1 - x0, 1, T('poleDark'));
      for (let x = x0 + 20; x < x1; x += 40) rect(L, x, 191, 2, 1, hx('#ff8a3a'));
    };
    rail(0, 292); rail(484, W);
    return L;
  }
  // ---------------------------------------------------------------- traffic: cars at the road's scale (~26 px/m in the far lane), painted once per kind / colour / direction
  const CAR_COLS = { sedan: ['#c8ccd8', '#1e2a4a', '#8a1a24', '#f0f0f4'], van: ['#f4f4f8', '#3a6ad0', '#d8d0b8'], taxi: ['#e8c020', '#2a8a50'] };
  const ANIM_IMGS = {};
  function carImage(kind, col, dir) {
    const key = 'car:' + kind + ':' + col + ':' + dir;
    if (ANIM_IMGS[key]) return ANIM_IMGS[key];
    const body = hx(col), dark = hx(mixc(col, '#000000', 0.35)), light = hx(mixc(col, '#ffffff', 0.35)), GLASS = hx('#1c2c4c'), GLASS2 = hx('#6a8ab0'), TYRE = hx('#101018'), RIM = hx('#8a90a0'), HUB = hx('#d0d4e0'), CHROME = hx('#b8bcc8'), EDGE = hx('#0a0c1e');
    const W0 = kind === 'van' ? 100 : 120, H0 = kind === 'van' ? 46 : 40, L = layer(W0, H0), G = H0;   // the tyres touch the layer's bottom
    ellipse(L, W0 / 2, G - 2, W0 / 2 - 2, 3, rgba('#000000', 110));   // the shadow on the road
    const wy = G - 9, wx = kind === 'van' ? [22, 78] : [28, 92];
    const bodyTop = kind === 'van' ? 14 : G - 24, cabTop = kind === 'van' ? 4 : G - 34;
    rect(L, 3, bodyTop + 2, W0 - 6, G - 9 - bodyTop, EDGE); rect(L, 4, bodyTop + 2, W0 - 8, G - 7 - bodyTop - 2, body); rect(L, 6, bodyTop, W0 - 12, 2, body); rect(L, 6, G - 10, W0 - 12, 3, dark);   // the body
    rect(L, 8, bodyTop + 1, W0 - 16, 1, light); rect(L, 6, bodyTop - 1, W0 - 12, 1, EDGE);
    rect(L, 1, G - 13, 5, 4, CHROME); rect(L, W0 - 6, G - 13, 5, 4, CHROME); rect(L, 1, G - 14, 5, 1, EDGE); rect(L, W0 - 6, G - 14, 5, 1, EDGE);   // bumpers
    for (const sx of (kind === 'van' ? [38, 66] : [46, 78])) { rect(L, sx, bodyTop + 3, 1, G - 12 - bodyTop, dark); rect(L, sx - 9, bodyTop + 8, 4, 1, light); }   // door seams, handles
    const cx0 = kind === 'van' ? 10 : 30, cx1 = kind === 'van' ? W0 - 8 : 94;   // the cabin: a trapezoid (the windscreen slopes), glass, pillars, a reflection
    for (let y = cabTop - 1; y < bodyTop + 1; y++) { const t = Math.max(0, (y - cabTop) / (bodyTop - cabTop)), sl = kind === 'van' ? 2 : 10, a = Math.round(cx0 + sl * (1 - t)), b = Math.round(cx1 - sl * 0.6 * (1 - t)); rect(L, a - 1, y, b - a + 2, 1, y <= cabTop ? EDGE : body); if (y > cabTop + 1 && y < bodyTop - 1) rect(L, a + 1, y, b - a - 2, 1, GLASS); }
    for (const px of (kind === 'van' ? [cx0 + 20, cx0 + 48] : [cx0 + 28])) rect(L, px, cabTop + 1, 2, bodyTop - cabTop - 2, body);   // pillars
    for (let i = 0; i < 7; i++) L.set(cx0 + 5 + i, cabTop + 3 + i, GLASS2); for (let i = 0; i < 4; i++) L.set(cx0 + 12 + i, cabTop + 3 + i, GLASS2);   // the reflection streak
    if (kind === 'taxi') { rect(L, W0 / 2 - 7, cabTop - 6, 14, 6, EDGE); rect(L, W0 / 2 - 6, cabTop - 5, 12, 4, hx('#ffe060')); rect(L, W0 / 2 - 6, cabTop - 5, 12, 1, hx('#fff6c0')); rect(L, W0 / 2 - 4, cabTop - 3, 8, 1, hx('#1a1a2a')); }   // the roof sign
    for (const x of wx) { ellipse(L, x, wy, 10, 10, dark); ellipse(L, x, wy, 8, 8, TYRE); ellipse(L, x, wy, 4, 4, RIM); rect(L, x - 1, wy - 1, 2, 2, HUB); }   // wheels in their arches
    rect(L, W0 - 6, G - 19, 4, 4, hx('#fff4d0')); rect(L, W0 - 5, G - 18, 2, 2, hx('#ffffff')); rect(L, 2, G - 19, 4, 4, hx('#ff3040')); rect(L, 3, G - 18, 2, 2, hx('#ff8090'));   // headlight (+x end) and taillight
    rect(L, 7, G - 12, 6, 3, hx('#e8e8f0')); rect(L, 8, G - 11, 4, 1, hx('#3a3a5a'));   // the plate
    const R = dir > 0 ? L : flipX(L); ANIM_IMGS[key] = R; return R;
  }
  function animImage(key) { const m = /^car:(\w+):(#[0-9a-f]{6}):(-?1)$/.exec(key); return m ? carImage(m[1], m[2], +m[3]) : null; }
  function paintFront() {   // blossom branches reaching into the top corners, nearer than the fighters
    const L = layer(FRONT_W, H);
    if (TH.layout === 'konbini') sakuraOn(L, 30, -30, 300, 150, 23, { trunk: false, ang: Math.PI * 0.4, len: 70, light: 1, puff: 1.6 }); else sakuraOn(L, 10, -24, 230, 120, 23, { trunk: false, ang: Math.PI * 0.36, len: 52, light: 1 });
    sakuraOn(L, 790, -20, 220, 112, 29, { trunk: false, ang: Math.PI * 0.64, len: 50, light: -1 });
    return L;
  }
  const WINSPANS = [];
  function windowSpans() {   // each switching pane cut into the row spans no tree covers (「窗子的燈光在櫻花樹後」)
    WINSPANS.length = 0;
    for (const [wx, wy, ww, wh] of WINDOWS) {
      const spans = [];
      for (let y = wy; y < wy + wh; y++) { let x0 = -1; for (let x = wx; x <= wx + ww; x++) { const pane = x < wx + ww && !TREES.get(x, y); if (pane && x0 < 0) x0 = x; if (!pane && x0 >= 0) { spans.push([x0, y, x - x0, y < wy + (wh >> 1)]); x0 = -1; } } }
      WINSPANS.push(spans);
    }
  }
  function half(L) { const w = L.w >> 1, h = L.h >> 1, c = new Uint32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c[y * w + x] = L.c[(y * 2) * L.w + x * 2]; return { w, h, c }; }
  const PAINTED = {};
  function paint(id) {
    id = id || TH.id; setTheme(id);
    if (!PAINTED[id]) { const F = paintFar(); PAINTED[id] = { theme: id, sky: F.sky, clouds: F.clouds, city: F.city, mid: paintMid(), near: paintNear(), rail: paintRail(), front: paintFront(), frontRate: 1.25, midRate: MID_RATE, cloudSpeed: TH.cloudSpeed || 2.5 }; }
    return PAINTED[id];
  }

  // ---------------------------------------------------------------- living background: pure functions of the time
  const PINK = ['#ffb7cc', '#f7a3bd', '#ffd6e0', '#e88fa8'];
  function anim(t, broken) {
    const out = [], s = t / 1000, Hh = HS; broken = broken || new Set();
    const PK = TH.petals || PINK;
    for (let k = 0; k < 34; k++) {   // petals in the wind (one in five in front of the fighters)
      const vy = 14 + Hh(k, 1, 21) * 16, per = 1.4 + Hh(k, 2, 21) * 2.2, amp = 5 + Hh(k, 3, 21) * 10;
      const y = ((Hh(k, 4, 21) * 300 + s * vy) % (GROUND + 30)) - 12, x = ((Hh(k, 5, 21) * W + s * (10 + Hh(k, 6, 21) * 12) + Math.sin(s / per * Math.PI * 2 + k) * amp) % W + W) % W;
      const big = Hh(k, 7, 21) > 0.6, front = k % 5 === 0, px0 = Math.round(x), py0 = Math.round(y), col = PK[k & 3], edge = PK[(k + 3) & 3], tilt = (k + Math.floor(s * 2 + Hh(k, 8, 21) * 4)) & 1, fast = vy > 24;   // a petal: an oval or a teardrop, tilting as it tumbles
      if (front) { out.push({ x: px0, y: py0, w: 4, h: 2, col, a: 0.95, front: true }); out.push({ x: px0 + (tilt ? 1 : 2), y: py0 + 2, w: 2, h: 1, col: edge, a: 0.9, front: true }); out.push({ x: px0 + (tilt ? 3 : -1), y: py0 - 1, w: 1, h: 1, col: PK[2], a: 0.8, front: true }); }
      else if (big) { out.push({ x: px0, y: py0, w: 3, h: 1, col, a: 0.8 }); out.push({ x: px0 + (tilt ? 1 : 0), y: py0 + 1, w: 2, h: 1, col: edge, a: 0.75 }); if (fast) out.push({ x: px0 - 2, y: py0, w: 2, h: 1, col, a: 0.35 }); }
      else { out.push({ x: px0, y: py0, w: 2, h: 1, col, a: 0.75 }); out.push({ x: px0 + tilt, y: py0 + 1, w: 1, h: 1, col: edge, a: 0.6 }); }
    }
    for (let k = 0; k < 24; k++) { const y = ((Hh(k, 14, 21) * 300 + s * (10 + Hh(k, 15, 21) * 10)) % (GROUND + 30)) - 12, x = ((Hh(k, 16, 21) * W + s * (8 + Hh(k, 17, 21) * 10) + Math.sin(s * 1.3 + k) * 6) % W + W) % W; out.push({ x: Math.round(x), y: Math.round(y), w: 1, h: 1, col: PK[(k + 2) & 3], a: 0.7 }); }   // tiny petals
    for (const [k, lx0, ly0, lw, lh, r, id] of (TH.layout === 'konbini' ? [[0, 80, 88, 16, 16, 20, 'lampL']] : [[0, 265, 88, 16, 16, 20, 'lampL'], [1, 499, 88, 16, 16, 20, 'lampR']])) {   // the street lamps' flicker
      if (broken.has(id) || TH.day) continue;
      const f = 0.55 + 0.45 * Math.sin(s * 9 + k * 2) * Math.sin(s * 3.3 + k) + (Hh(Math.floor(s * 12) + k, 8, 21) > 0.9 ? -0.35 : 0);
      out.push({ x: lx0 - r, y: ly0 - r, w: lw + r * 2, h: lh + r * 2, col: '#ffd070', a: 0.02 + 0.04 * f });
      out.push({ x: lx0 - (r >> 1), y: ly0 - (r >> 1), w: lw + r, h: lh + r, col: '#ffe4a0', a: 0.04 + 0.06 * f });
    }
    if (!TH.day) {   // the shopfronts' light and the neon hum across the road (mid), the vending machine's (near)
      const f = 0.85 + 0.15 * Math.sin(s * 7.3) + (Hh(Math.floor(s * 9), 13, 21) > 0.94 ? -0.5 : 0);
      for (const [x0, y0, w, h, key] of (TH.layout === 'konbini' ? [[232, 129, 256, 79, 'konbiniGlow']] : [[4, 152, 118, 36, 'storeGlow'], [268, 148, 130, 40, 'konbiniGlow'], [414, 150, 62, 38, 'konbiniGlow'], [494, 148, 46, 40, 'storeGlow'], [610, 144, 30, 44, 'storeGlow']])) out.push({ mid: true, x: x0, y: y0, w, h, col: TH[key], a: 0.035 * f });
      if (TH.layout === 'konbini') out.push({ mid: true, x: 230, y: 90, w: 260, h: 30, col: TH.signBand, a: 0.02 + 0.02 * Math.sin(s * 9) }); else out.push({ mid: true, x: 0, y: 38, w: 20, h: 94, col: TH.neon, a: 0.03 + 0.03 * Math.sin(s * 11) }); if (TH.layout !== 'konbini') out.push({ mid: true, x: 462, y: 38, w: 20, h: 76, col: TH.neon2, a: 0.03 + 0.03 * Math.sin(s * 9 + 1) }); if (TH.layout !== 'konbini') out.push({ mid: true, x: 594, y: 0, w: 70, h: 26, col: TH.neon2, a: 0.025 + 0.025 * Math.sin(s * 7 + 2) });
      if (!broken.has('vend')) out.push({ x: 198, y: 148, w: 48, h: 92, col: '#c0e8ff', a: 0.03 * f });
    }
    if (!TH.day) for (let k = 0; k < 5; k++) {   // the block's windows switching, only where no canopy covers the pane (mid)
      const slot = Math.floor(s / 1.1) + k * 7, on = Hh(slot, 9, 21) > 0.5, wi = WINDOWS.length ? Math.floor(Hh(slot, 10, 21) * WINDOWS.length) % WINDOWS.length : 0;
      for (const [x, y, w, top] of WINSPANS[wi] || []) out.push({ mid: true, x, y, w, h: 1, col: on ? (top ? TH.aptLit[0] : TH.aptLit[1]) : TH.aptWin, a: 1 });
    }
    for (const [k, y0, len, col, spd] of [[0, 10, 70, TH.cloud.body, 3.2], [1, 20, 48, TH.cloud.shade, 2.4], [2, 32, 90, TH.cloud.shade, 1.8]]) {   // wisps (far)
      const x0 = ((k * 170 + s * spd) % (FAR_W + 140)) - 70;
      for (let x = 0; x < len; x += 2) { const bump = (x % 13 < 9) ? 2 : 0; out.push({ far: true, x: x0 + x, y: y0 + ((x / 2) & 1) - bump, w: 2, h: 2 + bump, col, a: 0.9 }); }
    }
    for (let k = 0; k < 14; k++) { const x = Math.floor(Hh(k, 1, 11) * FAR_W), y = Math.floor(Math.pow(Hh(k, 2, 11), 1.5) * 150); if (TH.stars) out.push({ far: true, x, y, w: 1, h: 1, col: '#ffffff', a: 0.5 + 0.5 * Math.sin(s * (1.5 + Hh(k, 12, 21) * 3) + k * 1.7) }); }
    if ((Math.floor(s * 1.2) & 1) && TH.layout !== 'konbini') out.push({ far: true, x: 379, y: 1, w: 3, h: 2, col: '#ff6060', a: 0.9 });
    const tp = (s % 16) / 16;   // the train on the viaduct every 16 s (mid): four 20 m cars at 49 km/h, wide lit windows, door pairs, roof units
    if (tp < 0.4 && TH.layout !== 'konbini') { const u = tp / 0.4, CARW = 240, tx0 = MID_W + 40 - u * (MID_W + 80 + CARW * 4), WC = TH.day ? '#8ab0d0' : TH.rain ? '#ffb0e0' : '#bfeaff';
      for (let c = 0; c < 4; c++) { const cx = tx0 + c * CARW;
        out.push({ mid: true, x: cx + 1, y: 20, w: CARW - 2, h: 34, col: '#d8e4f4', a: 1 }); out.push({ mid: true, x: cx + 1, y: 20, w: CARW - 2, h: 4, col: '#f4f8ff', a: 1 });
        out.push({ mid: true, x: cx + 1, y: 46, w: CARW - 2, h: 3, col: '#b8a8e0', a: 1 }); out.push({ mid: true, x: cx + 1, y: 49, w: CARW - 2, h: 5, col: '#2a3058', a: 1 });
        for (let i = 0; i < 6; i++) out.push({ mid: true, x: cx + (i < 2 ? 8 + i * 26 : 90 + (i - 2) * 26), y: 27, w: 20, h: 16, col: WC, a: 1 }); out.push({ mid: true, x: cx + 224, y: 27, w: 12, h: 16, col: WC, a: 1 });
        for (const dx of [60, 196]) { out.push({ mid: true, x: cx + dx, y: 25, w: 24, h: 26, col: '#c8d4e8', a: 1 }); out.push({ mid: true, x: cx + dx + 3, y: 28, w: 8, h: 14, col: WC, a: 1 }); out.push({ mid: true, x: cx + dx + 13, y: 28, w: 8, h: 14, col: WC, a: 1 }); out.push({ mid: true, x: cx + dx + 11, y: 25, w: 2, h: 26, col: '#8a96b0', a: 1 }); }
        for (const ax of [40, 120, 200]) out.push({ mid: true, x: cx + ax, y: 17, w: 12, h: 3, col: '#c8d4e8', a: 1 });
        out.push({ mid: true, x: cx, y: 22, w: 1, h: 30, col: '#8a96b0', a: 1 });
        if (c === 0) out.push({ mid: true, x: cx - 3, y: 34, w: 3, h: 8, col: '#ffffff', a: 1 }); } }
    const cp2 = (s % 9) / 9, cn = Math.floor(s / 9);   // a car crossing the road behind the guardrail every 9 s: sedan / kei van / taxi in several colours, alternating direction
    if (cp2 < 0.5 && TH.layout !== 'konbini') {
      const dir = cn & 1 ? 1 : -1, u = cp2 / 0.5, kind = ['sedan', 'van', 'taxi', 'sedan'][cn % 4], cols = CAR_COLS[kind], col = cols[Math.floor(Hh(cn, 71, 21) * cols.length)], im = carImage(kind, col, dir);
      const span = W + im.w + 40, cx = Math.round(dir > 0 ? -im.w - 20 + u * span : W + 20 - u * span), cy = 216 - im.h;
      out.push({ img: 'car:' + kind + ':' + col + ':' + dir, x: cx, y: cy, w: im.w, h: im.h, a: 1 });
      if (!TH.day) out.push({ x: dir > 0 ? cx + im.w : cx - 34, y: 216 - 22, w: 34, h: 10, col: '#fff0c0', a: 0.16 });   // the headlight beam
    }
    if (TH.rain) for (let k = 0; k < 110; k++) { const spd = 160 + Hh(k, 51, 21) * 120, x = ((Hh(k, 52, 21) * (W + 60) + s * 14) % (W + 60)) - 30, y = ((Hh(k, 53, 21) * 320 + s * spd) % (H + 40)) - 20, front = k % 4 === 0; out.push(front ? { x: Math.round(x), y: Math.round(y), w: 1, h: 9, col: '#bfe0ff', a: 0.5, front: true } : { mid: true, x: Math.round(x * 1.2), y: Math.round(y), w: 1, h: 7, col: '#9ad0e0', a: 0.35 }); }
    const bp = (s % 14) / 14;   // bats (far)
    if (bp < 0.45 && !TH.day) for (let k = 0; k < 3; k++) { const bx = FAR_W + 40 - bp / 0.45 * (FAR_W + 80) + k * 22, by = 26 + k * 7 + Math.sin(s * 6 + k) * 4, flap = Math.floor(s * 10 + k) & 1; out.push({ far: true, x: bx, y: by, w: 2, h: 1, col: '#0a0b1c', a: 1 }); out.push({ far: true, x: bx - 3, y: by - flap, w: 3, h: 1, col: '#0a0b1c', a: 1 }); out.push({ far: true, x: bx + 2, y: by - flap, w: 3, h: 1, col: '#0a0b1c', a: 1 }); }
    const cp = (s % 26) / 26;   // a cat along the guardrail
    if (cp > 0.7 && TH.layout !== 'konbini') { const u = (cp - 0.7) / 0.3, cx = 700 - u * 200, cy = 183, step = Math.floor(s * 6) & 1, C = '#0c0d1e'; out.push({ x: cx, y: cy + 2, w: 11, h: 4, col: C, a: 1 }); out.push({ x: cx - 4, y: cy + 1, w: 5, h: 4, col: C, a: 1 }); out.push({ x: cx - 4, y: cy - 1, w: 1, h: 2, col: C, a: 1 }); out.push({ x: cx - 1, y: cy - 1, w: 1, h: 2, col: C, a: 1 }); out.push({ x: cx + 11, y: cy - 2 + step, w: 1, h: 5, col: C, a: 1 }); out.push({ x: cx + 1 + step, y: cy + 6, w: 1, h: 2, col: C, a: 1 }); out.push({ x: cx + 8 - step, y: cy + 6, w: 1, h: 2, col: C, a: 1 }); out.push({ x: cx - 3, y: cy + 2, w: 1, h: 1, col: '#ffe060', a: 1 }); }
    return out;
  }

  // ---------------------------------------------------------------- breakable props on the near sidewalk (real size)
  const PROPS = [
    { id: 'vend', kind: 'vend', hp: 4, hit: [200, 145, 44, 95], box: [184, 125, 120, 145] },
    { id: 'bike', kind: 'bike', hp: 2, hit: [524, 188, 91, 52], box: [514, 180, 112, 60] },
    { id: 'lampL', kind: 'lamp', hp: 2, hit: [265, 88, 16, 16], box: [233, 52, 80, 218] },
    { id: 'lampR', kind: 'lamp', hp: 2, hit: [499, 88, 16, 16], box: [467, 52, 80, 218] },
    { id: 'sign', kind: 'sign', hp: 2, hit: [622, 193, 29, 47], box: [616, 193, 62, 47] },
    { id: 'bin', kind: 'bin', hp: 2, hit: [656, 193, 23, 47], box: [650, 190, 70, 50] },
    { id: 'cone1', kind: 'cone', hp: 1, hit: [676, 204, 20, 36], box: [660, 204, 40, 36] },
    { id: 'cone2', kind: 'cone', hp: 1, hit: [698, 204, 20, 36], box: [682, 204, 40, 36] },
  ];
  function breakables() { return (TH.layout === 'konbini' ? PROPS_KONBINI : PROPS).map((p) => ({ id: p.id, kind: p.kind, hp: p.hp, hp0: p.hp, state: 0, hits: new Set(), x: p.hit[0], y: p.hit[1], w: p.hit[2], h: p.hit[3], box: p.box.slice() })); }

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
      if (!dim && !TH.day) { glow(L, OX + 22, OY + 30, 46, 52, '#9fd8ff', 34, 1.8); streak(L, OX + 4, OX + 40, OY + 95, OY + 107, '#c0e8ff', 50); streak(L, OX + 2, OX + 42, OY + 110, 145, '#c0e8ff', 70); }
      blit(L, S, OX, OY);
    } else {   // tipped over to the right, the glass dark, cans rolling out, a drink puddle
      const R = rot90cw(S); blit(L, R, OX, OY + 51);
      line(L, OX + 18, OY + 56, OX + 34, OY + 78, OUT); line(L, OX + 34, OY + 78, OX + 52, OY + 84, OUT);
      for (const [k, x, y] of [[0, 97, 90], [2, 93, 84], [1, 101, 86], [3, 89, 91], [4, 100, 80]]) { const [c, hi, lo] = CANS[k].map(hx); rect(L, OX + x, OY + y, 4, 3, c); L.set(OX + x, OY + y, hi); L.set(OX + x + 3, OY + y + 2, lo); }
      for (let x = OX + 84; x < OX + 104; x++) if (dith(x, OY + 94, 0.5)) L.set(x, OY + 94, hx('#3a4a8a'));
    }
    return L;
  }
  function paintLamp(state) {   // an 80×218 box: the 16×16 lamp at (32, 36) on a 2.75 m post (the jump's reach), its halo, its streak on the sidewalk
    const L = layer(80, 218);
    const ox = 32, oy = 36, P = (x, y, c) => L.set(ox + x, oy + y, c);
    if (state < 2 && !TH.day) {
      glow(L, ox + 8, oy + 8, 40, 34, '#ffd070', state ? 22 : 40, 1.7);
      streak(L, ox - 2, ox + 18, 188, 200, '#ffe0a0', state ? 26 : 48); streak(L, ox - 6, ox + 22, 203, 218, '#ffe0a0', state ? 40 : 70);
    }
    rect(L, ox + 7, oy + 16, 2, 136, T('pole')); rect(L, ox + 7, oy + 16, 1, 136, T('poleLight')); rect(L, ox + 4, 184, 8, 4, T('poleDark'));   // the post down to the sidewalk
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
    const L = layer(40, 36); const S = layer(20, 36);
    rect(S, 0, 32, 20, 4, hx('#1a1a2a')); rect(S, 0, 32, 20, 1, hx('#3a3a50')); rect(S, 2, 31, 16, 1, hx('#2a2a3a'));
    for (let y = 0; y < 32; y++) {
      const hw = 1.5 + (y / 32) * 6, x0 = Math.round(10 - hw), x1 = Math.round(10 + hw), band = (y >= 8 && y <= 12) || (y >= 18 && y <= 21);
      for (let x = x0; x <= x1; x++) S.set(x, y, x === x0 || x === x1 ? hx('#6a2a10') : x === x0 + 1 ? (band ? hx('#ffffff') : hx('#ffb070')) : x >= x1 - 2 ? (band ? hx('#b8b8c8') : hx('#c04a10')) : band ? hx('#f4f4f8') : hx('#ff7a2a'));
    }
    S.set(10, 0, hx('#ffb070')); S.set(9, 1, hx('#ffb070'));
    if (state < 2) blit(L, S, 16, 0); else blit(L, rot90ccw(S), 4, 16);   // knocked over to the left, the base staying put
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
    const key = kind + ':' + state + (TH.day ? ':day' : '');
    if (!propCache.has(key)) propCache.set(key, PAINTERS[kind](state));
    return propCache.get(key);
  }



  root.STAGE = { W, H, VW, GROUND, FAR_W, FRONT_W, MID_W, MID_RATE, PXM, MID_PXM, MID_BASE, paint, setTheme, THEMES, THEME_IDS, theme: () => TH, half, anim, breakables, propImage, animImage, get name() { return TH.layout === 'konbini' ? '桜のコンビニ前' : '東京鬼高校・校門前'; }, get en() { return TH.layout === 'konbini' ? 'SAKURA KONBINI' : 'TOKYO ONI HIGH — SCHOOL GATE'; } };
})(typeof window !== 'undefined' ? window : globalThis);
