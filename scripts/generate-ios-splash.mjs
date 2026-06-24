// Génère les splash screens iOS (apple-touch-startup-image) — light + dark.
//
// IMPORTANT : sur iOS standalone, cette image STATIQUE est affichée pendant
// TOUT le chargement réseau au lancement (le squelette React ne s'affiche
// qu'après sa disparition). On peint donc ici directement l'aspect de la
// homepage en cours de chargement : fond exact (var surface-page), halo rouge
// de coin (uniquement en light, comme .nc-page-halo::before — supprimé en dark),
// et squelette du contenu (greeting + barre de recherche + 2 cartes widgets).
// → l'écran de lancement iOS devient indiscernable de la homepage qui suit.
//
// 100 % pur Node (zlib uniquement). Chaque image matche la résolution physique
// EXACTE d'un device (sinon iOS retombe sur du blanc).
//
// Usage : `node scripts/generate-ios-splash.mjs`

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public/splash");

// Tokens design (globals.css). En clair, les cartes sont blanches sur fond
// pinkish ; en sombre, surfaces warm near-black, sans halo.
const THEME = {
  light: {
    bg: [245, 242, 242], // --color-surface-page #f5f2f2
    bar: [228, 223, 223], // skeleton (≈ surface-raised, assombri pour visibilité)
    card: [255, 255, 255], // --color-surface-card
    cardInner: [233, 229, 229], // blocs internes des cartes
    border: [229, 231, 235], // --color-border-default
    halo: true,
  },
  dark: {
    bg: [20, 18, 17], // #141211
    bar: [38, 34, 31], // ≈ surface-raised #201d1b éclairci
    card: [42, 39, 37], // --color-surface-card #2a2725
    cardInner: [51, 47, 44], // blocs internes
    border: [51, 46, 43], // --color-border-default #332e2b
    halo: false,
  },
};

// Brand pour le halo rouge (rgba 224,99,90), alphas par coin (cf. CSS).
const BRAND = [224, 99, 90];
const CORNERS = [
  { ax: 0, ay: 0, a: 0.28 },
  { ax: 1, ay: 0, a: 0.24 },
  { ax: 0, ay: 1, a: 0.22 },
  { ax: 1, ay: 1, a: 0.26 },
];

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

// ─── Primitives de dessin (canvas RGB physique) ───────────────────────────
function makeCanvas(W, H, bg) {
  const buf = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    buf[i * 3] = bg[0];
    buf[i * 3 + 1] = bg[1];
    buf[i * 3 + 2] = bg[2];
  }
  return buf;
}

// Halo radial rouge dans les coins (blend alpha, falloff doux).
function paintHalo(buf, W, H) {
  const diag = Math.sqrt(W * W + H * H);
  const radius = diag * 0.42;
  for (const { ax, ay, a } of CORNERS) {
    const cx = ax * (W - 1);
    const cy = ay * (H - 1);
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(W - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(H - 1, Math.ceil(cy + radius));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= radius) continue;
        const tt = 1 - d / radius;
        const alpha = a * tt * tt;
        const i = (y * W + x) * 3;
        buf[i] = Math.round(buf[i] * (1 - alpha) + BRAND[0] * alpha);
        buf[i + 1] = Math.round(buf[i + 1] * (1 - alpha) + BRAND[1] * alpha);
        buf[i + 2] = Math.round(buf[i + 2] * (1 - alpha) + BRAND[2] * alpha);
      }
    }
  }
}

// Rectangle à coins arrondis, avec bordure optionnelle.
function fillRoundRect(buf, W, H, x, y, w, h, r, color, border) {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  r = Math.min(r, Math.floor(w / 2), Math.floor(h / 2));
  const bw = border ? Math.max(1, Math.round(W / 900)) : 0;
  // classe un pixel local : -1 dehors, 0 intérieur plein, 1 anneau de coin
  const region = (px, py) => {
    let cx = -1,
      cy = -1;
    if (px < r && py < r) {
      cx = r;
      cy = r;
    } else if (px >= w - r && py < r) {
      cx = w - r - 1;
      cy = r;
    } else if (px < r && py >= h - r) {
      cx = r;
      cy = h - r - 1;
    } else if (px >= w - r && py >= h - r) {
      cx = w - r - 1;
      cy = h - r - 1;
    }
    if (cx < 0) return 0;
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= r - bw - 0.5) return 0;
    if (dist <= r) return 1;
    return -1;
  };
  for (let py = 0; py < h; py++) {
    const gy = y + py;
    if (gy < 0 || gy >= H) continue;
    for (let px = 0; px < w; px++) {
      const gx = x + px;
      if (gx < 0 || gx >= W) continue;
      const rg = region(px, py);
      if (rg === -1) continue;
      const onStraightEdge =
        border && (px < bw || px >= w - bw || py < bw || py >= h - bw);
      const c = border && (rg === 1 || onStraightEdge) ? border : color;
      const i = (gy * W + gx) * 3;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
    }
  }
}

// ─── Squelette homepage (mobile : widgets empilés) ────────────────────────
function paintSkeleton(buf, W, H, lw, dpr, t) {
  const px = (v) => v * dpr; // CSS px → physique
  const padX = px(16); // px-4
  // Sur device, le contenu démarre à safe-area-inset-top (~47px notch) + pt-96.
  // On approxime pour aligner le squelette du splash avec la vraie homepage.
  const top = px(132);
  const contentW = W - padX * 2;

  let cy = top;
  // Greeting (gros titre)
  fillRoundRect(buf, W, H, padX, cy, contentW * 0.62, px(44), px(14), t.bar);
  cy += px(44) + px(16);
  // Barre de recherche (pill)
  fillRoundRect(buf, W, H, padX, cy, contentW, px(40), px(20), t.bar);
  cy += px(40) + px(24);

  // 2 cartes widgets empilées (comme la home mobile)
  const cardH = px(190);
  for (let card = 0; card < 2; card++) {
    fillRoundRect(buf, W, H, padX, cy, contentW, cardH, px(16), t.card, t.border);
    const ip = px(20); // padding interne
    let iy = cy + ip;
    const iw = contentW - ip * 2;
    fillRoundRect(buf, W, H, padX + ip, iy, px(110), px(11), px(5), t.cardInner);
    iy += px(11) + px(14);
    fillRoundRect(buf, W, H, padX + ip, iy, iw * 0.8, px(15), px(6), t.cardInner);
    iy += px(15) + px(8);
    fillRoundRect(buf, W, H, padX + ip, iy, iw * 0.55, px(13), px(6), t.cardInner);
    iy += px(13) + px(16);
    fillRoundRect(buf, W, H, padX + ip, iy, iw, px(8), px(4), t.cardInner);
    iy += px(8) + px(16);
    fillRoundRect(buf, W, H, padX + ip, iy, px(116), px(32), px(16), t.cardInner);
    cy += cardH + px(16);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
let count = 0;
for (const scheme of ["light", "dark"]) {
  const t = THEME[scheme];
  for (const [lw, lh, dpr] of DEVICES) {
    const W = lw * dpr;
    const H = lh * dpr;
    const buf = makeCanvas(W, H, t.bg);
    if (t.halo) paintHalo(buf, W, H);
    paintSkeleton(buf, W, H, lw, dpr, t);
    writeFileSync(
      join(OUT_DIR, `apple-splash-${scheme}-${W}-${H}.png`),
      encodePNG(W, H, buf),
    );
    count++;
  }
}
console.log(
  `Généré ${count} splash screens (skeleton homepage) dans public/splash/`,
);
