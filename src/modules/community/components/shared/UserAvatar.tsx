"use client";

import Image from "next/image";
import { useState } from "react";
import type { User } from "../../types/user.types";

const PALETTE = [
  "#e0625a", "#3b82f6", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#64748b",
];

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// Hôtes autorisés par next.config.ts (remotePatterns). Si l'avatar_url
// pointe ailleurs (data legacy, profil de test, etc.), next/image refuse
// de la rendre — on bascule directement sur le placeholder initiales
// plutôt que de crasher la page entière avec un Runtime Error.
const ALLOWED_IMAGE_HOSTS = [
  "res.cloudinary.com",
  ".supabase.co",
];

function isAllowedHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_IMAGE_HOSTS.some((h) =>
      h.startsWith(".") ? hostname.endsWith(h) : hostname === h,
    );
  } catch {
    return false;
  }
}

interface UserAvatarProps {
  user: User;
  size?: number;
  className?: string;
}

export function UserAvatar({ user, size = 40, className }: UserAvatarProps) {
  // Si l'image échoue à charger en runtime (404, CORS, etc.), on bascule
  // sur les initiales pour ne pas afficher un placeholder cassé.
  const [imageFailed, setImageFailed] = useState(false);
  const fs = Math.round(size * 0.36);

  if (user.deleted) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "var(--color-border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: fs,
          fontWeight: 700,
          color: "var(--color-text-muted)",
          flexShrink: 0,
        }}
      >
        ?
      </div>
    );
  }

  if (user.avatarUrl && !imageFailed && isAllowedHost(user.avatarUrl)) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}
      >
        <Image
          src={user.avatarUrl}
          alt={user.name}
          width={size}
          height={size}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        // Couleur choisie par l'utilisateur dans /settings (profiles.avatar_color)
        // si présente, sinon fallback sur un hash déterministe de l'id pour rester
        // visuellement stable d'un user à l'autre.
        background: user.avatarColor ?? colorFromId(user.id),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fs,
        fontWeight: 700,
        color: "#fff",
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {user.initials}
    </div>
  );
}
