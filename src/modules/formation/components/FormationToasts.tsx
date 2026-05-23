"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";

// Affiche un toast quand une garde serveur a redirigé avec ?notice=...
// puis nettoie l'URL. Codes : "denied" (capability), "locked" (drip).
const MESSAGES: Record<string, { text: string; kind: "error" | "default" }> = {
  denied: {
    text: "Cette leçon est réservée aux membres de ce programme.",
    kind: "error",
  },
  locked: {
    text: "Termine la leçon précédente pour débloquer celle-ci.",
    kind: "default",
  },
  not_found: {
    text: "Cette leçon est introuvable.",
    kind: "error",
  },
};

export function FormationToasts() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const notice = params.get("notice");

  useEffect(() => {
    if (!notice) return;
    const msg = MESSAGES[notice];
    if (msg) {
      if (msg.kind === "error") toast.error(msg.text);
      else toast(msg.text, { icon: <Lock size={14} /> });
    }
    router.replace(pathname, { scroll: false });
  }, [notice, pathname, router]);

  return null;
}
