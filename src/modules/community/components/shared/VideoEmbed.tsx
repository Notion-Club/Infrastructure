"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoEmbedMatch } from "../../utils/video-embed";

interface VideoEmbedProps {
  // Match déjà validé (allowlist) par detectVideoEmbed — ne JAMAIS fabriquer un
  // match à partir d'une URL arbitraire non filtrée.
  match: VideoEmbedMatch;
  // Contexte pour data-fb-label (feed / détail / commentaire).
  label?: string;
  // Cartes du FEED uniquement : suspendre la lecture quand un DÉTAIL de post
  // s'ouvre (morph overlay). Sinon la vidéo de la carte en arrière-plan continue
  // de jouer SOUS la publication ouverte. À laisser `false` (défaut) partout
  // ailleurs (overlay, détail, commentaires) : ces vidéos-là sont au premier plan
  // et doivent jouer normalement.
  suspendOnDetailOpen?: boolean;
}

// ── Suspension globale des vidéos d'ARRIÈRE-PLAN (feed) ──────────────────────
// Compteur module-level des surfaces « détail de post » ouvertes (morph overlay).
// > 0 → toute VideoEmbed marquée `suspendOnDetailOpen` se coupe (l'iframe est
// démontée → lecture stoppée, tous providers). PostMorphProvider appelle
// push/pop à l'ouverture/fermeture du détail. Un compteur (et non un booléen)
// gère proprement des ouvertures imbriquées éventuelles.
let openDetailCount = 0;
const DETAIL_EVT = "nc-video-detail-open-changed";
export function pushVideoDetailOpen() {
  openDetailCount += 1;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DETAIL_EVT));
}
export function popVideoDetailOpen() {
  openDetailCount = Math.max(0, openDetailCount - 1);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DETAIL_EVT));
}

// « Actif » = l'iframe DOIT être montée (donc peut jouer). Deux conditions :
//   1. la vidéo est VISIBLE à l'écran (IntersectionObserver) → couper au scroll
//      hors-vue (bug « la vidéo continue quand on scrolle ailleurs ») ;
//   2. si `suspendOnDetailOpen` : AUCUN détail de post n'est ouvert → couper les
//      vidéos du feed dès qu'on ouvre une autre publication.
// Par défaut inView=false : rien ne s'auto-joue avant d'être réellement visible
// (fin de l'auto-play de toutes les vidéos du feen au montage).
function useEmbedActive(
  ref: React.RefObject<HTMLElement | null>,
  suspendOnDetailOpen: boolean,
): boolean {
  const [inView, setInView] = useState(false);
  const [detailOpen, setDetailOpen] = useState(
    () => suspendOnDetailOpen && openDetailCount > 0,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true); // pas d'IO dispo → on ne bloque pas la lecture
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (e) setInView(e.isIntersecting);
      },
      // Racine = viewport (sur mobile, le feed remplit l'écran). Seuil 0 : dès
      // qu'un pixel entre/sort de la vue.
      { root: null, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    if (!suspendOnDetailOpen) return;
    const sync = () => setDetailOpen(openDetailCount > 0);
    sync();
    window.addEventListener(DETAIL_EVT, sync);
    return () => window.removeEventListener(DETAIL_EVT, sync);
  }, [suspendOnDetailOpen]);

  return inView && !detailOpen;
}

// Cadre commun 16/9 (bord + radius + stopPropagation pour ne pas naviguer quand
// on clique le lecteur dans une carte cliquable). `innerRef` : cible observée
// par l'IntersectionObserver (visibilité).
function Frame({
  label,
  innerRef,
  children,
}: {
  label?: string;
  innerRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={innerRef}
      data-fb-label={label ?? "Vidéo intégrée · Communauté"}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        aspectRatio: "16 / 9",
        marginTop: 4,
        border: "1px solid var(--color-border-default)",
        background: "#000",
      }}
    >
      {children}
    </div>
  );
}

function Iframe({ src, eager = false }: { src: string; eager?: boolean }) {
  return (
    <iframe
      src={src}
      style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      // Lecture déclenchée par un tap : l'iframe autoplay doit se charger
      // IMMÉDIATEMENT (pas `lazy`) pour rester dans la fenêtre du geste
      // utilisateur → sinon, sur mobile, la lecture ne démarre pas au 1er tap.
      loading={eager ? "eager" : "lazy"}
    />
  );
}

