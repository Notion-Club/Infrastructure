import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { Toaster } from "@/shared/components/ui/sonner";
import { ThemeProvider } from "@/shared/components/theme/ThemeProvider";
import ServiceWorkerRegistrar from "@/shared/components/pwa/ServiceWorkerRegistrar";
import { ThemeColorMeta } from "@/shared/components/theme/ThemeColorMeta";
import { IOS_SPLASH_LINKS } from "@/shared/components/pwa/iosSplashLinks";
import { GradualBlurOverlay } from "@/shared/components/GradualBlurOverlay";
import { sfProDisplay } from "@/shared/lib/fonts";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// PWA — métadonnées consommées par les navigateurs pour proposer
// l'installation (manifest) et par iOS Safari pour le mode standalone
// (apple-mobile-web-app-*). Next génère automatiquement les link/meta tags
// correspondants depuis ce bloc.
export const metadata: Metadata = {
  title: "Notion Club",
  description: "Plateforme de delivery · Notion Club.",
  manifest: "/manifest.webmanifest",
  applicationName: "Notion Club",
  appleWebApp: {
    capable: true,
    title: "Notion Club",
    // `black-translucent` rend la zone status bar **transparente** : la
    // page s'étend jusqu'au bord supérieur du téléphone (zéro seam visible
    // entre la status bar et la page). Le texte iOS (heure, signal,
    // batterie) reste affiché en blanc par-dessus.
    //
    // Pour la lisibilité du texte iOS blanc, le fond unique `.nc-app-bg`
    // intègre un léger fondu sombre en haut (dans le même calque dégradé,
    // pas de voile `backdrop-filter` superposé) — cf. globals.css.
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: {
    telephone: false,
  },
  // Next 16 émet uniquement le tag standard `mobile-web-app-capable`. iOS
  // 16 / 17 acceptent les deux mais préfèrent encore l'alias `apple-…` ;
  // on ajoute l'ancien nom explicitement pour garantir le mode standalone
  // sur tous les iPhone supportés.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// `viewport-fit=cover` est requis pour que les pages s'étendent sous
// l'encoche iPhone — combiné aux `env(safe-area-inset-*)` déjà utilisés
// dans MobileHeader / BottomNav. `themeColor` aligne la status bar iOS et
// la barre Chrome Android sur la couleur de fond de page (#f5f2f2).
//
// `maximumScale: 1` + `userScalable: false` désactivent l'auto-zoom iOS
// quand l'utilisateur focus un `<input>` ou `<textarea>` dont le
// `font-size` est < 16px — le layout reste figé, on a un comportement
// d'app native. Safari (mode navigateur) ignore `user-scalable=no` pour
// l'accessibilité (pinch zoom toujours possible) mais honore
// `maximumScale=1` pour le zoom au focus, qui est ce qu'on veut bloquer.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // PAS de `themeColor` ici, VOLONTAIREMENT. La balise <meta name="theme-color">
  // est gérée EXCLUSIVEMENT en impératif (script inline pré-paint + `ThemeColorMeta`),
  // jamais par React/Next.
  //
  // Pourquoi : `ThemeColorMeta` doit RETIRER puis RÉ-INSÉRER le <meta> à chaque
  // switch (seul moyen de forcer Safari iOS à relire la teinte quand un overlay
  // `backdrop-filter` est composé par-dessus). Si React possédait aussi une balise
  // theme-color (via `viewport`), ce retrait détacherait un nœud que React croit
  // encore vivant → `removeChild` sur parent null EN PHASE COMMIT à la navigation
  // → tout le commit avorte (navigation figée, dropdown gelé). En laissant React
  // hors de cette balise, le code impératif en est seul propriétaire → zéro
  // conflit. Teintes : #f5f2f2 (clair) / #141211 (sombre) — cf. LIGHT_CHROME /
  // DARK_SURFACE dans ThemeColorMeta et `--color-surface-page` dans globals.
};

// Inline script runs before paint to avoid a flash of incorrect theme.
// Stored preference can be "light" | "dark" | "system"; "system" falls back
// to prefers-color-scheme.
//
// Il pose AUSSI la balise <meta name="theme-color"> de pré-paint, créée
// IMPÉRATIVEMENT (hors React) : c'est ce qui remplace l'ancien `viewport.themeColor`
// supprimé. Avantage vs l'ancienne version `media` : la teinte suit le thème RÉEL
// de l'app (localStorage), pas seulement l'OS. `ThemeColorMeta` reprend ensuite la
// main (retrait/ré-insertion réactive) sur ce même nœud non-React → aucun conflit.
// Teintes synchro avec LIGHT_CHROME / DARK_SURFACE (ThemeColorMeta).
const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('theme');if(p!=='light'&&p!=='dark'&&p!=='system')p='system';var t=p;if(p==='system'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark')document.documentElement.classList.add('dark');var m=document.createElement('meta');m.setAttribute('name','theme-color');m.setAttribute('content',t==='dark'?'#141211':'#f5f2f2');document.head.appendChild(m);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${sfProDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Splash screens iOS — supprime l'écran blanc au démarrage de la PWA
            en mode standalone. iOS affiche l'image dont la media query matche
            la résolution exacte du device (cf. iosSplashLinks.ts). Sans ces
            balises, iOS ne peut RIEN peindre pendant le boot du webview + le
            chargement réseau → blanc total. Générés par
            scripts/generate-ios-splash.mjs. */}
        {IOS_SPLASH_LINKS.map((link) => (
          <link
            key={link.href}
            rel="apple-touch-startup-image"
            media={link.media}
            href={link.href}
          />
        ))}
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/* Fond de marque GLOBAL — un seul calque fixe derrière tout le
            contenu (dégradé d'accents en light, uni en dark). Remplace
            l'ancien dégradé par-page clippé. cf. .nc-app-bg dans globals.css */}
        <div className="nc-app-bg" aria-hidden />
        <ThemeProvider>
          {/* Pilote <meta name="theme-color"> selon le thème réel : surface unie
              #f5f2f2 en clair, near-black en sombre. Le dégradé fond vers cette
              surface en haut/bas → barres Safari sans cassure. Garde aussi `.dark`. */}
          <ThemeColorMeta />
          {children}
        </ThemeProvider>
        <Toaster />
        <ServiceWorkerRegistrar />
        {/* Voile de flou GLOBAL en haut — mobile uniquement, monté ici (root
            layout) → actif sur TOUTES les pages, présentes et à venir.
            `GradualBlurOverlay` = flou progressif PUR (aucune couleur → il
            échantillonne le fond thème-correct, pas de bug de repaint iOS), max
            en haut (zone heure/batterie/réseau) et fondu élégant vers le bas.
            `pointer-events: none` → n'intercepte aucun clic.

            Hauteur = status-bar (`env(safe-area-inset-top)`) + ~52px : couvre
            la zone système ET passe DERRIÈRE la rangée d'icônes (logo z41 /
            actions z40 > ce voile z39) → le contenu ne défile plus « à nu »
            derrière les boutons. ⚙️ Réglage : ajuster le `+52px` (plus court =
            voile plus fin, limité à la status-bar) et le `zIndex`. */}
        <div className="md:hidden">
          <GradualBlurOverlay
            anchor="top"
            height="calc(env(safe-area-inset-top, 0px) + 52px)"
            zIndex={39}
          />
        </div>
      </body>
    </html>
  );
}
