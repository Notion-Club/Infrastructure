import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { Toaster } from "@/shared/components/ui/sonner";
import { ThemeProvider } from "@/shared/components/theme/ThemeProvider";
import ServiceWorkerRegistrar from "@/shared/components/pwa/ServiceWorkerRegistrar";
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
  description: "Plateforme de delivery — Notion Club.",
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
    // Conséquence : le contenu *sous* la zone status bar doit fournir
    // assez de contraste pour que le texte blanc reste lisible. En dark
    // mode la page est déjà sombre — pas d'action. En light mode, on
    // ajoute un dégradé sombre subtil en haut via `.nc-statusbar-scrim`
    // (cf. globals.css) pour ne pas perdre la lisibilité.
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
  // Theme-color per scheme : la valeur n'est pas utilisée par iOS PWA en
  // mode `black-translucent` (status bar transparente), mais reste consommée
  // par Chrome Android pour colorer sa barre d'adresse, et par certains
  // navigateurs desktop pour le titre d'onglet.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2f2" },
    { media: "(prefers-color-scheme: dark)", color: "#141211" },
  ],
};

// Inline script runs before paint to avoid a flash of incorrect theme.
// Stored preference can be "light" | "dark" | "system"; "system" falls back
// to prefers-color-scheme.
const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('theme');if(p!=='light'&&p!=='dark'&&p!=='system')p='system';var t=p;if(p==='system'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${sfProDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
        <ServiceWorkerRegistrar />
        {/* Scrim status bar — visible uniquement en PWA standalone + light
            mode (cf. .nc-statusbar-scrim dans globals.css). En dark mode,
            le fond `#141211` suffit à rendre le texte iOS blanc lisible. */}
        <div className="nc-statusbar-scrim" aria-hidden />
      </body>
    </html>
  );
}
