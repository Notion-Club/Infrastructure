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
  // Headers PWA :
  //   • `/sw.js` ne doit JAMAIS être servi depuis un cache (browser ou edge)
  //     sinon une nouvelle version du SW peut mettre des heures à se
  //     propager après un déploiement Vercel.
  //   • Le `Service-Worker-Allowed: /` n'est pas strictement nécessaire
  //     (le SW est servi depuis la racine) mais le rend explicite — utile
  //     si on déplace le fichier plus tard.
  //   • `/manifest.webmanifest` peut être mis en cache court pour réduire
  //     la charge sans bloquer les itérations sur le manifest.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
