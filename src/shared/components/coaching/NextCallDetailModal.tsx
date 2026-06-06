"use client";

// Modale ouverte au clic sur la pill "Ton prochain appel" — affiche les détails
// du prochain coaching à venir lus depuis la DB Notion Appels de suivi :
//
//   • Date formatée joliment ("Aujourd'hui à 14:30", "Demain à 10:00", etc.)
//   • Host (nom + avatar Notion people)
//   • Encadré "Objet de la Demande" — rich_text saisi par le membre
//   • CTA "Replanifier ou annuler" → ouvre Reschedule URL dans un nouvel onglet
//
// Pattern strict :
//   - portal vers document.body (échappe au stacking context .nc-page-halo)
//   - SSR-safe via useSyncExternalStore + getServerSnapshot=false
//   - Esc + click-outside ferment + lock body scroll
//
// Si rescheduleUrl est absente côté Notion, le bouton CTA est masqué — pas
// de placeholder broken.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { CalendarClock, ExternalLink, X } from "lucide-react";
import { MacOSWindowBar } from "@/shared/components/ui/MacOSWindowBar";
import { formatNextCallLabel } from "@/shared/lib/coaching/formatNextCallLabel";

function subscribeToMount(): () => void {
  return () => {};
}

interface NextCallDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledAt: string;
  host: string;
  hostAvatarUrl: string | null;
  objectRequest: string | null;
  rescheduleUrl: string | null;
}

export function NextCallDetailModal({
  isOpen,
  onClose,
  scheduledAt,
  host,
  hostAvatarUrl,
  objectRequest,
  rescheduleUrl,
}: NextCallDetailModalProps) {
  const mounted = useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  // Libellé long pour le header de modale — on réutilise le helper de la pill
  // pour rester cohérent (aucun risque que pill et modale racontent une histoire
  // différente côté date).
  const dateLabel = formatNextCallLabel(scheduledAt);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) handleClose();
  }

  return createPortal(
    <div
      onClick={handleOverlayClick}
      data-fb-label="Modale prochain appel · Coaching"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding: "16px",
      }}
    >
      <div
        data-fb-label="Fenêtre prochain appel · Modale prochain appel"
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--color-surface-card)",
          borderRadius: 12,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "nc-modal-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <MacOSWindowBar onClose={handleClose} />

        {/* Header — icône + date formatée */}
        <div style={{ padding: "20px 28px 14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 9999,
                background: "rgba(224,98,90,0.12)",
                color: "var(--color-brand)",
                flexShrink: 0,
              }}
            >
              <CalendarClock size={17} />
            </span>
            <h2
              data-fb-label="Titre date · Modale prochain appel"
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "var(--color-text-primary)",
                margin: 0,
                lineHeight: 1.3,
                letterSpacing: "-0.01em",
              }}
            >
              {dateLabel}
            </h2>
          </div>

          {/* Host — avatar + nom */}
          <div
            data-fb-label="Bloc Host · Modale prochain appel"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 4,
            }}
          >
            {hostAvatarUrl ? (
              <Image
                src={hostAvatarUrl}
                alt={host}
                width={28}
                height={28}
                style={{
                  borderRadius: 9999,
                  display: "block",
                  flexShrink: 0,
                  objectFit: "cover",
                }}
                unoptimized
              />
            ) : (
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9999,
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border-default)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  flexShrink: 0,
                }}
              >
                {host.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--color-text-secondary)",
              }}
            >
              Avec {host}
            </span>
          </div>
        </div>

        {/* Encadré Objet de la Demande — masqué si vide */}
        {objectRequest && (
          <div style={{ padding: "0 28px 16px" }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: "0 0 8px",
              }}
            >
              Objet de la demande
            </p>
            <div
              data-fb-label="Encadré objet de la demande · Modale prochain appel"
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--color-text-primary)",
                whiteSpace: "pre-wrap",
              }}
            >
              {objectRequest}
            </div>
          </div>
        )}

        {/* CTA — Replanifier / annuler (Reschedule URL Notion) */}
        {rescheduleUrl && (
          <div style={{ padding: "0 28px 20px" }}>
            <a
              href={rescheduleUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-fb-label="Bouton replanifier · Modale prochain appel"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                width: "100%",
                padding: "11px 14px",
                background: "var(--color-brand)",
                border: "1px solid var(--color-brand)",
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                textDecoration: "none",
                cursor: "pointer",
                transition: "opacity 180ms ease",
              }}
            >
              <ExternalLink size={15} style={{ flexShrink: 0 }} />
              Replanifier ou annuler
            </a>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: "10px 28px",
            borderTop: "1px solid var(--color-border-default)",
            background: "var(--color-surface-raised)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              background: "transparent",
              border: "1px solid var(--color-border-default)",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-primary)",
              cursor: "pointer",
            }}
          >
            <X size={13} />
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
