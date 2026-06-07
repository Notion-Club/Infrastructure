"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { searchMessagesAction } from "../../server/actions";
import type { SearchMessageHit } from "../../server/queries";
import type { User } from "../../types/user.types";

interface MessageSearchBarProps {
  conversationId: string;
  currentUser: User;
  participant: User;
  // Appelé quand l'utilisateur clique un résultat — le parent (thread) doit
  // scroller jusqu'au message et le highlight brièvement.
  onJumpToMessage: (messageId: string) => void;
  onClose: () => void;
}

// Highlight visuel du segment recherché dans le snippet du résultat. On
// échappe les regex spéciaux avant de construire le pattern (insensible à
// la casse). Tronqué à ~120 chars autour du match pour éviter de noyer
// l'utilisateur dans un long body.
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderSnippet(body: string, query: string): React.ReactNode {
  if (!query.trim()) return body.slice(0, 140);

  const idx = body.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return body.slice(0, 140);

  // Fenêtre de contexte autour du match : 50 chars avant + match + ~80 après.
  const start = Math.max(0, idx - 50);
  const end = Math.min(body.length, idx + query.length + 80);
  const slice =
    (start > 0 ? "…" : "") + body.slice(start, end) + (end < body.length ? "…" : "");

  const re = new RegExp(`(${escapeRegex(query)})`, "ig");
  const parts = slice.split(re);
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={i}
        style={{
          background: "rgba(224,98,90,0.18)",
          color: "var(--color-text-primary)",
          padding: "0 2px",
          borderRadius: 3,
        }}
      >
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year:
      d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function MessageSearchBar({
  conversationId,
  currentUser,
  participant,
  onJumpToMessage,
  onClose,
}: MessageSearchBarProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchMessageHit[]>([]);
  const [isPending, startTransition] = useTransition();
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Debounce 300 ms — un appel par burst de frappe (évite de fetch à chaque
  // touche). Si l'utilisateur tape vite, on annule le précédent.
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }

    debounceRef.current = window.setTimeout(() => {
      startTransition(async () => {
        const result = await searchMessagesAction(conversationId, trimmed);
        setHits(result.hits);
        setSearched(true);
      });
    }, 300);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, conversationId]);

  function authorOf(senderId: string): string {
    return senderId === currentUser.id ? "Vous" : participant.name;
  }

  return (
    <div
      data-fb-label="Barre de recherche · Thread de messages"
      style={{
        display: "flex",
        flexDirection: "column",
        borderBottom: "1px solid var(--color-border-default)",
        background: "var(--color-surface-card)",
      }}
    >
      {/* Input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
        }}
      >
        <Search size={16} color="var(--color-text-secondary)" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          data-fb-label="Champ de recherche · Thread de messages"
          placeholder="Rechercher dans la conversation…"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 14,
            color: "var(--color-text-primary)",
          }}
        />
        {isPending && <Loader2 size={14} className="animate-spin" color="var(--color-text-muted)" />}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la recherche"
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-secondary)",
          }}
          className="hover:bg-[rgba(0,0,0,0.06)]"
        >
          <X size={14} />
        </button>
      </div>

      {/* Résultats */}
      {query.trim().length >= 2 && searched && (
        <div
          style={{
            maxHeight: 260,
            overflowY: "auto",
            borderTop: "1px solid var(--color-border-default)",
          }}
        >
          {hits.length === 0 ? (
            <div
              style={{
                padding: "16px",
                fontSize: 13,
                color: "var(--color-text-muted)",
                textAlign: "center",
              }}
            >
              Aucun message ne correspond.
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: "8px 14px",
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  fontWeight: 500,
                }}
              >
                {hits.length} résultat{hits.length > 1 ? "s" : ""}
                {hits.length === 50 ? " (max)" : ""}
              </div>
              {hits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => onJumpToMessage(hit.id)}
                  data-fb-label="Résultat de recherche · Thread de messages"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    borderTop: "1px solid var(--color-border-default)",
                  }}
                  className="hover:bg-[rgba(0,0,0,0.04)]"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {authorOf(hit.senderId)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--color-text-muted)",
                        flexShrink: 0,
                      }}
                    >
                      {formatDate(hit.createdAt)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-secondary)",
                      lineHeight: 1.4,
                      wordBreak: "break-word",
                    }}
                  >
                    {renderSnippet(hit.body, query)}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
