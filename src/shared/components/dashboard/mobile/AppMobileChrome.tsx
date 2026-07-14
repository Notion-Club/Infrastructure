"use client";

import { usePathname } from "next/navigation";
import { MobileBrandLogo } from "./MobileBrandLogo";
import { MobileTopActions } from "./MobileTopActions";
import { BottomNav } from "./BottomNav";
import { PwaBottomFrost } from "./PwaBottomFrost";

// Chrome mobile FIXE (logo, actions, BottomNav, frost bas) — rendu pour toutes
// les routes app SAUF /communaute*.
//
// Sur /communaute, ce même chrome est rendu DANS le ViewportFrame (règle
// d'unicité du référentiel §2.1) : il suit alors la zone visible quand WebKit
// décale le viewport au clavier. usePathname garantit une SEULE instance
// simultanée — ici OU dans le frame, jamais les deux (pas de duplication). Le
// prix assumé : ces composants se remontent en entrant/sortant de /communaute
// (la pilule de nav se re-snap au mount, comportement déjà existant à la nav).
export function AppMobileChrome() {
  const pathname = usePathname();
  if (pathname.startsWith("/communaute")) return null;
  return (
    <div className="md:hidden">
      <MobileBrandLogo />
      <MobileTopActions />
      <BottomNav />
      <PwaBottomFrost />
    </div>
  );
}
