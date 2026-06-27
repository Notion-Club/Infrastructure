// ───────────────────────────────────────────────────────────────────────
// Compat : ce module est désormais un ré-export du ROUTEUR Notion unifié
// (./router.ts), qui est la source unique de fetch + normalisation des blocs
// pour TOUTE l'infrastructure (Formation, Coaching, Ressources).
//
// Conservé pour ne pas casser les imports existants :
//   import { fetchPageBlocks, type NotionBlock, type RichSpan } from "@/shared/lib/notion/blocks"
//
// → migrer progressivement ces imports vers "@/shared/lib/notion/router".
// ───────────────────────────────────────────────────────────────────────

export * from "./router";
