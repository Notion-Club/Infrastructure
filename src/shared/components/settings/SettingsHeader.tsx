function getInitials(displayName: string | null, email: string): string {
  const source = (displayName ?? email).trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

// Deterministic pastel from a string — same source always picks same color.
function colorFromName(seed: string): string {
  const palette = [
    "#e0625a",
    "#5b8def",
    "#8a6cf2",
    "#27ae8e",
    "#ed9d3a",
    "#c97c97",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length]!;
}

type SettingsHeaderProps = {
  avatarUrl: string | null;
  displayName: string | null;
  email: string;
};

export function SettingsHeader({
  avatarUrl,
  displayName,
  email,
}: SettingsHeaderProps) {
  const initials = getInitials(displayName, email);
  const bg = colorFromName(displayName ?? email);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "8px 0 4px",
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: "50%",
          overflow: "hidden",
          background: bg,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "0.02em",
          boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
          border: "3px solid white",
        }}
        aria-hidden
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initials
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          {displayName?.trim() || email}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text-muted)",
          }}
        >
          {email}
        </p>
      </div>
    </div>
  );
}
