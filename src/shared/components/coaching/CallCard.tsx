"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { AlignJustify, X, ExternalLink } from "lucide-react";
import type { CallCardData } from "@/shared/lib/mock/coaching";
import { CallDetailModal } from "@/shared/components/coaching/CallDetailModal";

// Au branchement backend — remplacer par de vraies URLs Cloudinary pour les photos de profil des coaches
const HOST_PROFILES: Record<string, { initials: string; bg: string }> = {
  Théo: { initials: "TG", bg: "#e0625a" },
  Noah: { initials: "NL", bg: "#7c3aed" },
};

const CHATGPT_LOGO =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1776436270/ChatGPT-Logo.svg_rip8m0.png";
const CLAUDE_LOGO =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777030411/IMG_1961_flp3vm.png";

// Construit le prompt pré-rempli envoyé en query string à ChatGPT/Claude.
// Le `transcriptUrl` est un lien PUBLIC signé HMAC (24h) vers la transcription
// brute servie en text/plain.
//
// On explicite à l'IA que c'est un lien public web (pas une URL privée
// nécessitant auth) sinon ChatGPT refuse de fetcher avec son browse tool —
// il croit que c'est une ressource protégée à cause du token long. Claude
// n'a pas ce problème mais le wording bénéficie aux deux.
function buildAIPrompt(host: string, transcriptUrl: string): string {
  return `Ouvre cette page web publique avec ton outil de navigation web, lis l'intégralité de la transcription qui s'y trouve, puis aide-moi à en tirer des actions concrètes et réponds à mes questions de suivi sur mon appel coaching avec ${host} (notionclub.fr).

Page à lire : ${transcriptUrl}

Cette URL est un lien public — tu peux et dois la fetch via ton outil web. Ce n'est pas une ressource protégée nécessitant une authentification.`;
}

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return datePart.charAt(0).toUpperCase() + datePart.slice(1);
}

