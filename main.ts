// ─────────────────────────────────────────────────────────────────────────────
// news-image-20261119-v6 — candidate "C3"
//   C2 + numbered badges on the hero and feature cards + clean kerning.
//
// One PNG summing up the world news of Thursday 19 November 2026.
// Node 22+, standard library only, no network, fully deterministic.
// The page is drawn from scratch: own framebuffer (supersampled 2x), own
// stroke font with per-glyph advances and kerning pairs, own polygon world
// map, own PNG encoder. Writes exactly one file:
//   $MAKEFUN_OUTPUT_DIR/entry.png   (1024x1024, <= 1 MiB)
//
// Preview only — do not submit, do not publish.
// ─────────────────────────────────────────────────────────────────────────────

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

// ── Geometry ─────────────────────────────────────────────────────────────────
const W = 1024;
const H = 1024;
const SS = 2; // supersample factor: render at 2048x2048, box-downsample to 1024
const FW = W * SS;
const FH = H * SS;

// ── Palette ──────────────────────────────────────────────────────────────────
type RGB = [number, number, number];
const rgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const PAPER = rgb("#f7f3ea");
const INK = rgb("#16283f");
const RED = rgb("#b3342a");
const GOLD = rgb("#f2a541");
const CARD = rgb("#fffdf6");
const BANNER_BG = rgb("#efe7d3");
const MUTED = rgb("#5f6e7d"); // muted ink on paper
const MUTED_NAVY = rgb("#b9c5d1"); // muted ink on navy
const WHITE: RGB = [255, 255, 255];
const OCEAN = rgb("#cfdae4"); // map background
const SUNSET_TOP = rgb("#2a1a4a");
const SUNSET_MID = rgb("#a02c5a");
const SUNSET_LOW = rgb("#e2703a");
const SUNSET_HORIZON = rgb("#f2a541");
const SKYLINE = rgb("#1c1030");
const WATER = rgb("#241a4e");
const SUN = rgb("#f6c453");
const REGION: Record<string, RGB> = {
  asia: rgb("#c96f2e"),
  europe: rgb("#3e6fb0"),
  americas: rgb("#7a4f9e"),
  middleEast: rgb("#b3342a"),
  africa: rgb("#4d8a4f"),
  oceania: rgb("#2e8a8a"),
};
const HAIRLINE = rgb("#2c4258"); // thin separators on navy
const RULE = rgb("#8a97a3"); // thin rule on paper

// ── PNG encoder (filter 0 rows, zlib level 9) ────────────────────────────────
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(rgbBuf: Buffer, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    rgbBuf.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Framebuffer ──────────────────────────────────────────────────────────────
// All drawing coordinates are in final 1024px space; helpers scale by SS.
const fb = Buffer.alloc(FW * FH * 3);
function fillPaper(): void {
  for (let i = 0; i < FW * FH; i++) {
    fb[i * 3] = PAPER[0];
    fb[i * 3 + 1] = PAPER[1];
    fb[i * 3 + 2] = PAPER[2];
  }
}
function setPx(fx: number, fy: number, c: RGB): void {
  if (fx < 0 || fy < 0 || fx >= FW || fy >= FH) return;
  const i = (fy * FW + fx) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x * SS));
  const y0 = Math.max(0, Math.round(y * SS));
  const x1 = Math.min(FW, Math.round((x + w) * SS));
  const y1 = Math.min(FH, Math.round((y + h) * SS));
  for (let fy = y0; fy < y1; fy++) {
    let i = (fy * FW + x0) * 3;
    for (let fx = x0; fx < x1; fx++, i += 3) {
      fb[i] = c[0];
      fb[i + 1] = c[1];
      fb[i + 2] = c[2];
    }
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  // filled circle, centre/radius in final px
  const R = r * SS;
  const CX = cx * SS;
  const CY = cy * SS;
  const y0 = Math.max(0, Math.floor(CY - R));
  const y1 = Math.min(FH - 1, Math.ceil(CY + R));
  for (let fy = y0; fy <= y1; fy++) {
    const dy = fy + 0.5 - CY;
    const half = Math.sqrt(Math.max(0, R * R - dy * dy));
    const x0 = Math.max(0, Math.floor(CX - half));
    const x1 = Math.min(FW - 1, Math.ceil(CX + half));
    let i = (fy * FW + x0) * 3;
    for (let fx = x0; fx <= x1; fx++, i += 3) {
      fb[i] = c[0];
      fb[i + 1] = c[1];
      fb[i + 2] = c[2];
    }
  }
}
function segment(x1: number, y1: number, x2: number, y2: number, r: number, c: RGB): void {
  // thick line drawn as stamped discs (round caps + joins)
  const X1 = x1 * SS;
  const Y1 = y1 * SS;
  const X2 = x2 * SS;
  const Y2 = y2 * SS;
  const R = r * SS;
  const dx = X2 - X1;
  const dy = Y2 - Y1;
  const len = Math.hypot(dx, dy);
  const step = Math.max(1, R * 0.6);
  const n = Math.max(1, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    disc((X1 + dx * t) / SS, (Y1 + dy * t) / SS, r, c);
  }
}
type Pt = [number, number];
function polyline(pts: Pt[], r: number, c: RGB): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    segment(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, c);
  }
  if (pts.length === 1) disc(pts[0][0], pts[0][1], r, c);
}
function polygon(pts: Pt[], c: RGB): void {
  // even-odd scanline fill, points in final px
  const P = pts.map(([x, y]) => [x * SS, y * SS] as Pt);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of P) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(FH - 1, Math.ceil(maxY));
  for (let fy = y0; fy <= y1; fy++) {
    const y = fy + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < P.length; i++) {
      const [x1, y1p] = P[i];
      const [x2, y2p] = P[(i + 1) % P.length];
      if ((y1p <= y && y2p > y) || (y2p <= y && y1p > y)) {
        xs.push(x1 + ((y - y1p) / (y2p - y1p)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.floor(xs[k]));
      const xb = Math.min(FW - 1, Math.ceil(xs[k + 1]));
      let i = (fy * FW + xa) * 3;
      for (let fx = xa; fx <= xb; fx++, i += 3) {
        fb[i] = c[0];
        fb[i + 1] = c[1];
        fb[i + 2] = c[2];
      }
    }
  }
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}
function vgrad(x: number, y: number, w: number, h: number, stops: [number, RGB][]): void {
  // vertical multi-stop gradient; stops sorted by position 0..1
  for (let row = 0; row < Math.ceil(h * SS); row++) {
    const t = row / (h * SS - 1);
    let s = 0;
    while (s + 1 < stops.length && stops[s + 1][0] < t) s++;
    const [p0, c0] = stops[s];
    const [p1, c1] = stops[Math.min(s + 1, stops.length - 1)];
    const f = p1 > p0 ? Math.min(1, Math.max(0, (t - p0) / (p1 - p0))) : 0;
    fillRect(x, y + row / SS, w, 1 / SS + 0.01, mix(c0, c1, f));
  }
}
function rectStroke(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}
function pill(x: number, y: number, w: number, h: number, c: RGB): void {
  // rounded-end bar
  fillRect(x + h / 2, y, w - h, h, c);
  disc(x + h / 2, y + h / 2, h / 2, c);
  disc(x + w - h / 2, y + h / 2, h / 2, c);
}

// Box-downsample the 2x framebuffer to the final 1024x1024 RGB buffer.
function downsample(): Buffer {
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * FW + (x * SS + dx)) * 3;
          r += fb[i];
          g += fb[i + 1];
          b += fb[i + 2];
        }
      }
      const o = (y * W + x) * 3;
      const n = SS * SS;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
    }
  }
  return out;
}

