"use client";

import { useState } from "react";
import Image from "next/image";
import { Phone } from "lucide-react";
import type { MockCall } from "@/shared/lib/mock/coaching";

const SUMMARY_CHAR_LIMIT = 300;

const CHATGPT_LOGO =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1776436270/ChatGPT-Logo.svg_rip8m0.png";
const CLAUDE_LOGO =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777030411/IMG_1961_flp3vm.png";

function buildAIPrompt(host: string, transcript: string): string {
  return `Dans le cadre de mes projets autour de Notion, je vais te poser des questions sur base de la transcription de l'appel que j'ai eu avec ${host}, coach au notionclub.fr : ${transcript}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return day.charAt(0).toUpperCase() + day.slice(1) + ", " + time;
}

function getUpcomingLabel(iso: string): string {
  const now = new Date();
  const callDate = new Date(iso);
  const diffDays = Math.ceil(
    (callDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  return `Dans ${diffDays} jours`;
}

const STATUS_STYLES = {
  accepted: { bg: "#dcfce7", text: "#166534", label: "Effectué" },
  no_show: { bg: "#fee2e2", text: "#991b1b", label: "No-show" },
  upcoming: { bg: "#fef3f2", text: "#e0625a", label: "" }, // dynamic label
} as const;

interface CallCardProps {
  call: MockCall;
  archived?: boolean;
}

export function CallCard({ call, archived = false }: CallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isUpcoming = call.status === "upcoming";
  const hasSummary = !!call.ai_summary;
  const isTruncatable =
    hasSummary && call.ai_summary!.length > SUMMARY_CHAR_LIMIT;

  const statusStyle = STATUS_STYLES[call.status];
  const pillLabel = isUpcoming
    ? getUpcomingLabel(call.date)
    : statusStyle.label;

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid var(--color-border-default)",
        borderRadius: 16,
        padding: "20px 24px",
        opacity: archived ? 0.75 : 1,
        transition: "box-shadow 200ms ease",
        position: "relative",
      }}
      className="hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
    >
      {/* Archived tag */}
      {archived && (
        <span
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            fontSize: 11,
            fontWeight: 600,
            color: "#6b7280",
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
            borderRadius: 9999,
            padding: "2px 8px",
          }}
        >
          Archivé
        </span>
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(224, 98, 90, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <Phone size={16} style={{ color: "var(--color-brand)" }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {formatDate(call.date)}
          </p>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-muted)",
              margin: "2px 0 0",
            }}
          >
            avec {call.host}
          </p>
        </div>
      </div>

      {/* Status pill */}
      <div style={{ marginTop: 12 }}>
        <span
          style={{
            display: "inline-block",
            fontSize: 12,
            fontWeight: 600,
            color: statusStyle.text,
            background: statusStyle.bg,
            borderRadius: 9999,
            padding: "3px 10px",
          }}
        >
          {pillLabel}
        </span>
      </div>

      {/* Subject */}
      <div style={{ marginTop: 14 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: "0 0 4px",
          }}
        >
          Objet de la demande
        </p>
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-secondary)",
            margin: 0,
            fontStyle: "italic",
          }}
        >
          &ldquo;{call.subject}&rdquo;
        </p>
      </div>

      {/* AI Summary (past calls only) */}
      {hasSummary && (
        <>
          <div
            style={{
              height: 1,
              background: "var(--color-border-default)",
              margin: "16px 0",
            }}
          />

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

          <div
            style={{
              overflow: "hidden",
              maxHeight: expanded ? 9999 : 80,
              transition: "max-height 350ms cubic-bezier(0.22, 1, 0.36, 1)",
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

          {isTruncatable && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              style={{
                background: "none",
                border: "none",
                padding: "6px 0 0",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-brand)",
                cursor: "pointer",
                display: "block",
              }}
            >
              {expanded ? "Voir moins ↑" : "Voir plus →"}
            </button>
          )}

          {/* Warning IA */}
          <p
            style={{
              fontSize: 12,
              color: "#6b7280",
              margin: "10px 0 0",
              display: "flex",
              alignItems: "flex-start",
              gap: 4,
            }}
          >
            <span>⚠️</span>
            <span>
              Résumé généré par IA, peut contenir des imprécisions
            </span>
          </p>

          {/* "Ask AI" buttons — pré-remplissent la transcription dans ChatGPT/Claude */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 14,
            }}
          >
            <a
              href={`https://chatgpt.com/?q=${encodeURIComponent(
                buildAIPrompt(call.host, call.ai_summary!)
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 14px",
                background: "#ffffff",
                border: "1px solid var(--color-border-default)",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-text-primary)",
                textDecoration: "none",
                transition: "background 150ms ease, border-color 150ms ease",
              }}
              className="hover:bg-[#f5f5f5] hover:border-[#d4d4d8]"
            >
              <Image
                src={CHATGPT_LOGO}
                alt=""
                width={16}
                height={16}
                style={{ display: "block", flexShrink: 0 }}
              />
              Demander à ChatGPT
            </a>

            <a
              href={`https://claude.ai/new?q=${encodeURIComponent(
                buildAIPrompt(call.host, call.ai_summary!)
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 14px",
                background: "#ffffff",
                border: "1px solid var(--color-border-default)",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-text-primary)",
                textDecoration: "none",
                transition: "background 150ms ease, border-color 150ms ease",
              }}
              className="hover:bg-[#f5f5f5] hover:border-[#d4d4d8]"
            >
              <Image
                src={CLAUDE_LOGO}
                alt=""
                width={16}
                height={16}
                style={{ display: "block", flexShrink: 0, borderRadius: 3 }}
              />
              Demander à Claude
            </a>
          </div>
        </>
      )}
    </div>
  );
}
