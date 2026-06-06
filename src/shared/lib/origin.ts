// Détermine l'URL canonique de l'app (origin) pour construire des liens
// absolus côté server. Pattern déjà utilisé dans :
//   - src/modules/auth/server/email.ts (links email)
//   - src/modules/auth/server/actions.ts (redirects)
//   - src/modules/community/server/dm-email.ts (DM emails)
//
// Réutilisé ici pour les URLs publiques de transcription (envoyées à
// ChatGPT/Claude — doivent être absolues sinon le browse tool des LLMs
// échoue).

const FALLBACK = "https://app.notionclub.fr";

export function getOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? FALLBACK;
}