// Icône « play » (triangle plein). Le triangle est déjà centré dans son viewBox
// (centroïde ≈ 12,12). `display: block` supprime le décalage de baseline de
// l'inline-SVG (source d'un léger désaxage vertical dans le flex) ; un petit
// `translateX` compense OPTIQUEMENT le bord gauche large du triangle → centrage
// perçu parfait dans le rond (l'ancien `marginLeft: 3` sur-corrigeait).
function PlayGlyph() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="#fff"
      aria-hidden="true"
      style={{ display: "block", transform: "translateX(1.5px)" }}
    >
      <path d="M8 5.14v13.72c0 .83.91 1.34 1.62.9l10.94-6.86c.67-.42.67-1.38 0-1.8L9.62 4.24C8.91 3.8 8 4.31 8 5.14Z" />
    </svg>
  );
}

// Rond « liquid glass » du bouton play (translucide + backdrop-blur + reflets).
function PlayCircle({ scale = 1 }: { scale?: number }) {
  return (
    <span
      style={{
        width: 66,
        height: 66,
        borderRadius: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.16)",
        backdropFilter: "blur(14px) saturate(180%)",
        WebkitBackdropFilter: "blur(14px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.45)",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.65), inset 0 -1px 2px rgba(255,255,255,0.15)",
        transform: `scale(${scale})`,
        transition: "transform 220ms var(--nc-ease), background 220ms var(--nc-ease)",
      }}
    >
      <PlayGlyph />
    </span>
  );
}

// Façade YouTube : miniature + bouton play « liquid glass » centré. Tant qu'on
// ne clique pas, AUCUN chrome YouTube (titre, boutons, suggestions) — juste
// l'image. Au clic, on bascule sur l'iframe player en autoplay. Quand la vidéo
// n'est plus « active » (scroll hors-vue / détail ouvert), on RETOMBE sur la
// miniature (playing=false) → la lecture est stoppée (iframe démontée).
function YouTubeFacade({
  id,
  embedSrc,
  label,
  active,
  innerRef,
}: {
  id: string;
  embedSrc: string;
  label?: string;
  active: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState(false);
  // maxres n'existe pas pour toutes les vidéos → fallback hqdefault (toujours
  // présent) via onError.
  const [poster, setPoster] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);

  // Hors-vue / détail ouvert → on coupe : retour miniature (iframe démontée →
  // lecture stoppée), l'utilisateur relancera d'un tap. Ajustement d'état PENDANT
  // le rendu sur transition de `active` (pattern React officiel « stocker l'info
  // du rendu précédent ») → pas de setState dans un effect (cascading renders).
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    if (!active && playing) setPlaying(false);
  }

  if (playing && active) {
    // rel=0 (pas de suggestions d'autres chaînes) + modestbranding + autoplay.
    return (
      <Frame label={label} innerRef={innerRef}>
        <Iframe src={`${embedSrc}?autoplay=1&rel=0&modestbranding=1&playsinline=1`} eager />
      </Frame>
    );
  }

  return (
    <Frame label={label} innerRef={innerRef}>
      <button
        type="button"
        onClick={() => setPlaying(true)}
        // Hover réservé au pointeur SOURIS. Sur mobile (tactile), le survol
        // déclenché par le 1er tap « mangeait » le clic → il fallait taper deux
        // fois pour lancer la vidéo. En ne réagissant qu'au pointeur `mouse`,
        // le 1er tap tactile déclenche directement le onClick → lecture immédiate.
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(true); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(false); }}
        aria-label="Lire la vidéo"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          display: "block",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster}
          alt=""
          onError={() => setPoster(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {/* Bouton play liquid glass, légèrement grossi au survol souris. */}
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <PlayCircle scale={hover ? 1.08 : 1} />
        </span>
      </button>
    </Frame>
  );
}

// Rendu d'une vidéo de l'allowlist. YouTube → façade miniature + play custom
// (plus l'embed « tout YouTube »). Autres providers (Loom / Tella / Vimeo) →
// iframe player (Tella arrive déjà avec ses paramètres d'embed épurés).
//
// Auto-pause : l'iframe n'est montée que lorsque la vidéo est « active » (visible
// + aucun détail ouvert si `suspendOnDetailOpen`). Démonter l'iframe est le seul
// levier de pause commun à tous les providers (aucun n'expose d'API postMessage
// câblée ici). Hors-vue, on affiche donc le cadre noir + un rond play.
export function VideoEmbed({ match, label, suspendOnDetailOpen = false }: VideoEmbedProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const active = useEmbedActive(frameRef, suspendOnDetailOpen);

  if (match.provider === "youtube") {
    return (
      <YouTubeFacade
        id={match.id}
        embedSrc={match.embedSrc}
        label={label}
        active={active}
        innerRef={frameRef}
      />
    );
  }
  return (
    <Frame label={label} innerRef={frameRef}>
      {active ? (
        <Iframe src={match.embedSrc} />
      ) : (
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <PlayCircle />
        </span>
      )}
    </Frame>
  );
}
