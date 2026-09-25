// Minimal PNG writer + helpers to lay frames out on a sheet (node only).
'use strict';
const fs = require('fs');
const zlib = require('zlib');

const TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// pixels: Uint32Array of little-endian RGBA
function encode(w, h, pixels) {
  const bytes = Buffer.from(pixels.buffer, pixels.byteOffset, w * h * 4);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    bytes.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

class Canvas {
  constructor(w, h, bg = 0) { this.w = w; this.h = h; this.px = new Uint32Array(w * h).fill(bg); }
  // blit a PX.Buf (or any {w,h,c}) scaled by s at (x, y); transparent pixels skipped
  blit(src, x, y, s = 1) {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
      const c = src.c[j * src.w + i];
      if (!c) continue;
      const a = c >>> 24;
      for (let v = 0; v < s; v++) for (let u = 0; u < s; u++) {
        const X = x + i * s + u, Y = y + j * s + v;
        if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
        const k = Y * this.w + X;
        if (a === 255) this.px[k] = c;
        else this.px[k] = blend(this.px[k], c);
      }
    }
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
      this.px[j * this.w + i] = c;
    }
  }
  checker(x, y, w, h, s, c1, c2) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = x + i, Y = y + j;
      if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
      this.px[Y * this.w + X] = ((Math.floor(i / s) + Math.floor(j / s)) & 1) ? c1 : c2;
    }
  }
  save(file) { fs.writeFileSync(file, encode(this.w, this.h, this.px)); }
}
function blend(dst, src) {
  const a = (src >>> 24) / 255;
  const r = Math.round((src & 255) * a + (dst & 255) * (1 - a));
  const g = Math.round(((src >>> 8) & 255) * a + ((dst >>> 8) & 255) * (1 - a));
  const b = Math.round(((src >>> 16) & 255) * a + ((dst >>> 16) & 255) * (1 - a));
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

module.exports = { encode, Canvas, crc32 };
