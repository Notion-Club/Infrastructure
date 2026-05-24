import Image from "next/image";
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

interface UserAvatarProps {
  user: User;
  size?: number;
  className?: string;
}

export function UserAvatar({ user, size = 40, className }: UserAvatarProps) {
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

  if (user.avatarUrl) {
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
        background: colorFromId(user.id),
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
