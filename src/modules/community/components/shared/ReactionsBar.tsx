"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { TextBubble } from "@/shared/components/icons";
import type { Reaction, Reactor } from "../../types/post.types";
import { ReactionPicker } from "./ReactionPicker";

// Récupère les reactors réels d'une réaction. Si la source DB ne les a pas
// fournis (legacy / mock), on retourne une liste de placeholders neutres
// ("Membre 1", "Membre 2"...) plutôt que d'inventer des noms.
function getReactors(reaction: Reaction): Reactor[] {
  if (reaction.reactors && reaction.reactors.length > 0) return reaction.reactors;
  // Fallback : on génère N reactors anonymes pour matcher le count, sans
  // mentir sur l'identité. Quand on est sur de la vraie DB, ce chemin n'est
  // jamais emprunté (les reactors sont toujours hydratés).
  return Array.from({ length: reaction.count }, (_, i) => ({
    id: `anon-${i}`,
    name: `Membre ${i + 1}`,
    initials: "?",
    avatarUrl: null,
    avatarColor: null,
  }));
}

function getAllReactors(reactions: Reaction[]): Array<Reactor & { emoji: string }> {
  return reactions.flatMap((r) =>
    getReactors(r).map((u) => ({ ...u, emoji: r.emoji })),
  );
}

// Hash déterministe id → couleur pour le fallback avatar (memberCard sans
// avatar_url ni avatar_color). Aligné sur le pattern UserAvatar.
function hashColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const palette = ["#e0625a", "#7a8fff", "#5fa57a", "#d4a55f", "#9b6bd4", "#5fa3d4"];
  return palette[hash % palette.length]!;
}

