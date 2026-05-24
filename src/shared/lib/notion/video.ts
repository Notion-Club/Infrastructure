// Construit le `src` d'une iframe vidéo en PRÉSERVANT la query string de
// l'URL (paramètres d'affichage Tella : ?b=0&title=0&a=1…). On ne reconstruit
// jamais l'URL en jetant ses paramètres — sinon les réglages posés dans Notion
// ne se reflètent pas dans le player.
//
// Pure fonction (pas de token) → importable côté client comme serveur.
export function toEmbedSrc(url: string): string {
  // Déjà une URL /embed (cas du body Notion) → on la garde telle quelle.
  if (/\/embed(\?|#|$)/.test(url)) return url;
  // Lien /view ou /video/<id> → /embed, en conservant la query string.
  const m = url.match(/tella\.tv\/video\/([^/?#]+)/);
  if (m) {
    const q = url.indexOf("?");
    return `https://www.tella.tv/video/${m[1]}/embed${q >= 0 ? url.slice(q) : ""}`;
  }
  return url;
}