// ── Stroke font ──────────────────────────────────────────────────────────────
// Glyphs as polylines on a 10-wide x 14-tall grid: baseline y=11, cap top
// y=1, x-height top y=4, descender bottom y=14. Each entry is
// [advanceUnits, "x,y x,y; x,y ..."] — strokes separated by ";".
// A stroke with a single point stamps one disc (dots, colons).
// Font size = em = 14 grid units, so 1 unit = size/14 px.
// Bold stroke radius = 1 unit (width size/7); regular = 0.78 units (size/9).
// Advances are per-glyph (narrow glyphs get narrow cells) so words do not
// develop the hollow gaps C2 showed after wide letters (M, m, w) before
// narrow ones (i, l, t). Kerning pairs below tighten the remaining holes.
type GlyphDef = { adv: number; strokes: Pt[][] };
const GLYPH_SRC: Record<string, [number, string]> = {
  // uppercase
  A: [10, "0,11 5,1 10,11;3,7 7,7"],
  B: [9, "1,1 1,11;1,1 6,1 8,2 8,4 6,6 1,6;1,6 7,6 9,8 9,10 7,11 1,11"],
  C: [9, "9,3 7,1 4,1 1,3 1,9 4,11 7,11 9,9"],
  D: [10, "1,1 1,11;1,1 6,1 9,3 9,9 6,11 1,11"],
  E: [8, "8,1 1,1 1,11 8,11;1,6 6,6"],
  F: [8, "8,1 1,1 1,11;1,6 6,6"],
  G: [10, "9,3 7,1 4,1 1,3 1,9 4,11 8,11 9,9 9,6 6,6"],
  H: [10, "1,1 1,11;10,1 10,11;1,6 10,6"],
  I: [5, "0,1 4,1;2,1 2,11;0,11 4,11"],
  J: [8, "7,1 7,10 5,11 2,11 1,9"],
  K: [10, "1,1 1,11;9,1 1,6;4,7 9,11"],
  L: [8, "1,1 1,11 8,11"],
  M: [11, "0,11 0,1 5,8 10,1 10,11"],
  N: [10, "1,11 1,1 10,11 10,1"],
  O: [10, "5,1 2,1 1,3 1,9 2,11 5,11 8,11 9,9 9,3 8,1 5,1"],
  P: [9, "1,1 1,11;1,1 7,1 9,3 9,5 7,6 1,6"],
  Q: [10, "5,1 2,1 1,3 1,9 2,11 5,11 8,11 9,9 9,3 8,1 5,1;7,8 10,11"],
  R: [9, "1,1 1,11;1,1 7,1 9,3 9,5 7,6 1,6;6,6 9,11"],
  S: [9, "9,3 7,1 4,1 1,3 1,5 3,6 6,6 8,8 8,10 6,11 3,11 1,9"],
  T: [9, "0,1 9,1;4.5,1 4.5,11"],
  U: [10, "1,1 1,9 3,11 7,11 9,9 9,1"],
  V: [10, "0,1 5,11 10,1"],
  W: [12, "0,1 2.5,11 5,5 7.5,11 10,1"],
  X: [10, "0,1 10,11;10,1 0,11"],
  Y: [10, "0,1 5,6 10,1;5,6 5,11"],
  Z: [9, "0,1 9,1 0,11 9,11"],
  // lowercase
  a: [8, "7,4 7,11;7,5 4,4 2,6 2,9 4,11 7,11"],
  b: [8, "1,1 1,11;1,8 3,5 6,5 7,7 7,9 5,11 1,11"],
  c: [7, "7,6 5,4 2,4 1,6 1,9 2,11 5,11 7,10"],
  d: [8, "7,1 7,11;7,8 5,5 2,5 1,7 1,9 3,11 7,11"],
  e: [8, "7,9 5,11 2,11 1,9 1,7 3,5 6,5 7,7;1,7 7,7"],
  f: [6, "5,2 3,1 2,3 2,11;1,5 5,5"],
  g: [8, "7,5 4,4 2,6 2,9 4,11 7,11;7,11 7,13 5,14 2,14 1,13"],
  h: [8, "1,1 1,11;1,7 3,5 6,5 7,7 7,11"],
  i: [4, "2,1 2,2;2,4 2,11"],
  j: [5, "2.5,1 2.5,2;2.5,4 2.5,12 2,13.5 0.5,14"],
  k: [8, "1,1 1,11;7,4 1,8;4,9 7,11"],
  l: [4, "2,1 2,11"],
  m: [11, "1,4 1,11;1,7 2,5 4,5 5,7 5,11;5,7 6,5 9,5 10,7 10,11"],
  n: [8, "1,11 1,4;1,7 3,5 6,5 7,7 7,11"],
  o: [8, "4,4 2,5 1,7 1,9 2,11 4,11 6,11 7,9 7,7 6,5 4,4"],
  p: [8, "1,4 1,14;1,8 3,5 6,5 7,7 7,9 5,11 1,11"],
  q: [8, "7,4 7,14;7,8 5,5 2,5 1,7 1,9 3,11 7,11"],
  r: [6, "1,11 1,4;1,7 3,5 5,5 6,6"],
  s: [7, "6,6 4,4 2,4 1,6 1,7 2,9 5,9 6,10 5,11 2,11 1,10"],
  t: [6, "3,1 3,10 4,11 5,11;1,5 5,5"],
  u: [8, "1,4 1,9 3,11 6,11 7,10 7,4"],
  v: [8, "0,4 4,11 8,4"],
  w: [11, "0,4 2.5,11 5,6 7.5,11 10,4"],
  x: [8, "0,4 8,11;8,4 0,11"],
  y: [8, "0,4 4,9 8,4;4,9 4,13 2.5,14 1,14"],
  z: [7, "0,4 7,4 0,11 7,11"],
  // digits — "9" is a closed bowl + a straight right tail, never a hook
  "0": [9, "4.5,1 2,1 1,3 1,9 2,11 4.5,11 7,11 8,9 8,3 7,1 4.5,1"],
  "1": [5, "1,3 3,1 3,11;0,11 5,11"],
  "2": [9, "1,4 1,2 3,1 6,1 8,3 8,5 1,11 8,11"],
  "3": [9, "1,3 3,1 6,1 8,3 8,5 6,6 8,7 8,9 6,11 3,11 1,9"],
  "4": [9, "6,1 1,8 8,8;6,1 6,11"],
  "5": [9, "8,1 1,1 1,6 7,6 8,8 8,10 6,11 2,11 1,9"],
  "6": [9, "8,3 5,1 2,2 1,5 1,9 3,11 6,11 8,9 8,7 6,6 3,6 1,8"],
  "7": [9, "1,1 8,1 3,11"],
  "8": [9, "4.5,1 2,2 1,4 2,6 4.5,6 7,6 8,4 7,2 4.5,1;4.5,6 2,7 1,9 2,11 4.5,11 7,11 8,9 7,7 4.5,6"],
  "9": [9, "3,1 6,1 8,3 8,5 6,7 3,7 1,5 1,3 3,1;8,4 8,11"],
  // punctuation
  ".": [4, "2,10 2,11"],
  ",": [4, "2,10 2,11;2,11 1,13 0,14"],
  "'": [4, "2.5,1 1.5,4"],
  "·": [5, "2.5,6.5"],
  "–": [8, "1,6 7,6"],
  "—": [11, "0,6 10,6"],
  "-": [6, "1,6 5,6"],
  $: [9, "7,3 5,1 2,1 1,3 1,5 3,6 6,6 8,8 8,10 6,11 3,11 1,9;4.5,0 4.5,12"],
  "%": [11, "2,0.5 3.5,2 2,3.5 0.5,2 2,0.5;8.5,8.5 10,10 8.5,11.5 7,10 8.5,8.5;1,11 10,1"],
  "+": [9, "4.5,2 4.5,10;1,6 8,6"],
  ":": [5, "2.5,4;2.5,9"],
  ";": [5, "2.5,4;2.5,9 2.5,10 1.5,12 0.5,13"],
  "/": [7, "5,1 2,11"],
  "(": [5, "4,1 2,3 2,9 4,11"],
  ")": [5, "1,1 3,3 3,9 1,11"],
  "!": [4, "2,1 2,8;2,10.5"],
  "?": [8, "2,4 2,2 4,1 6,1 7,3 7,5 5,7 4,8 4,9;4,10.5"],
  "&": [10, "7,2 5,1 3,1 2,3 2,5 4,7 6,8 8,10 8,11 6,11 4,10 2,8 1,6 2,4 4,3 6,4"],
  "€": [9, "8,3 6,1 3,1 1,3 1,9 3,11 6,11 8,9;0,5 6,5;0,8 6,8"],
  "á": [8, "7,4 7,11;7,5 4,4 2,6 2,9 4,11 7,11;5.5,0 7,2"],
};
const GLYPHS = new Map<string, GlyphDef>();
for (const [ch, [adv, src]] of Object.entries(GLYPH_SRC)) {
  const strokes: Pt[][] = src.split(";").map((s) =>
    s
      .trim()
      .split(/\s+/)
      .map((p) => {
        const [x, y] = p.split(",").map(Number);
        return [x, y] as Pt;
      }),
  );
  GLYPHS.set(ch, { adv, strokes });
}
const SPACE_ADV = 4; // word space in grid units (~0.29 em, tighter than C2's)