function getUpcomingLabel(iso: string): string {
  const diffDays = Math.ceil(
    (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  return `Dans ${diffDays} jours`;
}

const STATUS_STYLES = {
  accepted: { bg: "var(--nc-status-accepted-bg)", text: "var(--nc-status-accepted-text)", label: "Effectué" },
  no_show: { bg: "var(--nc-status-noshown-bg)", text: "var(--nc-status-noshown-text)", label: "No-show" },
  upcoming: { bg: "var(--nc-status-upcoming-bg)", text: "var(--nc-status-upcoming-text)", label: "" },
} as const;

interface CallCardProps {
  call: CallCardData;
  archived?: boolean;
}

export function CallCard({ call, archived = false }: CallCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isUpcoming = call.status === "upcoming";
  const isExpandable = !isUpcoming;
  const hasSummary = !!call.ai_summary;
  const hasDetail = hasSummary || !!call.notion_page_id;
  const hasTranscriptUrl = !!call.transcript_url;
  const hasFathom = !!call.fathom_url;
  const statusStyle = STATUS_STYLES[call.status];
  const host = HOST_PROFILES[call.host] ?? { initials: call.host[0] ?? "?", bg: "#6b7280" };

  function handleToggle() {
    if (!isExpandable) return;
    if (!isOpen) {
      // Wait for the expand animation (400ms) then scroll card bottom into view
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 420);
    }
    setIsOpen((o) => !o);
  }

  function closeCard() {
    setIsOpen(false);
  }

  return (
    // Clic sur le fond/bords de l'encadré ferme l'accordéon
    <div
      ref={cardRef}
      data-fb-label="Carte appel · Carte appel"
      onClick={() => { if (isOpen) closeCard(); }}
      style={{
        background: "var(--color-surface-card)",
        border: `1px solid ${isOpen ? "rgba(224,98,90,0.25)" : "var(--color-border-default)"}`,
        borderRadius: 14,
        overflow: "hidden",
        opacity: archived ? 0.75 : 1,
        transition: "border-color 200ms ease, box-shadow 200ms ease",
        boxShadow: isOpen
          ? "0 4px 24px rgba(224,98,90,0.07), 0 1px 3px rgba(0,0,0,0.04)"
          : "none",
        cursor: isOpen && isExpandable ? "pointer" : "default",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        role={isExpandable ? "button" : undefined}
        tabIndex={isExpandable ? 0 : undefined}
        onClick={(e) => { e.stopPropagation(); handleToggle(); }}
        onKeyDown={(e) => e.key === "Enter" && handleToggle()}
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 18px",
          cursor: isExpandable ? "pointer" : "default",
          userSelect: "none",
          background: "var(--color-surface-card)",
          transition: "background 200ms ease",
        }}
        className={isExpandable ? "hover:bg-[rgba(0,0,0,0.018)]" : ""}
      >
        {/* Left — title + date + host */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            data-fb-label="Titre · Carte appel"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--color-text-primary)",
              margin: 0,
              lineHeight: 1.3,
              letterSpacing: "-0.01em",
            }}
          >
            {call.subject}
          </h2>

          {/* Date + host avatar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 5,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "var(--color-text-muted)",
                lineHeight: 1,
              }}
            >
              {formatDateLong(call.date)} avec
            </span>

            {/* Host avatar : photo Notion si dispo, sinon initiales colorées */}
            <div
              data-fb-label="Avatar coach · Carte appel"
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: host.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {call.host_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={call.host_avatar_url}
                  alt={call.host}
                  width={22}
                  height={22}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: "#fff",
                    letterSpacing: "0.02em",
                    lineHeight: 1,
                  }}
                >
                  {host.initials}
                </span>
              )}
            </div>

            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                lineHeight: 1,
              }}
            >
              {call.host}
            </span>

            {/* Pill "À venir" pour les calls non expandables */}
            {isUpcoming && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: statusStyle.text,
                  background: statusStyle.bg,
                  borderRadius: 9999,
                  padding: "2px 9px",
                  flexShrink: 0,
                }}
              >
                {getUpcomingLabel(call.date)}
              </span>
            )}
          </div>
        </div>

        {/* Right — toggle icon (burger → croix) */}
        {isExpandable && (
          <div
            aria-label={isOpen ? "Fermer les détails" : "Voir les détails"}
            data-fb-label="Bouton détails · Carte appel"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: isOpen
                ? "rgba(224,98,90,0.1)"
                : "rgba(0,0,0,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 1,
              position: "relative",
              transition: "background 200ms ease",
            }}
          >
            {/* Burger icon */}
            <AlignJustify
              size={15}
              style={{
                position: "absolute",
                color: isOpen ? "var(--color-brand)" : "var(--color-text-muted)",
                opacity: isOpen ? 0 : 1,
                transform: isOpen ? "rotate(90deg) scale(0.6)" : "rotate(0) scale(1)",
                transition:
                  "opacity 220ms cubic-bezier(0.22,1,0.36,1), transform 220ms cubic-bezier(0.22,1,0.36,1)",
              }}
            />
            {/* X icon */}
            <X
              size={15}
              style={{
                position: "absolute",
                color: "var(--color-brand)",
                opacity: isOpen ? 1 : 0,
                transform: isOpen ? "rotate(0) scale(1)" : "rotate(-90deg) scale(0.6)",
                transition:
                  "opacity 220ms cubic-bezier(0.22,1,0.36,1), transform 220ms cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          </div>
        )}
      </div>

      {/* ── Expandable body ────────────────────────────────────── */}
      {isExpandable && (
        <div
          style={{
            maxHeight: isOpen ? 640 : 0,
            overflow: "hidden",
            transition: "max-height 400ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <div
            style={{
              padding: "0 18px 18px",
              borderTop: "1px solid var(--color-border-default)",
              paddingTop: 16,
            }}
          >
            {/* Pill no-show uniquement — "Effectué" est redondant dans le détail */}
            {call.status === "no_show" && (
              <span
                style={{
                  display: "inline-block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: statusStyle.text,
                  background: statusStyle.bg,
                  borderRadius: 9999,
                  padding: "3px 10px",
                  marginBottom: 16,
                }}
              >
                {statusStyle.label}
              </span>
            )}

            {/* Ask AI buttons — gated par la présence d'une URL signée vers
                la transcription brute publique (24h). On envoie l'URL à
                ChatGPT/Claude qui la lisent via leur browse tool : pas de
                limite query string, pas de troncature du résumé. */}
            {hasTranscriptUrl && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  <a
                    href={`https://chatgpt.com/?q=${encodeURIComponent(
                      buildAIPrompt(call.host, call.transcript_url!)
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-fb-label="Bouton Demander à ChatGPT · Carte appel"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      padding: "8px 12px",
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-border-default)",
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                      textDecoration: "none",
                      transition: "background 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
                    }}
                    className="hover:bg-[#f0fdf4] hover:border-[#86efac] hover:shadow-[0_2px_8px_rgba(34,197,94,0.12)] dark:hover:bg-[rgba(34,197,94,0.07)] dark:hover:border-[rgba(134,239,172,0.2)] dark:hover:shadow-none"
                  >
                    <Image
                      src={CHATGPT_LOGO}
                      alt=""
                      width={15}
                      height={15}
                      style={{ display: "block", flexShrink: 0 }}
                    />
                    Demander à ChatGPT
                  </a>

                  <a
                    href={`https://claude.ai/new?q=${encodeURIComponent(
                      buildAIPrompt(call.host, call.transcript_url!)
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-fb-label="Bouton Demander à Claude · Carte appel"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      padding: "8px 12px",
                      background: "var(--color-surface-raised)",
                      border: "1px solid var(--color-border-default)",
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                      textDecoration: "none",
                      transition: "background 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
                    }}
                    className="hover:bg-[#fff8f7] hover:border-[rgba(224,98,90,0.35)] hover:shadow-[0_2px_8px_rgba(224,98,90,0.12)] dark:hover:bg-[rgba(224,98,90,0.07)] dark:hover:border-[rgba(224,98,90,0.28)] dark:hover:shadow-none"
                  >
                    <Image
                      src={CLAUDE_LOGO}
                      alt=""
                      width={15}
                      height={15}
                      style={{ display: "block", flexShrink: 0, borderRadius: 3 }}
                    />
                    Demander à Claude
                  </a>
                </div>
                <div style={{ height: 1, background: "var(--color-border-default)", marginBottom: 14 }} />
              </>
            )}

            {hasSummary ? (
              <>
                {/* Section résumé */}
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    margin: "0 0 8px",
                  }}
                >
                  Résumé du coaching
                </p>

                {/* Aperçu tronqué (3 lignes max) — le résumé complet
                    structuré s'ouvre dans une modale au clic Voir plus. */}
                <div
                  style={{
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      color: "var(--color-text-secondary)",
                      lineHeight: 1.65,
                      margin: 0,
                    }}
                  >
                    {call.ai_summary}
                  </p>
                </div>

                {hasDetail && (
                  <button
                    type="button"
                    data-fb-label="Bouton Voir le détail · Carte appel"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailModalOpen(true);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "5px 0 0",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--color-brand)",
                      cursor: "pointer",
                      display: "block",
                    }}
                  >
                    Voir le détail →
                  </button>
                )}

                {/* Warning IA */}
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    margin: "10px 0 0",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 4,
                  }}
                >
                  <span>⚠️</span>
                  <span>Résumé généré par IA, peut contenir des imprécisions</span>
                </p>
              </>
            ) : (
              <>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-muted)",
                    margin: "8px 0 0",
                    fontStyle: "italic",
                  }}
                >
                  Pas de résumé disponible pour ce coaching.
                </p>
                {hasDetail && (
                  <button
                    type="button"
                    data-fb-label="Bouton Voir le détail · Carte appel"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailModalOpen(true);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "5px 0 0",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--color-brand)",
                      cursor: "pointer",
                      display: "block",
                    }}
                  >
                    Voir le détail →
                  </button>
                )}
              </>
            )}

            {/* ── Bouton Fathom (lien externe) ─────────────────────── */}
            {hasFathom && (
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1px dashed var(--color-border-default)",
                }}
              >
                <a
                  href={call.fathom_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-fb-label="Bouton Ouvrir dans Fathom · Carte appel"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    background: "var(--color-surface-raised)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 9999,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                    textDecoration: "none",
                    transition: "background 180ms ease, border-color 180ms ease",
                  }}
                >
                  <ExternalLink size={13} style={{ flexShrink: 0 }} />
                  Ouvrir dans Fathom
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale détail (onglets Résumé / Transcript) — montée seulement
          quand ouverte. */}
      {hasDetail && (
        <CallDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          subject={call.subject}
          summary={call.ai_summary ?? ""}
          host={call.host}
          date={call.date}
          notionPageId={call.notion_page_id ?? null}
        />
      )}
    </div>
  );
}
