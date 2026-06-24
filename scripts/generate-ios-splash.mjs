// Génère les splash screens iOS (apple-touch-startup-image).
//
// STRATÉGIE (cf. limite iOS) : iOS ne bascule PAS de façon fiable le splash
// selon le thème (prefers-color-scheme sur startup-image ignoré / figé au cache
// d'installation). On renonce donc au couple light/dark et on génère UNE SEULE
// image par device, d'une couleur unique = --color-surface-page light
// (#f5f2f2), identique au manifest background_color.
//
// La bascule vers le bon thème (light OU dark) est faite ENSUITE côté web :
// le squelette est rendu dans le bon thème (classe .dark posée avant le 1er
// paint), et un voile `.nc-splash-cover` de cette même couleur #f5f2f2 se fond
// par-dessus → transition fluide depuis le splash natif vers light ou dark.
//
// 100 % pur Node (zlib). Chaque image matche la résolution physique EXACTE
// d'un device (sinon iOS retombe sur du blanc).
//
// Usage : `node scripts/generate-ios-splash.mjs`

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public/splash");

// Couleur unique du splash = fond de page light (#f5f2f2), alignée sur le
// manifest background_color et sur le voile `.nc-splash-cover`.
const SPLASH = [245, 242, 242];

// [largeur logique, hauteur logique, dpr] — DOIT rester synchro avec
// iosSplashLinks.ts.
const DEVICES = [
  [375, 667, 2],
  [414, 736, 3],
  [375, 812, 3],
  [414, 896, 2],
  [414, 896, 3],
  [390, 844, 3],
  [393, 852, 3],
  [402, 874, 3],
  [428, 926, 3],
  [430, 932, 3],
  [440, 956, 3],
];

// ─── Encodage PNG (RGB 8-bit, filtre 0) ───────────────────────────────────
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Main : une image plate par device ────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
let count = 0;
for (const [lw, lh, dpr] of DEVICES) {
  const W = lw * dpr;
  const H = lh * dpr;
  const buf = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    buf[i * 3] = SPLASH[0];
    buf[i * 3 + 1] = SPLASH[1];
    buf[i * 3 + 2] = SPLASH[2];
  }
  writeFileSync(join(OUT_DIR, `apple-splash-${W}-${H}.png`), encodePNG(W, H, buf));
  count++;
}
console.log(`Généré ${count} splash screens (couleur unique #f5f2f2) dans public/splash/`);