// Kerning pairs, delta in grid units (negative tightens). Targeted at the
// holes a stroke font leaves: a capital with a slanted/open right side
// (A, V, W, Y, T) or a wide lowercase (m, w) before a narrow letter
// (i, l, j, t, f), plus the C2 problem words:
//   "Mi" (Midnight), "mi" (committed), "An" (Anthropic), "To"/"Te"
//   (starts trading), "d"+"r" and the wide word space in "ordered …".
const KERN: Record<string, number> = {
  // capitals before lowercase — the reported holes
  An: -0.9, Ao: -0.9, Ae: -0.9, Au: -0.9, Am: -0.7, Ar: -0.7, Ac: -0.7,
  Ai: -1.3, Al: -1.3, At: -1.1, Af: -1.1, Ay: -0.9,
  Vn: -0.9, Vo: -0.9, Va: -0.9, Ve: -0.9, Vi: -1.3, Vl: -1.3,
  Wn: -0.9, Wo: -0.9, Wa: -0.9, We: -0.9, Wi: -1.3, Wl: -1.3,
  Yn: -0.9, Yo: -0.9, Ya: -0.9, Ye: -0.9, Yi: -1.3,
  To: -0.8, Ta: -0.8, Te: -0.8, Ti: -1.2, Tl: -1.2, Tw: -0.8, Ty: -0.8,
  Av: -1.0, Aw: -1.0, Ay: -1.0, AV: -0.9, AW: -0.9, AY: -0.9,
  Va: -0.9, Wa: -0.9, Ya: -0.9,
  // wide lowercase before narrow letters
  Mi: -1.2, mi: -1.0, ml: -1.0, mj: -1.0, mt: -0.7, mr: -0.5,
  wi: -1.0, wl: -1.0, wo: -0.4,
  ri: -0.4, rl: -0.4, rt: -0.4,
  fi: -0.5, fl: -0.5, ff: -0.5,
  ti: -0.4, tl: -0.4, to: -0.3, ta: -0.3, te: -0.3,
  yo: -0.5, ya: -0.5, ye: -0.5, yi: -0.7,
  // narrow stems (i, l, j) leave dead space on both sides of their cells:
  // tighten pairs where a narrow glyph meets another letter or a stop
  li: -1.2, il: -1.2, ll: -1.2, la: -1.0, ia: -1.0,
  ja: -1.5, je: -1.2, jo: -1.2, ju: -1.2,
  "l.": -0.8, "i.": -0.8, "i,": -0.8, "l,": -0.8, "j.": -0.8, ").": -0.8,
  // "VI" (hero monogram): separate V and I so the pair never reads as "M"
  VI: 1.2,
  // gentle even-out for common round/round and round/straight pairs
  oo: -0.3, oe: -0.3, ou: -0.3, on: -0.2, om: -0.2,
  nn: -0.2, mm: -0.2, rn: -0.2, rm: -0.2, rr: -0.2,
  co: -0.2, ce: -0.2, ca: -0.2, cu: -0.2,
  he: -0.2, ha: -0.2, ho: -0.2, hi: -0.3,
  th: -0.2, sh: -0.2, ch: -0.2, ck: -0.2,
  er: -0.2, ar: -0.2, ir: -0.2, ur: -0.2, or: -0.2,
  al: -0.3, le: -0.2,
  st: -0.2, ct: -0.2, ft: -0.2,
  LT: -0.6, Ly: -0.6, Lo: -0.5, La: -0.5,
  Jo: -0.6, Ja: -0.6,
  // digits before punctuation
  "1,": -0.5, "1.": -0.5, "9,": -0.4, "9.": -0.4,
};
function kern(a: string, b: string): number {
  if (a === " " || b === " ") return 0;
  return KERN[a + b] ?? 0;
}

type Weight = "bold" | "regular";
const EM = 14; // grid units per em

function textWidth(text: string, size: number): number {
  const unit = size / EM;
  let w = 0;
  let prev = "";
  for (const ch of text) {
    if (ch === " ") {
      w += SPACE_ADV * unit;
      prev = " ";
      continue;
    }
    const g = GLYPHS.get(ch);
    if (!g) {
      w += 8 * unit;
      prev = ch;
      continue;
    }
    w += (g.adv + kern(prev, ch)) * unit;
    prev = ch;
  }
  return w;
}

function drawText(x: number, y: number, text: string, size: number, weight: Weight, color: RGB): void {
  // x,y = top-left of the em box (em is 14 units tall)
  const unit = size / EM;
  const r = unit * (weight === "bold" ? 1.0 : 0.78); // stroke radius, final px
  let pen = x;
  let prev = "";
  for (const ch of text) {
    if (ch === " ") {
      pen += SPACE_ADV * unit;
      prev = " ";
      continue;
    }
    const g = GLYPHS.get(ch);
    if (!g) {
      pen += 8 * unit;
      prev = ch;
      continue;
    }
    const kx = kern(prev, ch) * unit;
    pen += kx;
    for (const stroke of g.strokes) {
      const pts: Pt[] = stroke.map(([gx, gy]) => [pen + gx * unit, y + gy * unit]);
      polyline(pts, r, color);
    }
    pen += g.adv * unit;
    prev = ch;
  }
}

function wrapText(text: string, size: number, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, size) <= maxW || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawLines(
  lines: string[],
  x: number,
  y: number,
  size: number,
  leading: number,
  weight: Weight,
  color: RGB,
): void {
  lines.forEach((line, i) => drawText(x, y + i * leading, line, size, weight, color));
}

