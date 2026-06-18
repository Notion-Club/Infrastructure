"use client";

import Image from "next/image";
import Link from "next/link";

import { useTheme } from "@/shared/lib/hooks/useTheme";

// Logo Notion Club du header mobile — pendant gauche des trois cercles
// (devtool / notifications / profil) de MobileTopActions. Cliquer renvoie à
// l'accueil. Theme-aware comme la Topbar desktop (même couple d'URLs
// Cloudinary). Rendu `fixed` côté layout via la classe `.nc-mobile-logo`.

const LOGO_LIGHT =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777034233/Notion_Club_-_Black_-_Sans_BG_hcvk9k.png";
const LOGO_DARK =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777935553/Notion_Club_-_White_-_Sans_BG_du43oh.png";

export function MobileBrandLogo() {
  const { theme } = useTheme();

  return (
    <Link
      href="/dashboard"
      aria-label="Notion Club, retour à l'accueil"
      data-fb-label="Logo Notion Club · Barre de navigation mobile"
      className="nc-mobile-logo"
    >
      <Image
        src={theme === "dark" ? LOGO_DARK : LOGO_LIGHT}
        alt="Notion Club"
        width={120}
        height={40}
        priority
        style={{ height: 26, width: "auto", display: "block" }}
      />
    </Link>
  );
}
