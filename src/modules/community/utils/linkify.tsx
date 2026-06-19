import type { ReactNode } from "react";

// Matche les URLs http(s) ET les bare-domains (ex: "example.com" sans http).
// Ordre des alternatives important : le pattern http://... est essayé en
// premier pour ne pas être avalé par le pattern bare-domain.
//
// Pattern bare-domain : la partie après le dernier point doit être 2-24
// chars de lettres pures. Pour distinguer un vrai TLD d'une extension de
// fichier (ex: "Attestation.pdf"), on filtre PASSE-2 contre une whitelist
// de TLDs courants (cf. KNOWN_TLDS / FILE_EXT_BLACKLIST). Le regex matche
// large, le filtre code-level rejette les noms de fichiers.
const URL_RE =
  /(https?:\/\/[^\s<>"]+)|(\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}(?:\/[^\s<>"]*)?)/gi;

// Extensions d'image détectables dans une URL HTTP(S). Sert au rendu
// Slack-like (image inline au lieu d'un lien cliquable). Pour les URLs
// bare-domain, on NE rend PAS d'image inline (sinon "logo.png" tout seul
// déclencherait un fetch vers https://logo.png/).
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i;

// Extensions de fichiers connues — quand le "TLD" d'un bare-domain matche
// l'une d'elles, on rejette le match (ce n'est pas une URL, c'est un nom
// de fichier dans le texte). Évite que "Rapport.pdf" devienne un lien
// cassé vers https://rapport.pdf/.
const FILE_EXT_BLACKLIST = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf",
  "zip", "rar", "tar", "gz", "7z",
  "mp3", "mp4", "mov", "avi", "mkv", "wav", "ogg", "webm", "flac",
  "png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "tiff", "ico",
  "exe", "dmg", "pkg", "deb", "apk",
  "json", "xml", "yaml", "yml", "log", "md", "html", "css", "js", "ts", "tsx",
]);

function isImageUrl(url: string): boolean {
  return IMAGE_EXT_RE.test(url);
}

// Le TLD d'un bare-domain est la partie après le dernier point, sans
// query ni path. Si c'est une extension de fichier connue, on rejette.
function looksLikeBareDomain(match: string): boolean {
  // Match http(s):// → toujours OK, on respecte le schéma explicite.
  if (/^https?:\/\//i.test(match)) return true;
  // Extrait le TLD : on coupe au premier /, ? ou #, puis on prend après
  // le dernier point.
  const cleanHost = match.split(/[/?#]/)[0]!;
  const tld = cleanHost.split(".").pop()?.toLowerCase() ?? "";
  return !FILE_EXT_BLACKLIST.has(tld);
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
    const url = match[0];
    // Filtre extension-de-fichier : "Rapport.pdf" matche le regex mais
    // n'est PAS une URL. On ne pousse rien et on continue — le segment
    // sera ramassé par le slice de fin du while ou la prochaine itération.
    if (!looksLikeBareDomain(url)) {
      continue;
    }
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const href = toHref(url);

    // Rendu image inline UNIQUEMENT pour les URLs http(s) explicites —
    // un bare-domain qui se termine par .png/.jpg est filtré par
    // looksLikeBareDomain ci-dessus, donc on n'arrive jamais ici avec
    // "logo.png" tout seul. Mais une URL http://exemple.fr/logo.png
    // déclenche bien le rendu image.
    if (isImageUrl(url) && /^https?:\/\//i.test(url)) {
      // Rendu inline image style Slack — max 320px de large/haut. Le click
      // émet un événement custom 'nc-image-open' capté par un listener
      // global (cf. ImageLightboxRoot) qui ouvre une lightbox plein écran.
      // Évite de devoir propager un onImageClick à travers tous les call
      // sites de renderBodyRich.
      const finalHref = href;
      parts.push(
        <button
          key={match.index}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            window.dispatchEvent(
              new CustomEvent("nc-image-open", { detail: { url: finalHref } }),
            );
          }}
          style={{
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "zoom-in",
            display: "block",
            maxWidth: "100%",
            marginTop: 6,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={finalHref}
            alt=""
            style={{
              // Plafonné à 320px mais jamais plus large que le conteneur du post.
              maxWidth: "min(320px, 100%)",
              maxHeight: 320,
              borderRadius: 10,
              border: "1px solid var(--color-border-default)",
              display: "block",
              objectFit: "cover",
            }}
            loading="lazy"
          />
        </button>,
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
