"use client";

import { useEffect } from "react";

// ============================================================================
// ScrollLockBridge — propage le verrou de scroll des modales au shell.
//
// Depuis le passage en app-shell, le DOCUMENT ne scrolle plus : c'est le
// conteneur `#app-scroll` qui porte le scroll des routes (app). Or les ~9
// modales du projet verrouillent le fond via `document.body.style.overflow =
// "hidden"`, ce qui est désormais sans effet (le body ne scrolle pas).
//
// Plutôt que de modifier chaque modale, on OBSERVE le style du <body> et on
// MIROIR l'état overflow sur `#app-scroll`. Toutes les modales — présentes et
// futures — re-verrouillent donc correctement le fond, sans changer leur code.
//
// Léger : un seul MutationObserver sur l'attribut `style` du body.
// ============================================================================
export function ScrollLockBridge() {
  useEffect(() => {
    const scroller = document.getElementById("app-scroll");
    if (!scroller) return;
    const body = document.body;

    const sync = () => {
      const locked = body.style.overflow === "hidden";
      // "" → retombe sur la règle CSS .nc-app-scroll (overflow-y:auto).
      scroller.style.overflow = locked ? "hidden" : "";
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(body, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, []);

  return null;
}
