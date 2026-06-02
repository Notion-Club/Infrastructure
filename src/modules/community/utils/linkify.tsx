import type { ReactNode } from "react";

// Matche les URLs http(s) ET les bare-domains (ex: "example.com" sans http).
// Ordre des alternatives important : le pattern http://... est essayé en
// premier pour ne pas être avalé par le pattern bare-domain.
//
// Pattern bare-domain : (subdomain.)+tld où tld est 2-24 chars de lettres
// pures (couvre .com / .fr / .museum / .academy sans matcher des points
// dans des phrases type "Bonjour. Comment ça va.").
const URL_RE =
  /(https?:\/\/[^\s<>"]+)|(\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}(?:\/[^\s<>"]*)?)/gi;

// Extensions d'image détectables dans une URL. Sert au rendu Slack-like
// (image inline au lieu d'un lien cliquable).
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i;

function isImageUrl(url: string): boolean {
  return IMAGE_EXT_RE.test(url);
}

// Convertit un match bare-domain ("example.com") en URL absolue ouvrable.
// Pour les http(s) explicites on ne touche à rien.
function toHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function linkify(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    const href = toHref(url);

    if (isImageUrl(url)) {
      // Rendu inline image style Slack — max 320px de large, max 320px de
      // haut, ratio préservé, click pour ouvrir l'original dans un onglet.
      parts.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ display: "inline-block", marginTop: 6 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={href}
            alt=""
            style={{
              maxWidth: 320,
              maxHeight: 320,
              borderRadius: 10,
              border: "1px solid var(--color-border-default)",
              display: "block",
              objectFit: "cover",
            }}
            loading="lazy"
          />
        </a>,
      );
    } else {
      parts.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="nc-inline-link"
          style={{
            color: "#e0625a",
            textDecoration: "underline",
            textDecorationColor: "#e0625a",
            textUnderlineOffset: 2,
            fontWeight: 500,
            wordBreak: "break-word",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>,
      );
    }
    lastIndex = match.index + url.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
