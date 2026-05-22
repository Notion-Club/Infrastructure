type Props = {
  label: string;
};

// Séparateur visuel pour grouper les modules par section dans le
// programme "Devenir consultant Notion" (Architecte / Business). Pas un
// titre hiérarchique — juste un small caps + ligne fine de chaque côté.
export function SectionDivider({ label }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        margin: "12px 0 4px 0",
      }}
    >
      <div
        style={{
          flex: 1,
          height: 0.5,
          background: "var(--color-border-default)",
        }}
      />
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: "var(--color-text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 0.5,
          background: "var(--color-border-default)",
        }}
      />
    </div>
  );
}