// Centred text (used for masthead strip, numbers, legend, pin numbers).
function drawTextCentred(cx: number, y: number, text: string, size: number, weight: Weight, color: RGB): void {
  drawText(cx - textWidth(text, size) / 2, y, text, size, weight, color);
}

// ── World map ────────────────────────────────────────────────────────────────
// Simplified continent outlines in [lon, lat], drawn in region colours on a
// light ocean. Draw order matters where regions overlap at their borders:
// Asia first, then Americas and Africa, then Europe over Asia's west edge,
// then the Middle East over both, then Oceania and the small islands.
type LonLat = [number, number];
const MAP_X = 696;
const MAP_Y = 683;
const MAP_W = 288;
const MAP_H = 112;
function project(lon: number, lat: number): Pt {
  return [MAP_X + ((lon + 180) / 360) * MAP_W, MAP_Y + ((84 - lat) / 140) * MAP_H];
}
const ASIA: LonLat[] = [
  [40, 68], [50, 68], [60, 69], [70, 72], [80, 73], [90, 75], [100, 77], [110, 76],
  [120, 73], [130, 72], [140, 72], [150, 70], [160, 70], [170, 67], [178, 65], [178, 64],
  [170, 60], [162, 56], [158, 52], [150, 59], [142, 59], [141, 52], [140, 46], [135, 43],
  [130, 42], [127, 40], [126, 38], [122, 38], [120, 34], [122, 31], [120, 28], [114, 22],
  [108, 18], [106, 10], [104, 9], [101, 7], [100, 13], [98, 16], [94, 17], [92, 21],
  [89, 22], [86, 20], [82, 17], [80, 13], [77, 8], [75, 12], [73, 16], [70, 21],
  [66, 25], [62, 25], [58, 26], [56, 27], [54, 27], [52, 29], [50, 30], [48, 30],
  [44, 29], [42, 29], [40, 31], [38, 32], [36, 36], [34, 36], [30, 36], [27, 37],
  [28, 40], [30, 42], [32, 44], [35, 45], [38, 46], [40, 47], [42, 50], [45, 55],
  [48, 60], [50, 68],
];
const N_AMERICA: LonLat[] = [
  [-168, 66], [-165, 60], [-158, 58], [-152, 60], [-140, 60], [-135, 58], [-130, 54],
  [-125, 49], [-124, 42], [-120, 34], [-114, 29], [-110, 24], [-105, 20], [-97, 16],
  [-94, 17], [-90, 14], [-86, 12], [-83, 9], [-80, 8], [-77, 7], [-79, 9], [-82, 13],
  [-87, 16], [-90, 21], [-97, 26], [-93, 30], [-89, 30], [-84, 30], [-81, 26],
  [-80, 32], [-76, 35], [-74, 40], [-70, 42], [-68, 45], [-65, 44], [-60, 47],
  [-55, 47], [-60, 52], [-65, 58], [-68, 58], [-72, 62], [-78, 62], [-85, 66],
  [-92, 66], [-95, 69], [-110, 68], [-125, 70], [-140, 70], [-155, 71], [-165, 68],
];
const S_AMERICA: LonLat[] = [
  [-77, 7], [-75, 10], [-72, 12], [-64, 10], [-60, 8], [-55, 6], [-52, 5], [-50, 0],
  [-44, -3], [-38, -5], [-35, -8], [-39, -13], [-41, -22], [-48, -27], [-52, -32],
  [-58, -38], [-62, -41], [-65, -45], [-68, -50], [-69, -52], [-72, -54], [-74, -50],
  [-73, -44], [-73, -37], [-71, -30], [-70, -23], [-75, -15], [-77, -12], [-80, -6],
  [-81, -3], [-79, 1], [-77, 4],
];
const GREENLAND: LonLat[] = [
  [-45, 60], [-40, 60], [-32, 60], [-25, 60], [-20, 65], [-22, 70], [-25, 74],
  [-30, 76], [-40, 76], [-50, 75], [-55, 72], [-58, 68], [-52, 64], [-48, 62],
];
const EUROPE: LonLat[] = [
  [-10, 36], [-9, 43], [-2, 44], [-1, 46], [-4, 48], [-2, 49], [0, 51], [3, 53],
  [8, 57], [10, 59], [5, 60], [5, 62], [12, 64], [18, 69], [25, 71], [30, 70],
  [32, 68], [35, 66], [40, 68], [45, 68], [50, 68], [48, 60], [45, 55], [42, 50],
  [40, 47], [38, 46], [35, 45], [30, 45], [28, 44], [23, 40], [23, 36], [20, 40],
  [19, 42], [16, 44], [13, 45], [12, 44], [8, 44], [6, 43], [3, 43], [0, 40],
  [-2, 37], [-6, 36], [-9, 37],
];
const MIDDLE_EAST: LonLat[] = [
  [26, 37], [30, 36], [34, 36], [36, 36], [39, 37], [42, 38], [44, 39], [48, 38],
  [52, 37], [56, 36], [58, 32], [60, 28], [62, 25], [60, 22], [58, 20], [55, 17],
  [52, 15], [48, 14], [44, 13], [43, 13], [40, 15], [39, 21], [37, 24], [35, 28],
  [33, 31], [30, 33], [27, 36],
];
const AFRICA: LonLat[] = [
  [-17, 15], [-17, 21], [-15, 27], [-9, 31], [-5, 35], [0, 36], [10, 37], [11, 34],
  [19, 32], [25, 32], [30, 31], [32, 31], [35, 28], [37, 22], [39, 18], [41, 11],
  [44, 11], [48, 11], [51, 10], [51, 12], [46, 5], [42, 0], [40, -5], [40, -10],
  [36, -18], [35, -22], [32, -26], [28, -33], [20, -35], [17, -32], [15, -27],
  [13, -18], [12, -10], [13, -5], [9, -1], [9, 4], [-8, 5], [-13, 8], [-17, 12],
];
const MADAGASCAR: LonLat[] = [
  [44, -16], [47, -15], [50, -16], [50, -20], [47, -25], [45, -25], [43, -21], [43, -17],
];
const AUSTRALIA: LonLat[] = [
  [113, -22], [114, -30], [115, -35], [118, -35], [124, -33], [129, -32], [132, -32],
  [135, -35], [138, -35], [140, -38], [145, -38], [150, -37], [153, -32], [153, -27],
  [150, -23], [146, -19], [142, -15], [142, -11], [137, -12], [135, -15], [132, -12],
  [130, -13], [126, -14], [122, -17], [118, -20],
];
const NEW_ZEALAND: LonLat[] = [
  [167, -45], [168, -44], [170, -42], [173, -41], [175, -38], [177, -38], [178, -37],
  [176, -40], [174, -42], [171, -44], [168, -46],
];
const UK: LonLat[] = [[-5, 50], [-3, 53], [-5, 56], [-3, 58], [-1, 57], [0, 53], [1, 51], [-2, 50]];
const JAPAN: LonLat[] = [
  [130, 31], [132, 33], [135, 34], [137, 35], [139, 36], [140, 38], [141, 41],
  [142, 44], [144, 44], [143, 42], [141, 39], [140, 36], [139, 34], [137, 33],
  [135, 32], [132, 31],
];
const INDONESIA: LonLat[] = [
  [95, 5], [98, 3], [100, 0], [103, -2], [106, -6], [110, -7], [114, -8], [118, -9],
  [120, -10], [122, -9], [125, -9], [128, -8], [131, -3], [134, -2], [137, -3],
  [140, -4], [141, -8], [138, -8], [135, -6], [132, -4], [130, -2], [128, 0],
  [125, 1], [122, 1], [119, 0], [117, 2], [115, 4], [112, 3], [110, 1], [107, 0],
  [105, 3], [102, 4], [98, 5],
];
function drawMap(): void {
  fillRect(MAP_X, MAP_Y, MAP_W, MAP_H, OCEAN);
  const fill = (poly: LonLat[], c: RGB) => polygon(poly.map(([lo, la]) => project(lo, la)), c);
  fill(ASIA, REGION.asia);
  fill(N_AMERICA, REGION.americas);
  fill(S_AMERICA, REGION.americas);
  fill(GREENLAND, REGION.americas);
  fill(AFRICA, REGION.africa);
  fill(MADAGASCAR, REGION.africa);
  fill(EUROPE, REGION.europe);
  fill(MIDDLE_EAST, REGION.middleEast);
  fill(AUSTRALIA, REGION.oceania);
  fill(NEW_ZEALAND, REGION.oceania);
  fill(UK, REGION.europe);
  fill(JAPAN, REGION.asia);
  fill(INDONESIA, REGION.asia);
  rectStroke(MAP_X, MAP_Y, MAP_W, MAP_H, 1, INK);
}

