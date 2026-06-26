"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Règle de navigation des cours : un « retour arrière » depuis une leçon ne doit
// JAMAIS revenir au cours précédent (cours 3 → cours 2 → cours 1…), mais ramener
// vers la page de la formation avec le module de la leçon courante (= la dernière
// vidéo lue) déplié.
//
// Mécanique : à l'ouverture d'une leçon on insère une entrée d'historique
// « tampon » (même URL). Le premier back y atterrit → `popstate` → on remplace
// par `/formation/{program}?module={module}` (param qui déclenche l'ouverture +
// le scroll du module, cf. ProgramView/ModuleAccordion). `replace` (et non push)
// pour ne pas ré-empiler une entrée à reverser.
export function LessonBackGuard({
  programSlug,
  moduleSlug,
}: {
  programSlug: string;
  moduleSlug: string;
}) {
  const router = useRouter();
  // Évite un double tampon en StrictMode dev (effet monté deux fois sur la même
  // instance) → sinon il faudrait deux « back ». Une instance = une leçon.
  const buffered = useRef(false);

  useEffect(() => {
    const target = `/formation/${programSlug}?module=${moduleSlug}`;
    if (!buffered.current) {
      window.history.pushState(null, "", window.location.href);
      buffered.current = true;
    }

    function onPop() {
      router.replace(target);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [programSlug, moduleSlug, router]);

  return null;
}
