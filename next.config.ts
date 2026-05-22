import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ancre la root du workspace ici (sinon Turbopack remonte jusqu'à un autre
  // package-lock.json plus haut dans l'arbo iCloud, cf. warning au build).
  // process.cwd() est universel (CJS + ESM, local + Vercel) ; __dirname
  // n'existe pas en ESM, ce qui plantait next.config.ts à l'exécution.
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    viewTransition: true,
    // Avatars sont upload-és via Server Action en FormData. La limite par
    // défaut de Next (1 MB) refuse le payload AVANT d'atteindre notre
    // validation métier (AVATAR_MAX_BYTES = 5 MB) et renvoie un message
    // d'erreur cryptique côté client. On passe à 7 MB pour laisser une
    // marge à l'overhead FormData au-dessus de notre vraie limite.
    serverActions: { bodySizeLimit: "7mb" },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dceobxyts/**",
      },
    ],
  },
};

// Note PWA : les headers HTTP critiques (`Cache-Control` no-cache sur
// `/sw.js`, `Service-Worker-Allowed: /`, cache court sur le manifest)
// vivent dans `vercel.json` à la racine du repo. Une définition via
// `async headers()` ici cassait l'étape "Applying modifyConfig from
// Vercel" sur Next 16.2 + Vercel CLI 54 (cf. PR #62, déploiement du
// 2026-05-22).

export default nextConfig;
