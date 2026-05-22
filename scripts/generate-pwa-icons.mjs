#!/usr/bin/env node
// Génère les 4 icônes PNG nécessaires à l'installation PWA depuis le master
// `scripts/pwa-icon-source.png` (1080×1080, fond noir, logo NotionClub
// blanc avec coins crantés).
//
// Sortie dans `public/icons/` :
//   • apple-touch-icon.png   180×180  — iOS Safari (écran d'accueil)
//   • icon-192.png           192×192  — Chrome / Edge / Firefox (purpose any)
//   • icon-512.png           512×512  — PWA Android, splash, listing
//   • icon-512-maskable.png  512×512  — adaptive icons Android (purpose maskable)
//
// Le source a déjà ~15% de padding noir autour du logo, ce qui suffit pour
// le purpose `maskable` (Android peut découper jusqu'à 20% des bords ; le
// logo reste centré dans la safe zone).
//
// Dépendance : `sharp` (devDependency). Usage : `node scripts/generate-pwa-icons.mjs`.

import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(__dirname, "pwa-icon-source.png");
const OUT_DIR = resolve(__dirname, "..", "public", "icons");

if (!existsSync(SOURCE)) {
  console.error(`✗ Source introuvable : ${SOURCE}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
process.stdout.write(`Génération des icônes PWA dans ${OUT_DIR}\n`);

// Background noir explicite : compress en RGB (3 canaux, sans alpha) pour
// qu'iOS, qui ignore la transparence sur apple-touch-icon, n'affiche pas
// de fallback noir bizarre — on lui sert directement un PNG opaque.
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

async function build(name, size) {
  const path = resolve(OUT_DIR, name);
  // `cover` garde le ratio carré (source 1:1) ; le `flatten` aplatit toute
  // transparence éventuelle sur fond noir pour rester cohérent.
  await sharp(SOURCE)
    .resize(size, size, { fit: "cover", kernel: "lanczos3" })
    .flatten({ background: BLACK })
    .png({ compressionLevel: 9 })
    .toFile(path);
  process.stdout.write(`  ✔ ${name} (${size}×${size})\n`);
}

await build("apple-touch-icon.png", 180);
await build("icon-192.png", 192);
await build("icon-512.png", 512);
await build("icon-512-maskable.png", 512);

process.stdout.write("Done.\n");
