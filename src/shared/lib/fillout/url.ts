// Construction d'URL Fillout avec pré-remplissage.
//
// Fillout supporte le pré-remplissage de champs cachés via query string : il
// faut que les params attendus soient configurés côté form
// (Settings → URL parameters → ajouter le param).
//
// Côté form "Coaching du Notion Club" (formId 1XNPkBy855us), les params
// déclarés sont :
//   - id        → filtre le RecordPicker sur la DB Notion Membres
//   - mail      → pré-remplit l'email
//   - prenom    → pré-remplit le prénom (msg dynamique "Bonjour {prenom}")
//   - nom       → pré-remplit le nom
//
// Toute valeur null/undefined est omise de l'URL pour éviter les "?prenom=null".

export interface FilloutPrefillParams {
  id?: string | null;
  mail?: string | null;
  prenom?: string | null;
  nom?: string | null;
}

export function buildFilloutUrl(
  baseUrl: string,
  params: FilloutPrefillParams,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const trimmed = String(value).trim();
    if (trimmed.length === 0) continue;
    search.set(key, trimmed);
  }
  const qs = search.toString();
  return qs.length > 0 ? `${baseUrl}?${qs}` : baseUrl;
}
