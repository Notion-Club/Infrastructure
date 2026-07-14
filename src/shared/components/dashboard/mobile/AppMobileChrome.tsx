"use client";

import { usePathname } from "next/navigation";
import { MobileBrandLogo } from "./MobileBrandLogo";
import { MobileTopActions } from "./MobileTopActions";
import { BottomNav } from "./BottomNav";
import { PwaBottomFrost } from "./PwaBottomFrost";

// Chrome mobile FIXE. Le split ne concerne plus que la TOPBAR :
//
// • Topbar (logo + actions) — VISIBLE pendant la saisie → sur /communaute elle
//   doit suivre le pan WebKit, donc elle est rendue DANS le ViewportFrame (pas
//   ici). usePathname l'exclut ici sur /communaute pour éviter la double
//   instance. Ailleurs, elle est rendue ici, ancrée à l'ICB.
//
// • BottomNav + frost — TOUJOURS rendus ici, sur TOUTES les routes (/communaute
//   comprise), ancrés à l'ICB comme partout ailleurs. Une seule instance,
//   jamais remontée → une position unique, identique sur toutes les pages. Sur
//   /communaute ils sont MASQUÉS au clavier (body.nc-kb-open → transform+opacity)
//   donc le pan WebKit ne peut jamais les trahir ; ils n'ont donc pas besoin du
//   frame et ne sont plus esclaves de --nc-vvh (contracté à 894 en PWA).
export function AppMobileChrome() {
  const onCommunaute = usePathname().startsWith("/communaute");
  return (
    <div className="md:hidden">
      {!onCommunaute && (
        <>
          <MobileBrandLogo />
          <MobileTopActions />
        </>
      )}
      <BottomNav />
      <PwaBottomFrost />
    </div>
  );
}
