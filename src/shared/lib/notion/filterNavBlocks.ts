// Filtre les blocs de navigation présents au début des pages d'appels Notion.
//
// Les pages d'appels créées par Théo dans la DB Notion "Appel de Suivi"
// contiennent en tête un paragraphe "↩ Revenir aux appels" qui pointe vers
// la DB parente — utile dans Notion, mais sans valeur dans NotionClub.
// On retire ce paragraphe + le divider qui le suit éventuellement.
//
// Partagé entre la Server Action `getCallTranscriptionBlocks` (modale détail
// onglet Transcript) et la route publique `/transcript/[token]`
// (servie à ChatGPT/Claude).

import type { NotionBlock } from "./blocks";

export function filterNavBlocks(blocks: NotionBlock[]): NotionBlock[] {
  if (blocks.length === 0) return blocks;
  const out = [...blocks];
  // Drop tête : si le 1er bloc est un paragraphe qui contient "Revenir aux
  // appels" (avec ou sans flèche), on l'enlève. Match permissif.
  const first = out[0];
  if (first.type === "paragraph" && first.rich) {
    const text = first.rich
      .map((s) => s.text)
      .join("")
      .toLowerCase();
    if (text.includes("revenir aux appels")) {
      out.shift();
      // Si juste derrière il y a un divider, on l'enlève aussi (séparait nav
      // du contenu).
      if (out[0]?.type === "divider") out.shift();
    }
  }
  return out;
}
