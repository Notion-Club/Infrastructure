"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Comment } from "../../../types/comment.types";
import type { User } from "../../../types/user.types";
import type { DevRole } from "../../../hooks/useDevRoleToggle";
import { fullDateTime, timeAgo, wasEdited } from "../../../utils/date-helpers";
import { renderBodyRich } from "../../../utils/render-mentions";
import { buildPostLink, copyCommunityLink } from "../../../utils/copy-link";
import { toggleReactionOptimistic } from "../../../utils/reactor";
import { detectVideoEmbed } from "../../../utils/video-embed";
import { UserAvatar } from "../../shared/UserAvatar";
import { UserHoverCard } from "../../shared/UserHoverCard";
import { TagPill } from "../../shared/TagPill";
import { ReactionsBar } from "../../shared/ReactionsBar";
import { PostKebabMenu } from "../../shared/PostKebabMenu";
import { VideoEmbed } from "../../shared/VideoEmbed";
import { PostImage } from "../../shared/PostImage";
import { ImageLightbox } from "../../shared/ImageLightbox";
import { DeletePostConfirmDialog } from "../../shared/DeletePostConfirmDialog";
import { PostComposerModal } from "../../post-composer/PostComposerModal";
import { CommentList } from "../../post-detail/CommentList";
import { getPostComments } from "../../../server/getPostComments";
import {
  deletePostAction,
  togglePostReactionAction,
  updatePostAction,
} from "../../../server/actions";
import { SPRING_EASING, SPRING_DURATION } from "../../../lib/spring";
import type { PostMorphSource } from "./PostMorphContext";

// Morph WAAPI (mécanique validée au lab morph du module Ressources, dupliquée
// ici pour respecter l'isolation) — surface clippée qui morphe (coins lisses),
// titre CONTINU (hero) qui voyage, fade-through à gap des contenus.
//
// SCROLL DOCUMENT : l'encadré n'a PAS de hauteur figée — il fait la longueur de
// son contenu (post + commentaires) et défile dans un conteneur plein écran (pas
// de scroll INTERNE). Pendant le morph la surface est `position: fixed` ; à la
// fin de l'ouverture elle est RELÂCHÉE en flux (`position: relative`) → le
// contenu défile, le titre défile avec, la croix reste FIXE à l'écran. Les
// commentaires (chargés en async) apparaissent SOUS la surface une fois ouverte.
//
// z-index : root à 4000 — sous les modales du module (edit/delete = 9999,
// lightbox = 9998, feuille de réactions = 5000) pour qu'elles s'empilent AU-
// DESSUS de l'overlay.

const OVERLAY_Z = 4000;
const FADE = "linear";

const H1_STYLE: CSSProperties = {
  fontSize: "clamp(22px, 4vw, 30px)",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  color: "var(--color-text-primary)",
  margin: 0,
  lineHeight: 1.2,
  paddingRight: 48, // dégage la croix
  boxSizing: "border-box",
};
const CARD_TITLE_STYLE: CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: "var(--color-text-primary)",
  margin: 0,
  lineHeight: 1.3,
};

// Décalage haut de l'encadré (safe-area + marge) — partagé surface / mesures.
const TOP_OFFSET = "calc(env(safe-area-inset-top, 0px) + 76px)";
const SURF_WIDTH = "min(720px, calc(100vw - 32px))";

const anim = (
  el: Element | null,
  kf: Keyframe[],
  duration: number,
  easing: string,
  store: Animation[],
): Animation | null => {
  if (!el) return null;
  const a = el.animate(kf, { duration, easing, fill: "both" });
  store.push(a);
  return a;
};

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';
function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
  );
}

interface MorphGeom {
  surfFrom: Keyframe;
  surfTo: Keyframe;
  heroFrom: string;
  fixTop: number;
  fixLeft: number;
  fixW: number;
  openH: number;
  heroTop: number;
  heroLeft: number;
  heroW: number;
}

interface OverlayProps {
  source: PostMorphSource;
  currentUser: User;
  devRole: DevRole;
  /** Appelé UNE fois l'animation de fermeture terminée → le provider démonte. */
  onClose: () => void;
}

