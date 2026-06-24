// Génère les splash screens iOS (apple-touch-startup-image) — light + dark —
// pour supprimer l'écran blanc au démarrage de la PWA en mode standalone.
//
// iOS n'affiche RIEN pendant le boot du webview + le chargement réseau s'il
// n'y a pas de `apple-touch-startup-image` à la bonne dimension exacte du
// device. On génère donc un PNG par device (résolution physique exacte),
// fond de marque + logo centré (coins arrondis façon icône iOS).
//
// 100 % pur Node (zlib uniquement) — pas de dépendance image (sharp /
// ImageMagick indisponibles dans l'env de build). Le logo source
// (public/icons/icon-512.png, RGB 8-bit non-entrelacé) est décodé,
// downscalé une fois en box-filter, puis composé sur chaque canvas.
//
// Usage : `node scripts/generate-ios-splash.mjs`
// Sortie : public/splash/*.png  (+ liste des <link> à coller dans layout.tsx,
//          imprimée sur stdout pour vérification).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_LOGO = join(ROOT, "public/icons/icon-512.png");
const OUT_DIR = join(ROOT, "public/splash");

// Fond aligné sur les tokens design (globals.css / manifest).
const BG = {
  light: [245, 242, 242], // #f5f2f2 — --color-surface-page
  dark: [20, 18, 17], // #141211 — fond dark theme
};

// Taille cible du logo une fois composé (px physiques). 256 reste lisible
// sans dominer l'écran sur le plus petit device (750px de large).
const LOGO_SIZE = 256;
// Rayon des coins arrondis du logo (≈ ratio d'icône iOS : 22,5 %).
const LOGO_RADIUS = Math.round(LOGO_SIZE * 0.225);

// Devices iPhone courants : [label, largeur logique, hauteur logique, dpr].
// La dimension physique (logique × dpr) DOIT matcher exactement pour qu'iOS
// retienne l'image — sinon il retombe sur du blanc.
const DEVICES = [
  ["iPhone SE/8/7/6s", 375, 667, 2],
  ["iPhone 8+/7+/6+", 414, 736, 3],
  ["iPhone X/XS/11Pro/12mini/13mini", 375, 812, 3],
  ["iPhone XR/11", 414, 896, 2],
  ["iPhone XSMax/11ProMax", 414, 896, 3],
  ["iPhone 12/13/14/12Pro/13Pro", 390, 844, 3],
  ["iPhone 14Pro/15/15Pro/16", 393, 852, 3],
  ["iPhone 16Pro", 402, 874, 3],
  ["iPhone 12-14ProMax/14Plus", 428, 926, 3],
  ["iPhone 15/16 Plus & ProMax", 430, 932, 3],
  ["iPhone 16ProMax", 440, 956, 3],
];

// ─── Décodage PNG (RGB, 8-bit, non-entrelacé, color type 2) ───────────────
function decodePNG(buf) {
  let off = 8; // skip signature
  let width = 0,
    height = 0,
    colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    if (type === "IHDR") {
      width = buf.readUInt32BE(off + 8);
      height = buf.readUInt32BE(off + 12);
      colorType = buf[off + 17];
    } else if (type === "IDAT") {
      idat.push(buf.subarray(off + 8, off + 8 + len));
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const ft = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const v = raw[pos++];
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const ul =
        x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let r;
      switch (ft) {
        case 0:
          r = v;
          break;
        case 1:
          r = v + a;
          break;
        case 2:
          r = v + up;
          break;
        case 3:
          r = v + ((a + up) >> 1);
          break;
        case 4:
          r = v + paeth(a, up, ul);
          break;
        default:
          throw new Error("filtre PNG inconnu: " + ft);
      }
      out[y * stride + x] = r & 255;
    }
  }
  // Normalise en RGB (drop alpha si présent).
  if (channels === 3) return { width, height, data: out };
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0, j = 0; i < out.length; i += 4, j += 3) {
    rgb[j] = out[i];
    rgb[j + 1] = out[i + 1];
    rgb[j + 2] = out[i + 2];
  }
  return { width, height, data: rgb };
}

