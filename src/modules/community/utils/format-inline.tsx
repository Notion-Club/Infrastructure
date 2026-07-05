import type { ReactNode } from "react";

// Mini-markdown EN LECTURE appliqué à un segment de texte brut :
//   **gras**            → <strong>
//   *italique*          → <em>
//   [libellé](https://) → <a> (le libellé peut différer de l'URL)
//
// Rétro-compatible : tout `*`, `**` ou `[]()` non apparié reste littéral, donc
// un post natif sans ces marqueurs est rendu exactement comme avant.
//
// Le résultat alterne strings (texte non formaté, à passer à linkify ensuite)
// et JSX déjà finalisé (<strong>/<em>/<a> — à NE PAS re-linkifier, sinon l'URL
// d'un lien-libellé serait doublement transformée).
//
// Précédence des alternatives (ordre important) :
//   1. lien  `[label](url)` — consommé en premier pour soustraire son URL à linkify
//   2. gras  `**x**`        — avant l'italique pour que `**` ne soit pas lu comme deux `*`
//   3. italique `*x*`
// Le href n'accepte que http(s) : un `[x](javascript:…)` n'est pas reconnu et
// reste littéral (garde-fou XSS).
const INLINE_RE =
  /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*/g;

// Style des liens-libellés : aligné sur les liens de linkify (brand + underline).
const LINK_STYLE: React.CSSProperties = {
  color: "#e0625a",
  textDecoration: "underline",
  textDecorationColor: "#e0625a",
  textUnderlineOffset: 2,
  fontWeight: 500,
  wordBreak: "break-word",
};

export function formatInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text)) !== null) {
    const [full, linkLabel, linkUrl, boldText, italicText] = match;

    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (linkUrl) {
      parts.push(
        <a
          key={`f-${key++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="nc-inline-link"
          style={LINK_STYLE}
          onClick={(e) => e.stopPropagation()}
        >
          {linkLabel}
        </a>,
      );
    } else if (boldText !== undefined) {
      parts.push(<strong key={`f-${key++}`}>{boldText}</strong>);
    } else {
      parts.push(<em key={`f-${key++}`}>{italicText}</em>);
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
