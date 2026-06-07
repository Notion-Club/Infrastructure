"use client";

// Avatar du coach avec transition skeleton → reveal (transitions.dev) pendant
// le chargement de la photo : tant que l'image n'est pas chargée, on affiche
// l'avatar initiales coloré qui « pulse », puis on cross-fade vers la photo
// (fondu + dé-floutage) dès qu'elle arrive.
//
// Sans photo (ou en cas d'erreur de chargement) : initiales simples, sans
// skeleton.

import { useEffect, useRef, useState } from "react";

interface HostAvatarProps {
  url: string | null | undefined;
  initials: string;
  bg: string;
  size: number;
  fontSize?: number;
  // Bord optionnel (ex. hairline sur fond clair).
  border?: string;
  alt?: string;
  fbLabel?: string;
}

export function HostAvatar({
  url,
  initials,
  bg,
  size,
  fontSize,
  border,
  alt = "",
  fbLabel,
}: HostAvatarProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Image déjà en cache : `onLoad` ne se déclenche pas → on lit `complete`.
  useEffect(() => {
    if (!url) return;
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      const id = requestAnimationFrame(() => setLoaded(true));
      return () => cancelAnimationFrame(id);
    }
  }, [url]);

  const f = fontSize ?? Math.round(size * 0.36);

  const initialsNode = (
    <span
      style={{
        fontSize: f,
        fontWeight: 700,
        color: "#fff",
        lineHeight: 1,
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </span>
  );

  // Pas de photo (ou échec) → initiales seules.
  if (!url || failed) {
    return (
      <span
        data-fb-label={fbLabel}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: bg,
          border,
          boxSizing: "border-box",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {initialsNode}
      </span>
    );
  }

  return (
    <span
      data-fb-label={fbLabel}
      className={`nc-avatar-skel${loaded ? " is-revealed" : ""}`}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        border,
        boxSizing: "border-box",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Skeleton : avatar initiales coloré, pulsé jusqu'au chargement */}
      <span className="t-skel-skeleton is-pulsing">
        <span
          style={{
            width: "100%",
            height: "100%",
            background: bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {initialsNode}
        </span>
      </span>

      {/* Contenu : la photo */}
      <span className="t-skel-content">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={url}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </span>
    </span>
  );
}