// Skeleton des commentaires (le temps que la Server Action charge la liste).
function CommentsSkeleton() {
  const pulse: CSSProperties = {
    animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
    background: "var(--color-surface-raised)",
    borderRadius: 8,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "flex", gap: 12 }}>
          <div style={{ ...pulse, width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ ...pulse, height: 12, width: "30%" }} />
            <div style={{ ...pulse, height: 12, width: "85%" }} />
            <div style={{ ...pulse, height: 12, width: "60%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PostMorphOverlay({ source, currentUser, devRole, onClose }: OverlayProps) {
  const post = source.post;
  const router = useRouter();

  // État du post (réactions / édition / épinglage) — mirroir de PostCard, pour
  // que les actions restent disponibles depuis l'overlay sans navigation.
  const [postData, setPostData] = useState(post);
  const [reactions, setReactions] = useState(post.reactions);
  const [showEditComposer, setShowEditComposer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageLightbox, setImageLightbox] = useState(false);
  const [editing, startEdit] = useTransition();

  const isAuthor = post.author.id === currentUser.id;
  const isPrivileged = currentUser.role === "admin" || currentUser.role === "mentor";
  const edited = wasEdited(postData.createdAt, postData.updatedAt);
  const hasTitle = !!postData.title;

  // Embed vidéo (allowlist) : champ videoUrl prioritaire, sinon body.
  const video =
    detectVideoEmbed(postData.videoUrl ?? "") ?? detectVideoEmbed(postData.body);
  const displayBody = video
    ? postData.body.replace(video.matchedUrl, "").trim()
    : postData.body;

  const pageBgRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<HTMLDivElement>(null);
  const encRef = useRef<HTMLDivElement>(null);
  const encTitleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardTitleRef = useRef<HTMLHeadingElement>(null);
  const heroRef = useRef<HTMLHeadingElement>(null);

  const gRef = useRef<MorphGeom | null>(null);
  const animsRef = useRef<Animation[]>([]);
  const closingRef = useRef(false);
  const poppedRef = useRef(false);
  const [interactive, setInteractive] = useState(false);

  // Commentaires — hydratés en async (le feed ne les porte pas). `null` = en
  // cours de chargement (skeleton) ; un tableau = chargé.
  const [comments, setComments] = useState<Comment[] | null>(null);
  const commentsFetchedRef = useRef(false);
  useEffect(() => {
    if (commentsFetchedRef.current) return;
    commentsFetchedRef.current = true;
    let alive = true;
    getPostComments(post.id)
      .then((c) => {
        if (alive) setComments(c);
      })
      .catch(() => {
        if (alive) setComments([]);
      });
    return () => {
      alive = false;
    };
  }, [post.id]);

  // ── Actions post (réactions / édition / suppression / épinglage) ────────────
  async function handleReaction(emoji: string) {
    const previous = reactions;
    setReactions((prev) => toggleReactionOptimistic(prev, emoji, currentUser));
    const result = await togglePostReactionAction({ post_id: post.id, emoji });
    if (!result.ok) {
      setReactions(previous);
      toast.error(result.message);
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    const result = await deletePostAction(post.id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Post supprimé");
    router.refresh();
    startClose();
  }

  async function handleTogglePin() {
    const nextPinned = !postData.pinned;
    setPostData((prev) => ({ ...prev, pinned: nextPinned }));
    const result = await updatePostAction(post.id, { pinned: nextPinned });
    if (!result.ok) {
      setPostData((prev) => ({ ...prev, pinned: !nextPinned }));
      toast.error(result.message);
      return;
    }
    toast.success(nextPinned ? "Post épinglé" : "Post désépinglé");
    router.refresh();
  }

  // Fin de fermeture : retire l'entrée d'historique (si fermeture manuelle),
  // restitue le focus (clavier uniquement), puis demande le démontage.
  const finishClose = useCallback(() => {
    if (!poppedRef.current) {
      try {
        window.history.back();
      } catch {
        /* noop */
      }
    }
    if (source.viaKeyboard) {
      try {
        source.triggerEl?.focus?.({ preventScroll: true });
      } catch {
        /* noop */
      }
    }
    onClose();
  }, [onClose, source]);

  // ── Fermeture (ré-ancre la surface en fixed, joue le morph inverse) ─────────
  const startClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setInteractive(false);

    const g = gRef.current;
    const surf = surfRef.current;
    if (!g || !surf || prefersReduced()) return finishClose();

    // Dé-piège la surface AVANT de la ré-ancrer (PWA iOS : un fixed descendant
    // d'un scroller momentum s'ancre au CONTENU du scroller, pas au viewport).
    const scroller = scrollRef.current;
    if (scroller) {
      scroller.scrollTop = 0;
      scroller.style.setProperty("-webkit-overflow-scrolling", "auto");
      scroller.style.overflowY = "hidden";
      scroller.scrollTop = 0;
      void scroller.offsetHeight; // flush synchrone
    }

    surf.style.position = "fixed";
    surf.style.top = `${g.fixTop}px`;
    surf.style.left = `${g.fixLeft}px`;
    surf.style.marginLeft = "0";
    surf.style.width = `${g.fixW}px`;
    surf.style.height = `${g.openH}px`;
    surf.style.borderRadius = "16px";
    surf.style.transform = "none";
    surf.style.transformOrigin = "top left";
    surf.style.overflow = "hidden";
    if (encRef.current) encRef.current.style.width = `${g.fixW}px`;

    // AUTO-CORRECTION anti-piège (PWA iOS) : on MESURE où la surface atterrit
    // réellement (rect viewport) et on compense l'écart. Inerte si fixed déjà
    // correct (écart nul) → zéro impact desktop/Safari.
    {
      const got = surf.getBoundingClientRect();
      const dTop = got.top - g.fixTop;
      const dLeft = got.left - g.fixLeft;
      if (Math.abs(dTop) > 0.5 || Math.abs(dLeft) > 0.5) {
        surf.style.top = `${g.fixTop - dTop}px`;
        surf.style.left = `${g.fixLeft - dLeft}px`;
      }
    }

    // Bascule titre : le vrai titre (en flux) disparaît, le hero (fixe) reprend.
    if (hasTitle) {
      if (encTitleRef.current) encTitleRef.current.style.opacity = "0";
      const hero = heroRef.current;
      if (hero) {
        hero.style.display = "";
        hero.style.opacity = "1";
        hero.style.transform = "none";
        hero.style.top = `${g.heroTop}px`;
        hero.style.left = `${g.heroLeft}px`;
        hero.style.width = `${g.heroW}px`;
      }
    }

    animsRef.current.forEach((a) => {
      try {
        a.commitStyles();
      } catch {
        /* anim non démarrée */
      }
      a.cancel();
    });
    animsRef.current = [];
    const store = animsRef.current;
    const d = SPRING_DURATION;

    const surfAnim = anim(surf, [g.surfTo, g.surfFrom], d, SPRING_EASING, store);
    anim(encRef.current, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.28 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(cardRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.84 }, { opacity: 1, offset: 1 }], d, FADE, store);
    anim(pageBgRef.current, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 1 }], d, FADE, store);
    if (hasTitle) {
      const hero = heroRef.current;
      anim(hero, [{ transform: "none" }, { transform: g.heroFrom }], d, SPRING_EASING, store);
      anim(hero, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.6 }, { opacity: 0, offset: 0.8 }, { opacity: 0, offset: 1 }], d, FADE, store);
      anim(cardTitleRef.current, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.86 }, { opacity: 1, offset: 1 }], d, FADE, store);
    }

    surfAnim?.finished.then(finishClose).catch(finishClose);
  }, [finishClose, hasTitle]);

  // ── Ouverture ──────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const surf = surfRef.current;
    const enc = encRef.current;
    const card = cardRef.current;
    if (!surf || !enc || !card) return;

    const encTitle = encTitleRef.current;
    const cardTitle = cardTitleRef.current;
    const hero = heroRef.current;

    const store = animsRef.current;
    const d = SPRING_DURATION;
    const c = source.cardRect;

    // État de repos (flux) posé en inline AVANT toute mesure.
    surf.style.position = "relative";
    surf.style.width = SURF_WIDTH;
    surf.style.height = "auto";
    surf.style.borderRadius = "16px";
    surf.style.overflow = "hidden";

    const flowRect = surf.getBoundingClientRect();

    // Hauteur d'OUVERTURE bornée au viewport (le contenu plus long défilera).
    const openH = Math.min(flowRect.height, window.innerHeight - flowRect.top - 24);

    const dx = c.left - flowRect.left;
    const dy = c.top - flowRect.top;

    surf.style.position = "fixed";
    surf.style.top = `${flowRect.top}px`;
    surf.style.left = `${flowRect.left}px`;
    surf.style.marginLeft = "0";
    surf.style.transformOrigin = "top left";
    surf.style.overflow = "hidden";
    enc.style.width = `${flowRect.width}px`;

    const surfFrom: Keyframe = {
      transform: `translate(${dx}px, ${dy}px)`,
      width: `${c.width}px`,
      height: `${c.height}px`,
      borderRadius: "16px",
    };
    const surfTo: Keyframe = {
      transform: "none",
      width: `${flowRect.width}px`,
      height: `${openH}px`,
      borderRadius: "16px",
    };
    Object.assign(surf.style, surfFrom);

    // Géométrie du titre continu (hero) — seulement si le post a un titre.
    let heroFrom = "none";
    let heroTop = 0;
    let heroLeft = 0;
    let heroW = 0;
    if (hasTitle && encTitle && cardTitle && hero) {
      const encTitleRect = encTitle.getBoundingClientRect();
      const gridTitleRect = source.titleRect;
      const destFont = parseFloat(getComputedStyle(encTitle).fontSize) || 26;
      const cardFont = parseFloat(getComputedStyle(cardTitle).fontSize) || 17;
      const hScale = cardFont / destFont;
      heroFrom = `translate(${gridTitleRect.left - encTitleRect.left}px, ${gridTitleRect.top - encTitleRect.top}px) scale(${hScale})`;
      heroTop = encTitleRect.top;
      heroLeft = encTitleRect.left;
      heroW = encTitleRect.width;
      hero.style.top = `${heroTop}px`;
      hero.style.left = `${heroLeft}px`;
      hero.style.width = `${heroW}px`;
      hero.style.transform = heroFrom;
    }

    gRef.current = {
      surfFrom,
      surfTo,
      heroFrom,
      fixTop: flowRect.top,
      fixLeft: flowRect.left,
      fixW: flowRect.width,
      openH,
      heroTop,
      heroLeft,
      heroW,
    };

    // Relâche la surface en flux (fin d'ouverture) : le contenu défile alors.
    const release = () => {
      const s = surfRef.current;
      if (s) {
        s.style.position = "relative";
        s.style.top = "";
        s.style.left = "";
        s.style.margin = "";
        s.style.marginLeft = "";
        s.style.width = SURF_WIDTH;
        s.style.height = "auto";
        s.style.transform = "none";
        s.style.transformOrigin = "";
        s.style.borderRadius = "16px";
        s.style.overflow = "hidden";
      }
      if (encRef.current) encRef.current.style.width = "";
      if (hasTitle) {
        if (encTitleRef.current) encTitleRef.current.style.opacity = "1";
        if (heroRef.current) heroRef.current.style.display = "none";
      }
      setInteractive(true);
    };

    if (prefersReduced()) {
      Object.assign(surf.style, surfTo);
      if (pageBgRef.current) pageBgRef.current.style.opacity = "1";
      enc.style.opacity = "1";
      card.style.opacity = "0";
      if (cardTitle) cardTitle.style.opacity = "0";
      requestAnimationFrame(release);
      return;
    }

    anim(pageBgRef.current, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 1 }], d, FADE, store);
    const surfAnim = anim(surf, [surfFrom, surfTo], d, SPRING_EASING, store);
    anim(card, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0, offset: 0.32 }, { opacity: 0, offset: 1 }], d, FADE, store);
    anim(enc, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.85 }, { opacity: 1, offset: 1 }], d, FADE, store);
    if (hasTitle && cardTitle && hero) {
      anim(cardTitle, [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.07 }, { opacity: 0, offset: 1 }], d, FADE, store);
      anim(hero, [{ transform: heroFrom }, { transform: "none" }], d, SPRING_EASING, store);
      anim(hero, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.1 }, { opacity: 1, offset: 0.22 }, { opacity: 1, offset: 1 }], d, FADE, store);
    }

    surfAnim?.finished
      .then(() => {
        try {
          surfAnim.cancel();
        } catch {
          /* noop */
        }
        release();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bouton « retour » (mobile/PWA) ferme l'overlay via une entrée d'historique
  // à la MÊME URL (aucune nav Next) ; le popstate déclenche la fermeture.
  useEffect(() => {
    try {
      window.history.pushState({ ncPostMorph: true }, "");
    } catch {
      /* noop */
    }
    const onPop = () => {
      poppedRef.current = true;
      startClose();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [startClose]);

  // Clavier : Échap ferme ; Tab est piégé DANS la surface (focus-trap modal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        startClose();
        return;
      }
      if (e.key !== "Tab") return;
      const surf = surfRef.current;
      if (!surf) return;
      const f = getFocusable(surf);
      if (f.length === 0) {
        e.preventDefault();
        surf.focus({ preventScroll: true });
        return;
      }
      const first = f[0]!;
      const last = f[f.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === surf || !surf.contains(active))) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && (active === last || !surf.contains(active))) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startClose]);

  // À l'ouverture : déplace le focus DANS le dialogue (la surface, tabindex -1).
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      surfRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(t);
  }, []);

  // Verrou de scroll NON déplaçant derrière (fige l'overflow du document sans
  // position:fixed, qui sauterait le scroll en PWA iOS).
  useEffect(() => {
    const html = document.documentElement;
    const bodyEl = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: bodyEl.style.overflow,
      bodyOverscroll: bodyEl.style.overscrollBehavior,
      scrollRestoration: history.scrollRestoration,
    };
    html.style.overflow = "hidden";
    bodyEl.style.overflow = "hidden";
    bodyEl.style.overscrollBehavior = "none";
    try {
      history.scrollRestoration = "manual";
    } catch {
      /* noop */
    }
    return () => {
      html.style.overflow = prev.htmlOverflow;
      bodyEl.style.overflow = prev.bodyOverflow;
      bodyEl.style.overscrollBehavior = prev.bodyOverscroll;
      try {
        history.scrollRestoration = prev.scrollRestoration;
      } catch {
        /* noop */
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      animsRef.current.forEach((a) => a.cancel());
      animsRef.current = [];
    };
  }, []);

  // Fermeture au tap sur le fond (pointer events + détente anti-scroll).
  const pressRef = useRef<{ x: number; y: number; onBackdrop: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    const onBackdrop = !surfRef.current?.contains(e.target as Node);
    pressRef.current = { x: e.clientX, y: e.clientY, onBackdrop };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = pressRef.current;
    pressRef.current = null;
    if (!p || !p.onBackdrop) return;
    if (surfRef.current?.contains(e.target as Node)) return;
    const moved = Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
    if (moved < 12) startClose();
  };

  const overlay = (
    <div style={{ position: "fixed", inset: 0, zIndex: OVERLAY_Z, pointerEvents: "none" }}>
      <div
        ref={pageBgRef}
        style={{ position: "fixed", inset: 0, backgroundColor: "var(--color-surface-page)", opacity: 0, pointerEvents: "none", touchAction: "none" }}
      />

      {/* Conteneur de SCROLL plein écran. Clic sur la zone vide → fermeture. */}
      <div
        ref={scrollRef}
        data-testid="post-morph-scroll"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        style={{
          position: "fixed",
          inset: 0,
          overflowX: "hidden",
          overflowY: interactive ? "auto" : "hidden",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: interactive ? "touch" : "auto",
          pointerEvents: interactive ? "auto" : "none",
        }}
      >
        <div
          style={{
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: TOP_OFFSET,
            paddingBottom: 24,
            pointerEvents: "none",
          }}
        >
          {/* SURFACE (carte de post) : pendant le morph → fixed (JS) ; après
              ouverture → flux, hauteur = contenu, défile dans le conteneur. */}
          <div
            ref={surfRef}
            role="dialog"
            aria-modal="true"
            aria-label={postData.title || "Publication"}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-surface-card)",
              border: postData.pinned ? "1.5px solid var(--color-brand)" : "1px solid var(--color-border-default)",
              boxShadow: "var(--nc-shadow-3)",
              outline: "none",
              pointerEvents: "auto",
              willChange: "width, height, transform, border-radius",
            }}
          >
            {/* Contenu ENCADRÉ (post complet développé) */}
            <div ref={encRef} style={{ padding: 24, opacity: 0, willChange: "opacity" }}>
              {postData.pinned && (
                <div style={{ marginBottom: 12 }}>
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 11, fontWeight: 700, color: "var(--color-brand)",
                      background: "rgba(224,98,90,0.08)", padding: "3px 8px",
                      borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.04em",
                    }}
                  >
                    📌 Épinglé
                  </span>
                </div>
              )}

              {/* Header : auteur + tag + date. Le kebab n'est PLUS dans le flux :
                  il est ancré en coin haut-droit (comme la croix) pour être
                  aligné sur la même ligne qu'elle — cf. wrapper absolu plus bas.
                  paddingRight dégage les DEUX boutons de coin (kebab + croix). */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 92, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <UserHoverCard user={post.author} devRole={devRole}>
                    <div style={{ cursor: "pointer", flexShrink: 0 }}>
                      <UserAvatar user={post.author} size={44} />
                    </div>
                  </UserHoverCard>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <UserHoverCard user={post.author} devRole={devRole}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", cursor: "pointer" }}>
                          {post.author.name}
                        </span>
                      </UserHoverCard>
                      <TagPill tag={postData.tag} />
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }} title={`Publié le ${fullDateTime(postData.createdAt)}`}>
                      {timeAgo(postData.createdAt)}
                      {edited && (
                        <>
                          {" · "}
                          <span style={{ fontStyle: "italic" }}>modifié</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Titre (encTitle) — hero continu */}
              {hasTitle && (
                <h1 ref={encTitleRef} style={{ ...H1_STYLE, opacity: 0, marginBottom: 12 }}>
                  {postData.title}
                </h1>
              )}

              {displayBody && (
                <div style={{ fontSize: 15, color: "var(--color-text-secondary)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {renderBodyRich(displayBody, postData.mentions)}
                </div>
              )}

              {postData.imageUrl && (
                <div style={{ marginTop: 14 }}>
                  <PostImage
                    src={postData.imageUrl}
                    onOpen={() => setImageLightbox(true)}
                    maxWidth={520}
                    fbLabel="Image du post · Détail (morph)"
                  />
                </div>
              )}

              {video && (
                <div style={{ marginTop: 14 }}>
                  <VideoEmbed match={video} label="Vidéo du post · Détail (morph)" />
                </div>
              )}

              {/* Réactions */}
              <div data-fb-label="Barre de réactions · Détail (morph)" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border-default)" }}>
                <ReactionsBar reactions={reactions} onReact={handleReaction} showAddReaction />
              </div>
            </div>

            {/* KEBAB — ancré en coin haut-droit, sur la MÊME ligne que la croix
                (top: 16, hauteur 36) et juste à sa gauche → les deux boutons sont
                alignés. Apparaît avec le contenu (interactive), comme la croix. */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ position: "absolute", top: 16, right: 60, zIndex: 3, opacity: interactive ? 1 : 0, pointerEvents: interactive ? "auto" : "none", transition: "opacity 160ms ease" }}
            >
              <PostKebabMenu
                onCopyLink={() => copyCommunityLink(buildPostLink(post.id))}
                onEdit={isAuthor ? () => setShowEditComposer(true) : undefined}
                onDelete={isAuthor || isPrivileged ? () => setShowDeleteConfirm(true) : undefined}
                onTogglePin={isPrivileged ? handleTogglePin : undefined}
                pinned={postData.pinned}
                size={36}
              />
            </div>

            {/* CROIX — fixe en haut à droite de la carte. */}
            <button
              type="button"
              onClick={startClose}
              aria-label="Fermer"
              style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9999, border: "1px solid var(--color-border-default)", background: "var(--color-surface-raised)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 18, lineHeight: 1, zIndex: 3, opacity: interactive ? 1 : 0, pointerEvents: interactive ? "auto" : "none", transition: "opacity 160ms ease" }}
            >
              ✕
            </button>

            {/* Clone du CONTENU CARTE (départ) — réplique le haut de PostCard. */}
            <div
              ref={cardRef}
              style={{ position: "absolute", top: 0, left: 0, width: source.cardRect.width, padding: 20, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 14, willChange: "opacity", pointerEvents: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <UserAvatar user={post.author} size={40} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{post.author.name}</span>
                    <TagPill tag={postData.tag} size="sm" />
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }}>{timeAgo(postData.createdAt)}</p>
                </div>
              </div>
              {hasTitle && (
                <h2 ref={cardTitleRef} style={CARD_TITLE_STYLE}>{postData.title}</h2>
              )}
              {displayBody && (
                <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap" }}>
                  {displayBody}
                </p>
              )}
            </div>
          </div>

          {/* COMMENTAIRES — carte SOUS la surface, révélée une fois ouverte
              (l'apparition après le morph évite tout saut de flux pendant que la
              surface est en position: fixed). */}
          {interactive && (
            <div
              // La carte commentaires est un FRÈRE de la surface (hors surfRef) :
              // sans ces stopPropagation, un clic/tap dans la zone commentaires
              // était vu comme un tap « backdrop » par le conteneur de scroll
              // (onPointerDown/Up plus haut) → le post entier se refermait. On
              // arrête donc les pointer events ici pour que la zone reste
              // interactive (composer, boutons, réactions de commentaire…).
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              style={{
                width: SURF_WIDTH,
                marginTop: 16,
                background: "var(--color-surface-card)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 16,
                padding: 24,
                boxShadow: "var(--nc-shadow-3)",
                pointerEvents: "auto",
                animation: "nc-mode-in 260ms var(--nc-ease) both",
              }}
            >
              {comments === null ? (
                <CommentsSkeleton />
              ) : (
                <CommentList
                  postId={post.id}
                  comments={comments}
                  currentUser={currentUser}
                  devRole={devRole}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* FLOU HAUT (PWA) — masqué en dégradé pour ne pas couvrir la croix. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: TOP_OFFSET,
          pointerEvents: "none",
          zIndex: 1,
          opacity: interactive ? 1 : 0,
          transition: "opacity 200ms ease",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 35%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, #000 35%, transparent 100%)",
        }}
      />

      {/* TITRE CONTINU (hero) — uniquement pendant le morph, si titre présent. */}
      {hasTitle && (
        <h1 ref={heroRef} style={{ ...H1_STYLE, position: "fixed", transformOrigin: "top left", willChange: "transform, opacity", pointerEvents: "none", zIndex: 2 }}>
          {postData.title}
        </h1>
      )}

      {/* Modales (portails propres, z-index > overlay) */}
      {showDeleteConfirm && (
        <DeletePostConfirmDialog onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)} />
      )}
      {imageLightbox && postData.imageUrl && (
        <ImageLightbox url={postData.imageUrl} alt={postData.title ?? ""} onClose={() => setImageLightbox(false)} />
      )}
      {showEditComposer && (
        <PostComposerModal
          currentUser={currentUser}
          initialPost={postData}
          publishing={editing}
          onClose={() => setShowEditComposer(false)}
          onPublish={(updated) => {
            const titleNormalized = (updated.title ?? "").trim();
            const bodyNormalized = (updated.body ?? "").trim();
            if (!titleNormalized || !bodyNormalized) return;
            startEdit(async () => {
              const result = await updatePostAction(post.id, {
                title: titleNormalized,
                body: bodyNormalized,
                tag: updated.tag,
                audience: updated.audience,
                pinned: updated.pinned,
                image_url: updated.imageUrl ?? null,
                video_url: updated.videoUrl ?? null,
              });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              setPostData((prev) => ({
                ...prev,
                title: titleNormalized,
                body: bodyNormalized,
                tag: updated.tag ?? prev.tag,
                audience: updated.audience ?? prev.audience,
                pinned: updated.pinned ?? prev.pinned,
                imageUrl: updated.imageUrl ?? prev.imageUrl,
                updatedAt: new Date().toISOString(),
              }));
              setShowEditComposer(false);
              toast.success("Post modifié");
              router.refresh();
            });
          }}
        />
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
