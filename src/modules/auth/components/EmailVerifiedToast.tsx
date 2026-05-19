"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Lit ?email_verified=success|invalid après le redirect de /api/verify-email
// et affiche le toast approprié. Nettoie ensuite le param de l'URL pour
// éviter qu'un refresh ne rejoue le toast.
//
// Séparé en composant client minimal (vs dashboard page Server Component) :
// pas de bailout CSR au build, juste cette feuille est hydratée.
export function EmailVerifiedToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const flag = searchParams.get("email_verified");
  const handled = useRef(false);

  useEffect(() => {
    if (!flag || handled.current) return;
    handled.current = true;

    if (flag === "success") {
      toast.success("Email confirmé. Merci 🎉");
    } else if (flag === "invalid") {
      toast.error("Lien invalide ou expiré. Demande un nouvel email.");
    }

    // Nettoie le query param sans recharger ni laisser une entrée d'historique.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("email_verified");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [flag, pathname, router, searchParams]);

  return null;
}