function AvatarDot({ reactor }: { reactor: Reactor }) {
  const bg = reactor.avatarColor ?? hashColor(reactor.id);
  if (reactor.avatarUrl) {
    return (
      <Image
        src={reactor.avatarUrl}
        alt={reactor.name}
        width={22}
        height={22}
        style={{ borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
        unoptimized
      />
    );
  }
  return (
    <div
      style={{
        width: 22, height: 22, borderRadius: "50%", background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0,
      }}
    >
      {reactor.initials}
    </div>
  );
}

// Feuille listant TOUTES les réactions d'un post/commentaire. Ouverte au clic sur
// le lot cumulé (> 3 emojis) ou via « Voir N de plus » d'une pastille.
//
// Quand l'utilisateur a lui-même réagi (`userReactedEmoji` + `onRemoveOwn`), un
// bouton « Retirer ma réaction » apparaît dans le coin supérieur droit : le clic
// sur le LOT n'enlève plus la réaction (il ouvre ce menu), c'est ce bouton
// dédié qui la retire — avec une animation de retrait (la puce de l'emoji se
// replie, le bouton s'efface) avant que la suppression réelle soit appliquée et
// le menu refermé (la barre se met à jour en optimistic côté parent).
function BottomSheet({
  reactions,
  onClose,
  userReactedEmoji = null,
  onRemoveOwn,
}: {
  reactions: Reaction[];
  onClose: () => void;
  userReactedEmoji?: string | null;
  onRemoveOwn?: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const all = getAllReactors(reactions.filter((r) => r.count > 0));
  const canRemove = !!userReactedEmoji && !!onRemoveOwn;

  function handleRemove() {
    if (removing || !canRemove) return;
    setRemoving(true);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Laisse jouer l'animation de retrait, puis applique la suppression réelle
    // et ferme le menu (guard prefers-reduced-motion → suppression immédiate).
    window.setTimeout(() => {
      onRemoveOwn?.();
      onClose();
    }, reduce ? 0 : 280);
  }

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-surface-card)", borderRadius: "20px 20px 0 0",
          padding: "20px 16px 32px", width: "100%",
          maxHeight: "60dvh", overflowY: "auto",
          animation: "nc-sheet-in 300ms ease both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "var(--color-border-default)", margin: "0 auto 16px" }} />
        {/* En-tête : décompte à gauche, « Retirer ma réaction » en coin sup. droit. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "0 0 12px" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>
            {all.length} réaction{all.length !== 1 ? "s" : ""}
          </p>
          {canRemove && (
            <button
              type="button"
              onClick={handleRemove}
              data-fb-label="Bouton Retirer ma réaction · Barre de réactions"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 10px", borderRadius: 9999,
                border: "1px solid rgba(224,98,90,0.25)",
                background: "rgba(224,98,90,0.08)",
                color: "var(--color-brand)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                opacity: removing ? 0 : 1,
                transform: removing ? "scale(0.9)" : "none",
                transition: "opacity 220ms var(--nc-ease), transform 220ms var(--nc-ease)",
              }}
            >
              <span aria-hidden style={{ fontSize: 13 }}>{userReactedEmoji}</span>
              Retirer ma réaction
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {reactions.filter((r) => r.count > 0).map((r) => {
            const isOwn = removing && r.emoji === userReactedEmoji;
            return (
              <span
                key={r.emoji}
                style={{
                  fontSize: 13, display: "flex", alignItems: "center", gap: 4,
                  overflow: "hidden",
                  // La puce de l'emoji retiré se replie (largeur → 0) pendant l'anim.
                  maxWidth: isOwn ? 0 : 80,
                  opacity: isOwn ? 0 : 1,
                  transform: isOwn ? "scale(0.6)" : "none",
                  transition: "max-width 280ms var(--nc-ease), opacity 200ms ease, transform 220ms var(--nc-ease)",
                }}
              >
                {r.emoji} <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>{r.count}</span>
              </span>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {all.map((r, i) => (
            <div key={`${r.id}-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AvatarDot reactor={r} />
                <span style={{ fontSize: 13, color: "var(--color-text-primary)", fontWeight: 500 }}>{r.name}</span>
              </div>
              <span style={{ fontSize: 18 }}>{r.emoji}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ReactionPillProps {
  reaction: Reaction;
  compact: boolean;
  onReact?: () => void;
  allReactions: Reaction[];
}

function ReactionPill({ reaction, compact, onReact, allReactions }: ReactionPillProps) {
  const { emoji, count, userReacted } = reaction;
  const [hovered, setHovered] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reactors réels venus de la DB (Reaction.reactors). Fallback anonyme si
  // la source ne les a pas hydratés (cas mocks legacy / fallback dev).
  const reactors = getReactors(reaction);

  const onEnter = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => setHovered(true), 150);
  }, []);

  const onLeave = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setHovered(false), 200);
  }, []);

  function onPressDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    pressTimer.current = setTimeout(() => { setHovered(false); setShowSheet(true); }, 500);
  }
  function onPressUp() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  return (
    <>
      <span
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={onReact}
        onPointerDown={onPressDown}
        onPointerUp={onPressUp}
        onPointerCancel={onPressUp}
        data-fb-label={`Réaction ${emoji} · Barre de réactions`}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: compact ? 12 : 13,
          color: userReacted ? "var(--color-brand)" : "var(--color-text-secondary)",
          fontWeight: userReacted ? 600 : 500,
          cursor: "pointer",
          padding: compact ? "2px 7px" : "3px 9px",
          borderRadius: 9999,
          // Pastille posée sur une carte (surface-card) → surface-raised hors
          // état « réagi » pour contraster (jamais ton-sur-ton en dark).
          background: userReacted ? "rgba(224,98,90,0.08)" : "var(--color-surface-raised)",
          border: `1px solid ${userReacted ? "rgba(224,98,90,0.25)" : "var(--color-border-default)"}`,
          transition: "background 150ms ease, border-color 150ms ease",
          userSelect: "none",
        }}
        className="hover:border-[rgba(0,0,0,0.15)]"
      >
        {emoji}
        <span>{count}</span>

        {hovered && (
          <div
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            style={{
              position: "absolute",
              bottom: "calc(100% + 6px)",
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 12,
              boxShadow: "var(--nc-shadow-2)",
              padding: "8px 10px",
              minWidth: 180,
              zIndex: 200,
              animation: "nc-mode-in 150ms var(--nc-ease) both",
              pointerEvents: "auto",
            }}
          >
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {emoji} {count} réaction{count !== 1 ? "s" : ""}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {/* Preview limité aux 5 premiers reactors. Au-delà, on affiche
                  un lien "voir N de plus" qui ouvre la BottomSheet plein-écran
                  avec la liste complète scrollable. */}
              {reactors.slice(0, 5).map((r, i) => (
                <div key={`${r.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <AvatarDot reactor={r} />
                  <span style={{ fontSize: 12, color: "var(--color-text-primary)", fontWeight: 500 }}>{r.name}</span>
                </div>
              ))}
              {reactors.length > 5 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHovered(false);
                    setShowSheet(true);
                  }}
                  style={{
                    marginTop: 2,
                    padding: "4px 0",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--color-brand)",
                    textAlign: "left",
                  }}
                >
                  Voir {reactors.length - 5} de plus
                </button>
              )}
            </div>
          </div>
        )}
      </span>

      {showSheet && <BottomSheet reactions={allReactions} onClose={() => setShowSheet(false)} />}
    </>
  );
}

// Lot cumulé (> 3 emojis) : un seul bouton « emojis + total ». Il ouvre la
// feuille complète au clic ET affiche, comme les pastilles individuelles, un
// hover popover listant les utilisateurs ayant réagi (tous emojis confondus).
// Avant : ce lot n'avait AUCUN hover → au survol, rien ne s'affichait alors que
// les pastilles simples montraient bien la liste.
function GroupedReactionsPill({
  reactions,
  compact,
  total,
  userHasReacted,
  onOpen,
}: {
  reactions: Reaction[];
  compact: boolean;
  total: number;
  userHasReacted: boolean;
  onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allReactors = getAllReactors(reactions);

  const onEnter = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => setHovered(true), 150);
  }, []);
  const onLeave = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setHovered(false), 200);
  }, []);

  return (
    <span
      role="button"
      tabIndex={0}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      // Clic sur le LOT cumulé → ouvre le menu listant toutes les réactions
      // (le retrait éventuel se fait depuis « Retirer ma réaction » du menu).
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      data-fb-label="Lot de réactions · Barre de réactions"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: compact ? 12 : 13,
        color: userHasReacted ? "var(--color-brand)" : "var(--color-text-secondary)",
        fontWeight: userHasReacted ? 600 : 500,
        cursor: "pointer",
        padding: compact ? "2px 9px" : "3px 11px",
        borderRadius: 9999,
        background: userHasReacted ? "rgba(224,98,90,0.08)" : "var(--color-surface-raised)",
        border: `1px solid ${userHasReacted ? "rgba(224,98,90,0.25)" : "var(--color-border-default)"}`,
        transition: "border-color 150ms ease, background 150ms ease",
        userSelect: "none",
      }}
      className="hover:border-[rgba(0,0,0,0.15)]"
    >
      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
        {reactions.slice(0, 3).map((r) => <span key={r.emoji}>{r.emoji}</span>)}
      </span>
      <span style={{ fontWeight: 600 }}>{total}</span>

      {hovered && allReactors.length > 0 && (
        <div
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            boxShadow: "var(--nc-shadow-2)",
            padding: "8px 10px",
            minWidth: 180,
            zIndex: 200,
            animation: "nc-mode-in 150ms var(--nc-ease) both",
            pointerEvents: "auto",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {total} réaction{total !== 1 ? "s" : ""}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {allReactors.slice(0, 5).map((r, i) => (
              <div key={`${r.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <AvatarDot reactor={r} />
                <span style={{ fontSize: 12, color: "var(--color-text-primary)", fontWeight: 500, flex: 1 }}>{r.name}</span>
                <span style={{ fontSize: 13 }}>{r.emoji}</span>
              </div>
            ))}
            {allReactors.length > 5 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpen(); }}
                style={{
                  marginTop: 2,
                  padding: "4px 0",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--color-brand)",
                  textAlign: "left",
                }}
              >
                Voir {allReactors.length - 5} de plus
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

interface ReactionsBarProps {
  reactions: Reaction[];
  commentCount?: number;
  compact?: boolean;
  onReact?: (emoji: string) => void;
  onCommentClick?: () => void;
  // Affiche l'affordance « ajouter une réaction » directement dans la barre :
  //   - 0 réaction  → CTA pleine « Réagir » (comme sur la page du post) pour
  //     amorcer l'engagement sur les posts encore vierges ;
  //   - ≥ 1 réaction → pastille ronde icône-seule posée à la suite de la liste.
  // Activé sur les cartes du feed. La page détail garde son ReactionPicker
  // externe dédié → laisser ce flag à false pour éviter un double sélecteur.
  showAddReaction?: boolean;
}

export function ReactionsBar({ reactions, commentCount, compact = false, onReact, onCommentClick, showAddReaction = false }: ReactionsBarProps) {
  const nonEmpty = reactions.filter((r) => r.count > 0);
  const total = nonEmpty.reduce((s, r) => s + r.count, 0);
  const userReactedReaction = nonEmpty.find((r) => r.userReacted);
  const userHasReacted = !!userReactedReaction;
  const [showGroupSheet, setShowGroupSheet] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        {nonEmpty.length === 0 ? (
          // Aucune réaction → CTA pleine « Réagir » (si l'affordance est activée
          // et qu'un handler existe). Sinon rien, comme avant.
          showAddReaction && onReact ? (
            // Libellé par défaut « + Réagir » = même CTA que la page du post.
            <ReactionPicker onSelect={onReact} compact={compact} />
          ) : null
        ) : (
          <>
            {nonEmpty.length <= 3 ? (
              nonEmpty.map((r) => (
                <ReactionPill
                  key={r.emoji}
                  reaction={r}
                  compact={compact}
                  onReact={onReact ? () => onReact(r.emoji) : undefined}
                  allReactions={reactions}
                />
              ))
            ) : (
              <GroupedReactionsPill
                reactions={nonEmpty}
                compact={compact}
                total={total}
                userHasReacted={userHasReacted}
                onOpen={() => setShowGroupSheet(true)}
              />
            )}
            {/* Des réactions existent → pastille ronde icône-seule à la suite,
                pour inciter l'utilisateur à ajouter la sienne. */}
            {showAddReaction && onReact && (
              <ReactionPicker onSelect={onReact} variant="icon" compact={compact} />
            )}
          </>
        )}
      </div>

      {commentCount !== undefined && (
        onCommentClick ? (
          <button
            type="button"
            onClick={onCommentClick}
            data-fb-label="Compteur commentaires · Barre de réactions"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: compact ? 12 : 13,
              color: "var(--color-text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
              transition: "color 150ms ease",
            }}
            className="hover:text-[var(--color-text-primary)]"
          >
            <TextBubble size={compact ? 14 : 15} />
            {commentCount} commentaire{commentCount !== 1 ? "s" : ""}
          </button>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: compact ? 12 : 13, color: "var(--color-text-muted)" }}>
            <TextBubble size={compact ? 14 : 15} />
            {commentCount} commentaire{commentCount !== 1 ? "s" : ""}
          </span>
        )
      )}

      {showGroupSheet && (
        <BottomSheet
          reactions={nonEmpty}
          onClose={() => setShowGroupSheet(false)}
          userReactedEmoji={userReactedReaction?.emoji ?? null}
          onRemoveOwn={
            userReactedReaction && onReact
              ? () => onReact(userReactedReaction.emoji)
              : undefined
          }
        />
      )}
    </div>
  );
}