// ─── Downscale box-filter (moyenne de bloc) RGB ───────────────────────────
function downscale(src, sw, sh, dw, dh) {
  const dst = Buffer.alloc(dw * dh * 3);
  for (let dy = 0; dy < dh; dy++) {
    const sy0 = Math.floor((dy * sh) / dh);
    const sy1 = Math.max(sy0 + 1, Math.floor(((dy + 1) * sh) / dh));
    for (let dx = 0; dx < dw; dx++) {
      const sx0 = Math.floor((dx * sw) / dw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((dx + 1) * sw) / dw));
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * sw + sx) * 3;
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          n++;
        }
      }
      const j = (dy * dw + dx) * 3;
      dst[j] = Math.round(r / n);
      dst[j + 1] = Math.round(g / n);
      dst[j + 2] = Math.round(b / n);
    }
  }
  return dst;
}

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
    raw[y * (stride + 1)] = 0; // filtre None
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Composition d'un splash ──────────────────────────────────────────────
function makeSplash(pxW, pxH, bg, logo, logoSize) {
  const canvas = Buffer.alloc(pxW * pxH * 3);
  for (let i = 0; i < pxW * pxH; i++) {
    canvas[i * 3] = bg[0];
    canvas[i * 3 + 1] = bg[1];
    canvas[i * 3 + 2] = bg[2];
  }
  const ox = Math.round((pxW - logoSize) / 2);
  const oy = Math.round((pxH - logoSize) / 2);
  const rr = LOGO_RADIUS;
  const inRounded = (x, y) => {
    // Garde uniquement les pixels dans le rect aux coins arrondis.
    let cx = -1,
      cy = -1;
    if (x < rr && y < rr) {
      cx = rr;
      cy = rr;
    } else if (x >= logoSize - rr && y < rr) {
      cx = logoSize - rr - 1;
      cy = rr;
    } else if (x < rr && y >= logoSize - rr) {
      cx = rr;
      cy = logoSize - rr - 1;
    } else if (x >= logoSize - rr && y >= logoSize - rr) {
      cx = logoSize - rr - 1;
      cy = logoSize - rr - 1;
    }
    if (cx < 0) return true;
    const dx = x - cx,
      dy = y - cy;
    return dx * dx + dy * dy <= rr * rr;
  };
  for (let y = 0; y < logoSize; y++) {
    for (let x = 0; x < logoSize; x++) {
      if (!inRounded(x, y)) continue;
      const sj = (y * logoSize + x) * 3;
      const dj = ((oy + y) * pxW + (ox + x)) * 3;
      canvas[dj] = logo[sj];
      canvas[dj + 1] = logo[sj + 1];
      canvas[dj + 2] = logo[sj + 2];
    }
  }
  return encodePNG(pxW, pxH, canvas);
}

// ─── Main ─────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const srcPng = decodePNG(readFileSync(SRC_LOGO));
const logo = downscale(
  srcPng.data,
  srcPng.width,
  srcPng.height,
  LOGO_SIZE,
  LOGO_SIZE,
);

const links = [];
for (const scheme of ["light", "dark"]) {
  for (const [, lw, lh, dpr] of DEVICES) {
    const pxW = lw * dpr;
    const pxH = lh * dpr;
    const file = `apple-splash-${scheme}-${pxW}-${pxH}.png`;
    writeFileSync(
      join(OUT_DIR, file),
      makeSplash(pxW, pxH, BG[scheme], logo, LOGO_SIZE),
    );
    const media = `(prefers-color-scheme: ${scheme}) and (device-width: ${lw}px) and (device-height: ${lh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`;
    links.push(
      `        <link rel="apple-touch-startup-image" media="${media}" href="/splash/${file}" />`,
    );
  }
}

writeFileSync(join(OUT_DIR, "links.html"), links.join("\n") + "\n");
console.log(`Généré ${DEVICES.length * 2} splash screens dans public/splash/`);
console.log("Link tags écrits dans public/splash/links.html");
