#!/usr/bin/env node
// Génère les icônes PNG nécessaires à l'installation PWA (manifest +
// apple-touch-icon). Placeholder : carré couleur brand `#e0625a` avec un
// disque blanc et un disque brand au centre — à remplacer par les exports
// du designer dès que disponibles.
//
// Pure Node : encodage PNG raw via zlib + CRC32, aucune dépendance externe.
// Usage : `node scripts/generate-pwa-icons.mjs`

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "public", "icons");

const BRAND = { r: 0xe0, g: 0x62, b: 0x5a };
const WHITE = { r: 0xff, g: 0xff, b: 0xff };

// CRC32 table (precomputed à la première utilisation).
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// `maskable` : pas de transparence sur les bords (le système peut découper
// jusqu'à 20% sur chaque bord), donc fond plein brand.
// `any` : disque blanc + disque brand centré, lisible en miniature.
function renderPixel(x, y, size, opts) {
  const cx = size / 2;
  const cy = size / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Padding pour les icônes maskable : on s'arrête au cercle inscrit dans
  // la safe zone (rayon = size * 0.4).
  const innerRadius = size * 0.38;
  const dotRadius = size * 0.12;

  // Fond brand toujours.
  if (opts.variant === "maskable") {
    if (dist < innerRadius) return WHITE;
    return BRAND;
  }

  // `any` / apple-touch : carré brand avec coins arrondis + disque blanc +
  // disque brand central pour évoquer un "œil" graphique.
  const cornerRadius = size * 0.22;
  // Distance Manhattan-style aux coins pour faire un radius propre.
  const insetX = Math.min(x, size - 1 - x);
  const insetY = Math.min(y, size - 1 - y);
  if (insetX < cornerRadius && insetY < cornerRadius) {
    const dxCorner = cornerRadius - insetX;
    const dyCorner = cornerRadius - insetY;
    const cornerDist = Math.sqrt(dxCorner * dxCorner + dyCorner * dyCorner);
    if (cornerDist > cornerRadius) {
      return null; // transparent (coin)
    }
  }

  if (dist < dotRadius) return BRAND;
  if (dist < innerRadius) return WHITE;
  return BRAND;
}

function buildImage(size, variant) {
  // Buffer ligne par ligne : 1 byte filter + size * 4 bytes RGBA.
  const rowSize = 1 + size * 4;
  const raw = Buffer.alloc(rowSize * size);

  for (let y = 0; y < size; y += 1) {
    raw[y * rowSize] = 0; // filter "None"
    for (let x = 0; x < size; x += 1) {
      const offset = y * rowSize + 1 + x * 4;
      const px = renderPixel(x, y, size, { variant });
      if (px === null) {
        raw[offset] = 0;
        raw[offset + 1] = 0;
        raw[offset + 2] = 0;
        raw[offset + 3] = 0; // transparent
      } else {
        raw[offset] = px.r;
        raw[offset + 1] = px.g;
        raw[offset + 2] = px.b;
        raw[offset + 3] = 0xff; // opaque
      }
    }
  }

  // IHDR : width (4) + height (4) + bit depth (1) + color type (1=RGBA=6)
  // + compression (0) + filter (0) + interlace (0).
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const idat = deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function writeIcon(name, size, variant) {
  const buf = buildImage(size, variant);
  const path = resolve(OUT_DIR, name);
  writeFileSync(path, buf);
  process.stdout.write(`  ✔ ${name} (${size}×${size}, ${variant}, ${buf.length} B)\n`);
}

mkdirSync(OUT_DIR, { recursive: true });
process.stdout.write(`Génération des icônes PWA dans ${OUT_DIR}\n`);
writeIcon("icon-192.png", 192, "any");
writeIcon("icon-512.png", 512, "any");
writeIcon("icon-512-maskable.png", 512, "maskable");
writeIcon("apple-touch-icon.png", 180, "any");
process.stdout.write("Done.\n");
