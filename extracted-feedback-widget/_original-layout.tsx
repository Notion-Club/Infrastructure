import type { Metadata } from "next";
import FeedbackWidgetLoader from "./components/FeedbackWidget/FeedbackWidgetLoader";
import "./globals.css";

const FAVICON_URL =
  "https://pub-b61ce5a39cc042cabc94943b3c8f74b4.r2.dev/photos-site/Logo%20Serenity%20Plus.png";

export const metadata: Metadata = {
  title: "Swiss Serenity Plus — Bras droit externalisé en Suisse romande",
  description: "Bras droit externalisé haut de gamme pour entrepreneurs et PME en Suisse romande.",
  icons: {
    icon: [
      { url: FAVICON_URL, type: "image/png" },
    ],
    shortcut: [{ url: FAVICON_URL, type: "image/png" }],
    apple: [{ url: FAVICON_URL, type: "image/png" }],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "name": "Swiss Serenity Plus",
  "alternateName": "Bras droit business externalisé",
  "image": "https://swiss-serenity-plus.ch/logo.png",
  "url": "https://swiss-serenity-plus.ch",
  "telephone": "+41762198513",
  "email": "mireille.dayer@swiss-serenity-plus.ch",
  "founder": { "@type": "Person", "name": "Mireille Dayer" },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Chemin de Clavoz 18",
    "postalCode": "1950",
    "addressLocality": "Sion",
    "addressRegion": "Valais",
    "addressCountry": "CH"
  },
  "areaServed": [
    { "@type": "AdministrativeArea", "name": "Canton du Valais" },
    { "@type": "AdministrativeArea", "name": "Canton de Vaud" },
    { "@type": "AdministrativeArea", "name": "Canton de Fribourg" },
    { "@type": "AdministrativeArea", "name": "Canton de Genève" }
  ],
  "description": "Bras droit business et commercial externalisé pour dirigeants de PME et particuliers en Suisse romande."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <FeedbackWidgetLoader />
      </body>
    </html>
  );
}
