// ───────────────────────────────────────────────────────────────────────
// Compat : ce module ré-exporte le RENDERER Notion unifié (./NotionRenderer).
// `NotionBlocks` est conservé comme alias de `NotionRenderer` pour ne pas
// casser les imports existants (Formation, Coaching).
//
//   import { NotionBlocks } from "@/shared/components/notion/NotionBlocks"
//
// → migrer progressivement vers `NotionRenderer`.
// ───────────────────────────────────────────────────────────────────────

export { NotionRenderer, NotionBlocks } from "./NotionRenderer";
export type { NotionRendererProps, NotionDensity } from "./NotionRenderer";
