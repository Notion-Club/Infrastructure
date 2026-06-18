import type { MetadataRoute } from "next";

// Manifest PWA — généré dynamiquement par Next à l'URL `/manifest.webmanifest`.
// Consommé par :
//   • Chrome / Edge / Firefox / Safari mobile pour proposer l'installation.
//   • iOS Safari (≥ 17.4) pour reconnaître l'app installable depuis l'écran
//     d'accueil — combiné aux balises `apple-mobile-web-app-*` côté layout.
//
// `start_url` est volontairement relatif : la PWA pourra être servie depuis
// app.notionclub.fr en prod ET depuis des previews Vercel sans modification.
// `display: "standalone"` retire le chrome navigateur une fois l'icône
// lancée — c'est le critère #1 de la spec produit (« comme une vraie app »).

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Notion Club",
    short_name: "Notion Club",
    description:
      "Plateforme de delivery Notion Club : formation, communauté, coaching.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f2f2",
    theme_color: "#f5f2f2",
    categories: ["education", "productivity", "business"],
    lang: "fr",
    dir: "ltr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