// ── Pins ─────────────────────────────────────────────────────────────────────
// [story, lon, lat, displayShift?] — displayShift [dx, dy] in final px moves
// a disc off its true point (leader line joins them). Shifts are forced by
// the map's scale: several stories sit within one disc diameter of each
// other (Miami / Fort Lauderdale / Washington; The Hague / Copenhagen /
// Kerch / Antalya / Krasnodar; Shenzhen / Seoul / Gopalpur / Dhaka;
// Nairobi / Mogadishu). True points are kept for stories 1, 7, 9, 11, 12, 13.
type Pin = { n: number; lon: number; lat: number; dx: number; dy: number };
const PINS: Pin[] = [
  { n: 1, lon: -80.22, lat: 25.79, dx: 0, dy: 0 }, // Miami
  { n: 2, lon: 114.06, lat: 22.54, dx: 16.8, dy: 17.8 }, // Shenzhen
  { n: 3, lon: 4.3, lat: 52.07, dx: -19.4, dy: -12.5 }, // The Hague
  { n: 4, lon: -74.01, lat: 40.71, dx: 7.2, dy: -21.7 }, // New York
  { n: 5, lon: 36.47, lat: 45.31, dx: 2.8, dy: -19.9 }, // Kerch
  { n: 6, lon: 30.71, lat: 36.88, dx: -14.6, dy: 19.3 }, // Antalya
  { n: 7, lon: 46.68, lat: 24.71, dx: 0, dy: 0 }, // Riyadh
  { n: 8, lon: -77.04, lat: 38.9, dx: -16, dy: -14 }, // Washington
  { n: 9, lon: 126.98, lat: 37.57, dx: 0, dy: 0 }, // Seoul
  { n: 10, lon: 12.57, lat: 55.68, dx: -2.1, dy: -9.7 }, // Copenhagen
  { n: 11, lon: 84.92, lat: 19.27, dx: 0, dy: 0 }, // Gopalpur
  { n: 12, lon: 106.85, lat: -6.21, dx: 0, dy: 0 }, // Jakarta
  { n: 13, lon: 149.13, lat: -35.28, dx: 0, dy: 0 }, // Canberra
  { n: 14, lon: 36.82, lat: -1.29, dx: -25.5, dy: 12.8 }, // Nairobi
  { n: 15, lon: -74.07, lat: 4.71, dx: -16.7, dy: 11.6 }, // Bogotá
  { n: 16, lon: 90.41, lat: 23.81, dx: 7.7, dy: -23.2 }, // Dhaka
  { n: 17, lon: 38.98, lat: 45.04, dx: 24.8, dy: -14.2 }, // Krasnodar
  { n: 18, lon: 126.98, lat: 37.57, dx: 12, dy: -24 }, // Seoul (2nd) — north of 9
  { n: 19, lon: -80.14, lat: 26.12, dx: 18, dy: 20 }, // Fort Lauderdale
  { n: 20, lon: 45.32, lat: 2.05, dx: 15.7, dy: 7.4 }, // Mogadishu
];
const PIN_R = 11;
function drawPins(log: string[]): void {
  // leader lines first, then discs, then numbers
  for (const p of PINS) {
    const [tx, ty] = project(p.lon, p.lat);
    const cx = tx + p.dx;
    const cy = ty + p.dy;
    if (p.dx !== 0 || p.dy !== 0) {
      segment(cx, cy, tx, ty, 0.8, INK);
      disc(tx, ty, 1.6, INK);
    }
    disc(cx, cy, PIN_R, WHITE);
    disc(cx, cy, PIN_R - 1.2, RED);
    const label = String(p.n);
    drawTextCentred(cx, cy - (12 * 3) / 7, label, 12, "bold", WHITE);
  }
  // verification: every disc inside the frame, no two discs overlapping
  let minD = Infinity;
  let minPair = "";
  const centres = PINS.map((p) => {
    const [tx, ty] = project(p.lon, p.lat);
    return [tx + p.dx, ty + p.dy] as Pt;
  });
  for (let i = 0; i < centres.length; i++) {
    const [x, y] = centres[i];
    if (x - PIN_R < MAP_X || x + PIN_R > MAP_X + MAP_W || y - PIN_R < MAP_Y || y + PIN_R > MAP_Y + MAP_H) {
      log.push(`PIN ${i + 1} OUTSIDE FRAME at (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }
    for (let j = i + 1; j < centres.length; j++) {
      const d = Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]);
      if (d < minD) {
        minD = d;
        minPair = `${i + 1}/${j + 1}`;
      }
    }
  }
  log.push(`pins: 20 present; min centre distance ${minD.toFixed(1)}px (pins ${minPair}); disc diameter ${PIN_R * 2}px`);
}

// ── Story data (annex text, printed exactly) ─────────────────────────────────
type Feature = { n: number; chip: string; headline: string; context: string; source: string };
const HERO = {
  n: 1,
  chip: "OUT TODAY",
  headline: "GTA VI GOES ON SALE AFTER 13 YEARS",
  context: "Midnight unlock in New Zealand; an estimated 17.1m pre-orders worth about $1.65bn.",
  source: "— Reuters · Sensor Tower",
};
const FEATURES: Feature[] = [
  { n: 2, chip: "90 MIN", headline: "Trump, Xi and Putin hold first three-way summit", context: "90 minutes at APEC in Shenzhen; the declaration rejects nuclear war.", source: "— Reuters" },
  { n: 3, chip: "9–6", headline: "World Court: Myanmar committed genocide", context: "By 9 votes to 6 the ICJ found Myanmar guilty and ordered reparations.", source: "— Reuters · UN News" },
  { n: 4, chip: "$81.3bn", headline: "Anthropic starts trading after record $81.3bn IPO", context: "Shares priced at $83, ticker ANT, passing SpaceX's $75bn record.", source: "— AP" },
  { n: 5, chip: "3RD STRIKE", headline: "Ukraine hits Crimea bridge again", context: "Third strike in a week halts trains to Russia.", source: "— Reuters · Euronews" },
  { n: 6, chip: "$120bn CUT", headline: "COP31 draft drops fossil fuels and $120bn aid goal", context: "The slimmer text has no figure for adaptation aid; talks end Friday.", source: "— Reuters · AFP" },
  { n: 7, chip: "04:42", headline: "Saudis intercept Houthi missiles over Riyadh", context: "04:42 sirens; debris fell on the capital, damage reported.", source: "— Reuters" },
];
type Brief = { n: number; text: string; source: string };
const BRIEFS: Brief[] = [
  { n: 8, text: "US Senate rejects the Iran war-powers measure, 51–48.", source: "Reuters" },
  { n: 9, text: "551,864 sit South Korea's big exam; flights paused for listening.", source: "Yonhap" },
  { n: 10, text: "Denmark approves the Greenland security deal, 109–0.", source: "AP" },
  { n: 11, text: "Cyclone Akvan nears Odisha; about 300,000 evacuated, landfall Friday.", source: "IMD" },
  { n: 12, text: "Indonesia passes an asset-seizure law after 18 years.", source: "Reuters" },
  { n: 13, text: "Australia's jobless rate jumps to 4.9%, a five-year high.", source: "ABS" },
  { n: 14, text: "Marathon champion Jepchirchir banned three years for EPO.", source: "Reuters" },
  { n: 15, text: "Colombia's unions hold a national strike; marches in Bogotá.", source: "Infobae" },
  { n: 16, text: "Hasina supporters shut down parts of Bangladesh.", source: "Reuters" },
  { n: 17, text: "Kyiv says it hit two oil refineries in Krasnodar.", source: "Euronews" },
  { n: 18, text: "Korea's top court overturns ex-PM Han's 15-year jail term.", source: "Reuters" },
  { n: 19, text: "Floods shut South Florida schools; 15.3 inches of rain in a day.", source: "CBS" },
  { n: 20, text: "Somalia orders the UAE ambassador to leave within 72 hours.", source: "Reuters" },
];
const NUMBERS: [string, string][] = [
  ["$1.65bn", "GTA VI PRE-ORDERS, EST."],
  ["9–6", "WORLD COURT VOTE"],
  ["$81.3bn", "ANTHROPIC IPO"],
  ["51–48", "SENATE VOTE"],
  ["551,864", "EXAM SITTERS"],
  ["109–0", "DANISH VOTE"],
];
const DATE_TEXT = "Thursday 19 November 2026";
const REGION_STRIP = "ASIA 7 · EUROPE 4 · AMERICAS 5 · MIDDLE EAST 1 · AFRICA 2 · OCEANIA 1";
const FOOTER_BODY =
  "DATE CHECK — Every story on this page happened, or was first reported, on Thursday 19 November 2026. " +
  "LEFT OUT AS OTHER DAYS' NEWS — 18 NOV: Nvidia's results · the EU's €45bn Ukraine loan · Anthropic's $83 pricing · " +
  "Florida's rain begins (Tue–Wed). 20 NOV: COP31's scheduled close · Cyclone Akvan's landfall. " +
  "Estimates and disputed claims are attributed, not stated as fact.";
const SOURCES_LINE =
  "Sources: Reuters · AP · AFP · Al Jazeera · CNN · Euronews · Yonhap · ABS · IMD · Sensor Tower. Original drawings.";

// ── Band allocation (1024px total, same as C2) ──────────────────────────────
// top margin 16 · masthead 104 · gap 6 · hero 145.5 · gap 6 · numbers 46 ·
// gap 6 · features 236 (2 x 116 + 4) · gap 6 · bottom band 374 · gap 6 ·
// footer 64.5 · bottom margin 8.
const MARGIN = 16;
const CW = W - 2 * MARGIN; // 992
const HERO_Y = 126;
const HERO_H = 145.5;
const NUM_Y = 277.5;
const NUM_H = 46;
const FEAT_Y = 329.5;
const FEAT_ROW_H = 116;
const FEAT_GAP = 4;
const BOT_Y = 571.5;
const BOT_H = 374;
const FOOT_Y = 951.5;

// Numbered disc (badge / pin / index disc): solid disc + centred number.
// The number's cap height is centred on the disc centre.
function drawDiscNumber(cx: number, cy: number, r: number, label: string, size: number, bg: RGB, fg: RGB): void {
  disc(cx, cy, r, WHITE);
  disc(cx, cy, r - 1.2, bg);
  drawTextCentred(cx, cy - (size * 3) / 7, label, size, "bold", fg);
}

// ── Masthead ─────────────────────────────────────────────────────────────────
function drawMasthead(log: string[]): void {
  drawText(MARGIN, 18, "THE DAY IN WORLD NEWS", 13, "bold", INK);
  const right = "20 STORIES · 6 CONTINENTS · ONE DAY";
  drawText(W - MARGIN - textWidth(right, 13), 18, right, 13, "bold", INK);
  // Date: owner rule 54px, shrink only if it cannot fit, never below 52.
  let dateSize = 54;
  while (dateSize > 52 && textWidth(DATE_TEXT, dateSize) > CW) dateSize -= 1;
  log.push(`masthead date size ${dateSize}px, width ${textWidth(DATE_TEXT, dateSize).toFixed(1)}px`);
  drawText(MARGIN, 36, DATE_TEXT, dateSize, "bold", INK);
  fillRect(MARGIN, 96, CW, 1, RULE);
  fillRect(MARGIN, 100, CW, 18, INK);
  drawTextCentred(W / 2, 101.5, REGION_STRIP, 13, "bold", WHITE);
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function drawPalm(x: number, baseY: number, h: number, c: RGB): void {
  const crown: Pt = [x + 6, baseY - h];
  polyline(
    [
      [x, baseY],
      [x + 3, baseY - h * 0.6],
      crown,
    ],
    1.6,
    c,
  );
  // fronds arc out from the crown and droop (two segments each)
  const fronds: [Pt, Pt][] = [
    [[x - 8, baseY - h - 6], [x - 16, baseY - h + 4]],
    [[x - 12, baseY - h - 4], [x - 20, baseY - h + 8]],
    [[x - 3, baseY - h - 8], [x - 8, baseY - h + 2]],
    [[x + 4, baseY - h - 8], [x + 8, baseY - h + 2]],
    [[x + 12, baseY - h - 5], [x + 20, baseY - h + 6]],
    [[x + 14, baseY - h - 2], [x + 22, baseY - h + 10]],
  ];
  for (const [mid, tip] of fronds) {
    polyline([crown, mid, tip], 1.2, c);
  }
}
function drawHero(log: string[]): void {
  const x0 = MARGIN;
  const x1 = W - MARGIN;
  const y0 = HERO_Y;
  const y1 = HERO_Y + HERO_H;
  // sunset sky
  vgrad(x0, y0, x1 - x0, 124, [
    [0, SUNSET_TOP],
    [0.45, SUNSET_MID],
    [0.75, SUNSET_LOW],
    [1, SUNSET_HORIZON],
  ]);
  // low sun
  disc(770, 230, 19, SUN);
  // skyline silhouettes (base y 250)
  const buildings: [number, number, number][] = [
    [620, 26, 34], [650, 18, 48], [672, 30, 26], [706, 22, 40], [732, 16, 30],
    [752, 28, 44], [784, 20, 24], [808, 26, 38], [838, 18, 28], [860, 30, 46],
    [894, 22, 30], [920, 26, 42], [950, 20, 26], [974, 34, 40],
  ];
  for (const [bx, bw, bh] of buildings) fillRect(bx, 250 - bh, bw, bh, SKYLINE);
  // crane
  segment(712, 196, 712, 250, 1.5, SKYLINE);
  segment(690, 200, 748, 200, 1.5, SKYLINE);
  segment(742, 200, 742, 222, 1, SKYLINE);
  fillRect(739, 222, 6, 4, SKYLINE);
  // palms (tall enough that the crown clears the rooftops)
  drawPalm(648, 250, 58, SKYLINE);
  drawPalm(828, 250, 48, SKYLINE);
  // water band + sun reflection
  fillRect(x0, 250, x1 - x0, y1 - 250, WATER);
  vgrad(762, 250, 16, y1 - 250, [
    [0, SUNSET_HORIZON],
    [1, WATER],
  ]);
  // giant gold VI (shadow offset first)
  const viSize = 118;
  const viW = textWidth("VI", viSize);
  const viX = x1 - 16 - viW;
  drawText(viX + 3, 132 + 3, "VI", viSize, "bold", SKYLINE);
  drawText(viX, 132, "VI", viSize, "bold", GOLD);
  log.push(`hero VI size ${viSize}px, width ${viW.toFixed(1)}px at x ${viX.toFixed(1)}`);
  // opaque navy panel
  const px = x0;
  const pw = 592;
  fillRect(px, y0, pw, HERO_H, INK);
  // badge "1" + OUT TODAY chip
  drawDiscNumber(px + 24, y0 + 17, 11, "1", 13, RED, WHITE);
  const chipText = HERO.chip;
  const chipW = textWidth(chipText, 13) + 18;
  pill(px + 42, y0 + 8, chipW, 18, RED);
  drawText(px + 42 + 9, y0 + 11, chipText, 13, "bold", WHITE);
  // headline (one line), context (two lines), source
  const tx = px + 14;
  const tw = pw - 28;
  const hlW = textWidth(HERO.headline, 27);
  log.push(`hero headline 27px width ${hlW.toFixed(1)}px (panel inner ${tw}px)`);
  drawText(tx, y0 + 34, HERO.headline, 27, "bold", WHITE);
  const ctxLines = wrapText(HERO.context, 15, tw);
  log.push(`hero context lines: ${ctxLines.length}`);
  drawLines(ctxLines, tx, y0 + 68, 15, 19, "regular", WHITE);
  drawText(tx, y0 + 112, HERO.source, 13, "regular", MUTED_NAVY);
}

// ── Numbers strip ────────────────────────────────────────────────────────────
function drawNumbers(): void {
  fillRect(MARGIN, NUM_Y, CW, NUM_H, INK);
  const cellW = CW / NUMBERS.length;
  for (let i = 0; i < NUMBERS.length; i++) {
    const cx = MARGIN + cellW * (i + 0.5);
    drawTextCentred(cx, NUM_Y + 5, NUMBERS[i][0], 24, "bold", WHITE);
    drawTextCentred(cx, NUM_Y + 31, NUMBERS[i][1], 11, "regular", MUTED_NAVY);
    if (i > 0) fillRect(MARGIN + cellW * i, NUM_Y + 5, 1, NUM_H - 10, HAIRLINE);
  }
}

// ── Feature cards ────────────────────────────────────────────────────────────
function drawBannerScene(n: number, x: number, y: number): void {
  // 16px-tall strip; keep icons clear of the badge (left ~26px) and the chip (right ~95px)
  const bx = x + 34;
  const by = y;
  if (n === 2) {
    // three summit flags
    const flags: [RGB, RGB, RGB][] = [
      [RED, WHITE, RED],
      [RED, rgb("#f6c453"), RED],
      [WHITE, rgb("#3e6fb0"), RED],
    ];
    for (let f = 0; f < 3; f++) {
      const fx = bx + f * 20;
      segment(fx + 7, by + 2, fx + 7, by + 14, 0.8, INK);
      for (let s = 0; s < 3; s++) fillRect(fx + 8, by + 2 + s * 3, 13, 3, flags[f][s]);
      if (f === 1) disc(fx + 12, by + 5, 1.6, rgb("#f6c453"));
      if (f === 0) fillRect(fx + 8, by + 2, 6, 4, rgb("#3e6fb0"));
    }
  } else if (n === 3) {
    // courthouse + scales
    polygon(
      [
        [bx + 4, by + 13],
        [bx + 21, by + 3],
        [bx + 38, by + 13],
      ],
      INK,
    );
    fillRect(bx + 8, by + 9, 2, 5, INK);
    fillRect(bx + 20, by + 9, 2, 5, INK);
    fillRect(bx + 32, by + 9, 2, 5, INK);
    fillRect(bx + 4, by + 14, 34, 1, INK);
    segment(bx + 52, by + 3, bx + 52, by + 14, 0.9, INK);
    segment(bx + 44, by + 6, bx + 60, by + 6, 0.9, INK);
    segment(bx + 44, by + 6, bx + 44, by + 10, 0.8, INK);
    segment(bx + 60, by + 6, bx + 60, by + 10, 0.8, INK);
    disc(bx + 44, by + 11, 2, INK);
    disc(bx + 60, by + 11, 2, INK);
  } else if (n === 4) {
    // rising bars + arrow
    fillRect(bx + 4, by + 9, 8, 5, INK);
    fillRect(bx + 16, by + 6, 8, 8, GOLD);
    fillRect(bx + 28, by + 3, 8, 11, INK);
    polyline(
      [
        [bx + 2, by + 12],
        [bx + 20, by + 8],
        [bx + 38, by + 4],
        [bx + 52, by + 1],
      ],
      1.1,
      RED,
    );
    segment(bx + 52, by + 1, bx + 46, by + 1, 1.1, RED);
    segment(bx + 52, by + 1, bx + 52, by + 6, 1.1, RED);
  } else if (n === 5) {
    // bridge + flash
    polyline(
      [
        [bx + 2, by + 12],
        [bx + 30, by + 7],
        [bx + 58, by + 12],
      ],
      1.1,
      INK,
    );
    segment(bx + 14, by + 4, bx + 14, by + 11, 1, INK);
    segment(bx + 46, by + 4, bx + 46, by + 11, 1, INK);
    segment(bx + 30, by + 2, bx + 30, by + 12, 1.2, rgb("#e2703a"));
    segment(bx + 24, by + 7, bx + 36, by + 7, 1.2, rgb("#e2703a"));
  } else if (n === 6) {
    // thermometer + banned drop
    fillRect(bx + 6, by + 3, 4, 9, INK);
    disc(bx + 8, by + 12.5, 2.6, RED);
    disc(bx + 8, by + 5, 1.4, RED);
    disc(bx + 34, by + 8, 5.5, RED);
    disc(bx + 34, by + 8, 4, BANNER_BG);
    segment(bx + 30, by + 4, bx + 38, by + 12, 1.2, RED);
  } else if (n === 7) {
    // tower + missile arcs + shield
    fillRect(bx + 6, by + 4, 9, 10, INK);
    polygon(
      [
        [bx + 6, by + 4],
        [bx + 10.5, by + 1],
        [bx + 15, by + 4],
      ],
      INK,
    );
    polyline(
      [
        [bx + 44, by + 2],
        [bx + 36, by + 7],
        [bx + 30, by + 12],
      ],
      1.1,
      RED,
    );
    polyline(
      [
        [bx + 52, by + 5],
        [bx + 46, by + 9],
        [bx + 42, by + 13],
      ],
      1.1,
      RED,
    );
    polygon(
      [
        [bx + 56, by + 3],
        [bx + 66, by + 3],
        [bx + 66, by + 9],
        [bx + 61, by + 13],
        [bx + 56, by + 9],
      ],
      rgb("#3e6fb0"),
    );
  }
}
function drawFeatures(log: string[]): void {
  const colW = (CW - 2 * 8) / 3;
  FEATURES.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = MARGIN + col * (colW + 8);
    const cy = FEAT_Y + row * (FEAT_ROW_H + FEAT_GAP);
    fillRect(cx, cy, colW, FEAT_ROW_H, CARD);
    rectStroke(cx, cy, colW, FEAT_ROW_H, 1, INK);
    // banner + scene
    fillRect(cx, cy, colW, 16, BANNER_BG);
    drawBannerScene(f.n, cx, cy);
    // badge disc (red, same style as map pins) top-left of the banner
    drawDiscNumber(cx + 13, cy + 8, 10, String(f.n), 12, RED, WHITE);
    // chip pill top-right
    const chipW = textWidth(f.chip, 13) + 18;
    pill(cx + colW - 8 - chipW, cy - 1, chipW, 17, RED);
    drawText(cx + colW - 8 - chipW + 9, cy + 0.5, f.chip, 13, "bold", WHITE);
    // headline (20px bold, 2 lines), context (14px, 2 lines), source (13px)
    const tx = cx + 10;
    const tw = colW - 20;
    const hl = wrapText(f.headline, 20, tw);
    const cl = wrapText(f.context, 14, tw);
    log.push(`card ${f.n}: headline ${hl.length} lines, context ${cl.length} lines`);
    if (hl.length > 2 || cl.length > 2) log.push(`CARD ${f.n} OVERFLOW: headline ${hl.length}, context ${cl.length}`);
    drawLines(hl, tx, cy + 21, 20, 22, "bold", INK);
    drawLines(cl, tx, cy + 65, 14, 15.5, "regular", INK);
    drawText(tx, cy + 96, f.source, 13, "regular", MUTED);
  });
}

// ── Bottom band: brief index + map ───────────────────────────────────────────
function drawIndex(log: string[]): void {
  const panelX0 = MARGIN;
  const panelX1 = 680;
  const colW = (panelX1 - panelX0 - 16) / 2;
  const colX = [panelX0, panelX0 + colW + 16];
  const textW = colW - 29;
  drawText(panelX0, 577, "ALSO ON THURSDAY", 16, "bold", INK);
  fillRect(panelX0, 596, panelX1 - panelX0, 1, RULE);
  // wrap each item: story at 17px; source tag joins the last line when it
  // fits, otherwise it takes its own line (max 3 lines per item)
  type Item = { lines: string[]; srcOwnLine: boolean };
  const items: Item[] = BRIEFS.map((b) => {
    const lines = wrapText(b.text, 17, textW);
    const lastW = textWidth(lines[lines.length - 1], 17);
    const srcW = textWidth("— " + b.source, 13);
    const srcOwnLine = lastW + 6 + srcW > textW;
    return { lines, srcOwnLine };
  });
  const itemLines = (it: Item) => it.lines.length + (it.srcOwnLine ? 1 : 0);
  // choose the split point that balances the two columns by line count
  let bestK = 7;
  let bestMax = Infinity;
  for (let k = 1; k < BRIEFS.length; k++) {
    const a = items.slice(0, k).reduce((s, it) => s + itemLines(it), 0);
    const b = items.slice(k).reduce((s, it) => s + itemLines(it), 0);
    if (Math.max(a, b) < bestMax) {
      bestMax = Math.max(a, b);
      bestK = k;
    }
  }
  const gap = 2;
  const totalLines = bestMax;
  const col1H = items.slice(0, bestK).reduce((s, it) => s + itemLines(it), 0);
  const col2H = items.slice(bestK).reduce((s, it) => s + itemLines(it), 0);
  const usedH = 604 + totalLines * 22 + (Math.max(bestK, BRIEFS.length - bestK) - 1) * gap;
  log.push(`index split after item ${bestK + 7}: col1 ${col1H} lines, col2 ${col2H} lines; used height to y ${usedH.toFixed(1)} (band ends ${BOT_Y + BOT_H})`);
  if (usedH > BOT_Y + BOT_H) log.push("INDEX OVERFLOW into footer gap");
  for (let col = 0; col < 2; col++) {
    const list = col === 0 ? BRIEFS.slice(0, bestK) : BRIEFS.slice(bestK);
    const listItems = col === 0 ? items.slice(0, bestK) : items.slice(bestK);
    let y = 604;
    list.forEach((b, idx) => {
      const it = listItems[idx];
      drawDiscNumber(colX[col] + 11, y + 11, 11, String(b.n), 12, INK, WHITE);
      const tx = colX[col] + 29;
      it.lines.forEach((line, li) => {
        drawText(tx, y + li * 22, line, 17, "regular", INK);
        if (li === it.lines.length - 1 && !it.srcOwnLine) {
          const lw = textWidth(line, 17);
          drawText(tx + lw + 6, y + li * 22 + 2, "— " + b.source, 13, "regular", MUTED);
        }
      });
      if (it.srcOwnLine) {
        drawText(tx, y + it.lines.length * 22 + 2, "— " + b.source, 13, "regular", MUTED);
      }
      y += itemLines(it) * 22 + gap;
    });
  }
}
function drawMapPanel(log: string[]): void {
  drawText(688, 640, "WHERE IT HAPPENED", 16, "bold", INK);
  drawMap();
  drawPins(log);
  // legend, two columns x three rows
  const legend: [string, RGB][] = [
    ["Asia", REGION.asia],
    ["Americas", REGION.americas],
    ["Africa", REGION.africa],
    ["Europe", REGION.europe],
    ["Middle East", REGION.middleEast],
    ["Oceania", REGION.oceania],
  ];
  legend.forEach(([name, c], i) => {
    const lx = 696 + (i >= 3 ? 144 : 0);
    const ly = 808 + (i % 3) * 22;
    fillRect(lx, ly + 1, 12, 12, c);
    drawText(lx + 18, ly, name, 13, "regular", INK);
  });
  const note = "Pins 1–7 mark the hero and the six feature stories; 8–20 mark the briefs.";
  const noteLines = wrapText(note, 13, MAP_W);
  drawLines(noteLines, MAP_X, 876, 13, 16, "regular", MUTED);
}

// ── Footer ───────────────────────────────────────────────────────────────────
function drawFooter(): void {
  fillRect(MARGIN, 953, 4, 61, RED);
  const lines = wrapText(FOOTER_BODY, 13, 978);
  const prefix = "DATE CHECK — ";
  const prefixW = textWidth(prefix, 13);
  lines.forEach((line, i) => {
    const y = 953 + i * 15.5;
    if (i === 0) {
      drawText(30, y, prefix, 13, "bold", RED);
      drawText(30 + prefixW, y, line.slice(prefix.length), 13, "regular", INK);
    } else {
      drawText(30, y, line, 13, "regular", INK);
    }
  });
  drawText(30, 1001, SOURCES_LINE, 13, "regular", MUTED);
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main(): void {
  const log: string[] = [];
  fillPaper();
  drawMasthead(log);
  drawHero(log);
  drawNumbers();
  drawFeatures(log);
  drawIndex(log);
  drawMapPanel(log);
  drawFooter();
  const out = downsample();
  const png = encodePNG(out, W, H);
  const dir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/entry.png`, png);
  const sha = createHash("sha256").update(png).digest("hex");
  console.log(`entry.png ${png.length} bytes sha256 ${sha}`);
  console.log(`size ${W}x${H}; cap ${png.length <= 1048576 ? "OK" : "OVER 1 MiB"}`);
  for (const l of log) console.log(l);
}
main();
