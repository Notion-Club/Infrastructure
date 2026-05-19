function SkeletonCard() {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid var(--color-border-default)",
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0f0f0" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ width: 120, height: 12, borderRadius: 6, background: "#f0f0f0" }} />
          <div style={{ width: 80, height: 10, borderRadius: 6, background: "#f5f5f5" }} />
        </div>
      </div>
      {/* Body */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ width: "90%", height: 12, borderRadius: 6, background: "#f0f0f0" }} />
        <div style={{ width: "75%", height: 12, borderRadius: 6, background: "#f5f5f5" }} />
        <div style={{ width: "60%", height: 12, borderRadius: 6, background: "#f5f5f5" }} />
      </div>
      {/* Footer */}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 60, height: 10, borderRadius: 6, background: "#f0f0f0" }} />
        <div style={{ width: 60, height: 10, borderRadius: 6, background: "#f0f0f0" }} />
      </div>
    </div>
  );
}

export function FeedSkeletonState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
