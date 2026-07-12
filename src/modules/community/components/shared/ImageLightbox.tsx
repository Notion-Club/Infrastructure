"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ImageLightboxProps {
  url: string;
  alt?: string;
  onClose: () => void;
}

// Lightbox plein écran partagée pour toutes les images du module community
// (posts, comments, replies, DM future). Pattern :
//   - Backdrop dim + blur, click sur le backdrop ferme.
//   - Bouton X en haut-droite + touche Échap.
//   - Image en object-fit: contain à max 90vw/90vh.
//   - Body scroll lock pendant l'affichage.
//
// Volontairement minimaliste : pas de pan/zoom custom, le pinch-to-zoom
// natif du navigateur fonctionne pour les écrans tactiles.
export function ImageLightbox({ url, alt = "", onClose }: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu agrandi de l'image"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "nc-mode-in 180ms var(--nc-ease) both",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer l'aperçu"
        data-fb-label="Bouton Fermer · Aperçu image"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.12)",
          color: "white",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "background var(--nc-duration-xfast) var(--nc-ease)",
        }}
        className="hover:bg-white/25"
      >
        <X size={18} />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        data-fb-label="Image agrandie · Aperçu image"
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          objectFit: "contain",
          borderRadius: 12,
          boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.5)",
          display: "block",
          cursor: "default",
        }}
      />
    </div>,
    document.body,
  );
}
