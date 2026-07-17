import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ancre la root du workspace ici (sinon Turbopack remonte jusqu'à un autre
  // package-lock.json plus haut dans l'arbo iCloud, cf. warning au build).
  // process.cwd() est universel (CJS + ESM, local + Vercel) ; __dirname
  // n'existe pas en ESM, ce qui plantait next.config.ts à l'exécution.
  // Note OPS-63 : ce commentaire a été touché pour invalider le cache Vercel
  // après la migration ressources mock → Notion live.
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    viewTransition: true,
    // Router Cache côté client : par défaut, Next 16 fixe `dynamic: 0`, ce qui
    // refait un fetch RSC complet à CHAQUE navigation — même pour une page déjà
    // ouverte dans la session (et même au retour navigateur), puisque toutes les
    // pages (app)/ sont dynamiques (cookies Supabase). On garde le payload d'une
    // route visitée 30 min en mémoire → une page déjà chargée n'est JAMAIS
    // rechargée tant qu'on reste dans la session (revisite instantanée, sans
    // re-skeleton ni nouvel aller-retour serveur). C'est ce qui donne le ressenti
    // « une fois chargé, ça reste chargé ».
    //
    // Fraîcheur préservée : les mutations locales (router.refresh /
    // revalidatePath après un post/message) invalident l'entrée, et le module
    // community rattrape les updates distants via ses souscriptions Realtime au
    // remontage → le cache long n'affiche pas de données périmées à l'usage.
    staleTimes: { dynamic: 1800, static: 300 },
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
      {
        // Storage public Supabase — avatars + community media. Hostname
        // générique pour matcher tous les projects refs (Prod + Preview)
        // sans avoir à le redéployer.
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
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
