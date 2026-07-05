// Détection d'URL vidéo → source d'embed, pour rendre un iframe player à la place
// d'un lien nu (feed, détail, commentaires). ALLOWLIST STRICTE : seuls les
// providers listés ci-dessous produisent un embed — jamais d'iframe pour une URL
// arbitraire (aucun risque d'injecter une origine tierce non maîtrisée).

export type VideoProvider = "youtube" | "loom" | "tella" | "vimeo";

export interface VideoEmbedMatch {
  provider: VideoProvider;
  /** URL à mettre dans l'iframe. */
  embedSrc: string;
  /** URL brute trouvée dans le texte — sert à la retirer du body au rendu (sinon
   *  on afficherait l'embed ET le lien nu en double). */
  matchedUrl: string;
}

// Chaque provider : une regex qui matche le token URL COMPLET (query/fragment
// compris → retrait propre du texte) et capture l'id, plus la fabrique de la
// source d'embed. Le schéma http(s) est optionnel pour YouTube (repris des
// helpers composer existants) ; requis pour les autres.
const PROVIDERS: {
  provider: VideoProvider;
  re: RegExp;
  embed: (id: string) => string;
}[] = [
  {
    provider: "youtube",
    // Schéma REQUIS : sans lui, `youtube.com` matchait en sous-chaîne d'un
    // domaine tiers (ex. `notyoutube.com`) → trou dans l'allowlist.
    re: /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)(?:[?&#][^\s]*)?/i,
    embed: (id) => `https://www.youtube.com/embed/${id}`,
  },
  {
    provider: "loom",
    re: /https?:\/\/(?:www\.)?loom\.com\/share\/([a-z0-9]+)(?:[?&#][^\s]*)?/i,
    embed: (id) => `https://www.loom.com/embed/${id}`,
  },
  {
    provider: "tella",
    re: /https?:\/\/(?:www\.)?tella\.tv\/video\/([a-z0-9-]+)(?:[/?&#][^\s]*)?/i,
    embed: (id) => `https://www.tella.tv/video/${id}/embed`,
  },
  {
    provider: "vimeo",
    re: /https?:\/\/(?:www\.)?vimeo\.com\/(\d+)(?:[/?&#][^\s]*)?/i,
    embed: (id) => `https://player.vimeo.com/video/${id}`,
  },
];

/**
 * Retourne le PREMIER embed vidéo trouvé dans le texte (par position dans la
 * chaîne, tous providers confondus), ou null si aucun provider de l'allowlist
 * ne matche.
 */
export function detectVideoEmbed(text: string): VideoEmbedMatch | null {
  if (!text) return null;
  let best: (VideoEmbedMatch & { index: number }) | null = null;
  for (const p of PROVIDERS) {
    const m = p.re.exec(text);
    if (m && m.index != null && (best === null || m.index < best.index)) {
      best = {
        index: m.index,
        provider: p.provider,
        embedSrc: p.embed(m[1]!),
        matchedUrl: m[0],
      };
    }
  }
  return best === null
    ? null
    : { provider: best.provider, embedSrc: best.embedSrc, matchedUrl: best.matchedUrl };
}
