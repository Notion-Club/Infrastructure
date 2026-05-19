'use client';

const NotionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <rect width="100" height="100" rx="14" fill="black" />
    <path d="M24 20h52v8L48 72H76v8H24v-8l28-44H24V20z" fill="white" />
  </svg>
);

interface DuplicateButtonProps {
  url: string;
}

export function DuplicateButton({ url }: DuplicateButtonProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 24px',
          borderRadius: 9999,
          background: '#000',
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          textDecoration: 'none',
          transition: 'opacity 150ms ease',
        }}
        className="hover:opacity-80"
      >
        <NotionIcon />
        Dupliquer ce template
      </a>
      <p
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Ouvre la page Notion publique du template. Clique sur &ldquo;Dupliquer&rdquo; en haut à droite pour l&rsquo;ajouter à ton espace.
      </p>
    </div>
  );
}
