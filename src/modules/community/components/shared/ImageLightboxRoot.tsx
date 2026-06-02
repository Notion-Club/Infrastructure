"use client";

import { useEffect, useState } from "react";
import { ImageLightbox } from "./ImageLightbox";

// Listener global qui écoute les événements 'nc-image-open' émis par
// linkify.tsx quand l'utilisateur clique sur une image inline rendue dans
// un body de post / commentaire / reply.
//
// On évite ainsi de propager un onImageClick à travers tous les call sites
// de renderBodyRich (PostCard, CommentItem, CommentReplyItem, PostDetail).
// Le pattern est inspiré du DOM CustomEvent : un seul listener, un seul
// composant lightbox monté dans le layout community.
//
// Side-effect : le composant doit être monté EN HAUT de la hiérarchie
// community (typiquement dans le layout / la page racine de /communaute)
// pour intercepter tous les clics descendants.
export function ImageLightboxRoot() {
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  useEffect(() => {
    function onOpen(e: Event) {
      const ce = e as CustomEvent<{ url?: string }>;
      const url = ce.detail?.url;
      if (typeof url === "string" && url.length > 0) {
        setOpenUrl(url);
      }
    }
    window.addEventListener("nc-image-open", onOpen);
    return () => window.removeEventListener("nc-image-open", onOpen);
  }, []);

  if (!openUrl) return null;
  return <ImageLightbox url={openUrl} onClose={() => setOpenUrl(null)} />;
}
