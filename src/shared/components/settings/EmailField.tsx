"use client";

// EmailField — champ email simple de la section compte.
//
// Anciennement un encadré en deux parties (mail de connexion + mail Notion
// séparé optionnel). Le mail Notion a été supprimé : on garde un seul champ
// basique, aligné sur le layout du numéro de téléphone (label + `.nc-input`).

type EmailFieldProps = {
  id?: string;
  label?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

export function EmailField({
  id = "platform-email",
  label = "Ton mail",
  value,
  error,
  onChange,
  onBlur,
}: EmailFieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-text-secondary)",
        }}
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="email"
        inputMode="email"
        autoComplete="email"
        data-fb-label="Champ Email Notion Club · Section compte"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        placeholder="vous@exemple.com"
        className="nc-input"
        style={{ borderColor: error ? "var(--color-brand)" : undefined }}
      />
      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-brand)",
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
