type ProgressBarProps = {
  percent: number;
  from?: string;
  to?: string;
};

export function ProgressBar({ percent, from, to }: ProgressBarProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          height: 5,
          background: "var(--color-border-default)",
          borderRadius: 9999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            background: "var(--color-brand)",
            borderRadius: 9999,
            transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
      {(from || to) && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {from && (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {from}
            </span>
          )}
          {to && (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {to}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
