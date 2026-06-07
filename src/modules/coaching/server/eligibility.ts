// Lecture de l'éligibilité coaching depuis la DB Notion Membres.
//
// Notion porte déjà toute la logique métier (formule "Éligible au Call") :
//   - Formation uniquement : éligible si 0 call accepté
//   - Accompagnement : éligible si < 2 calls cette semaine OU si on est week-end
//   - "Hors quota" et "Refusé" sont exclus du compte
//
// On lit aussi "Alerte Calls" qui contient un message contextuel long
// (nombre de calls restants, date de fin de suivi, etc.) — affiché en
// sous-titre / tooltip du bouton CTA.
//
// Best-effort : si Notion KO ou pas configuré, on retourne `null` →
// l'UI retombe sur le comportement par défaut (mocks DevStateSwitcher).

import {
  notionFetch,
  normalizeNotionId,
  getRichText,
  type NotionPage,
} from "@/shared/lib/notion/client";
import { ensureNotionMemberPage } from "./ensureNotionMemberPage";

const PROP_ELIGIBLE = "Éligible au Call"; // formula → "éligible" | "pas éligible"
const PROP_ALERTE = "Alerte Calls"; // formula → texte riche, message long
const PROP_OFFRE = "Offre"; // select → "Formation uniquement" | "Accompagnement …"

// Extractors typés pour les types de propriétés Notion non couverts par client.ts.
type PropFormulaString = {
  type: "formula";
  formula: { type: "string"; string: string | null };
};
type PropSelect = {
  type: "select";
  select: { name: string } | null;
};

function getFormulaString(page: NotionPage, prop: string): string {
  const p = page.properties[prop] as PropFormulaString | undefined;
  return p?.formula?.string ?? "";
}

function getSelectName(page: NotionPage, prop: string): string | null {
  const p = page.properties[prop] as PropSelect | undefined;
  return p?.select?.name ?? null;
}

export interface CoachingEligibility {
  // Sortie brute de la formule Notion — utilisée pour griser le CTA.
  isEligible: boolean;
  // Message long contextuel (week-end / quota / date de fin) — sous-titre / tooltip.
  alertMessage: string;
  // Offre du membre (Formation uniquement / Accompagnement / …).
  // null si non renseigné côté Notion.
  offer: string | null;
}

export async function getCoachingEligibilityForCurrentUser(): Promise<CoachingEligibility | null> {
  const member = await ensureNotionMemberPage();
  if (!member.ok || !member.notionPageId) return null;

  try {
    // GET direct sur la page Membre — récupère TOUTES les properties d'un coup.
    // Plus simple qu'un databases.query avec filtre — on a déjà le pageId.
    const page = await notionFetch<NotionPage>(
      `/pages/${normalizeNotionId(member.notionPageId)}`,
      { method: "GET" },
    );

    const raw = getFormulaString(page, PROP_ELIGIBLE).trim().toLowerCase();
    // La formule peut renvoyer "éligible" ou "pas éligible" — on normalise
    // en commençant par exclure le cas négatif (sinon "éligible" matche dans
    // "pas éligible").
    const isEligible = raw === "éligible" || raw === "eligible";

    // "Alerte Calls" est une formule qui renvoie potentiellement du rich_text
    // formaté (avec styles). On essaie d'abord la valeur string brute, et on
    // fallback sur richText si la formule retourne autre chose qu'un string.
    let alertMessage = getFormulaString(page, PROP_ALERTE).trim();
    if (!alertMessage) {
      alertMessage = getRichText(page, PROP_ALERTE).trim();
    }

    const offer = getSelectName(page, PROP_OFFRE);

    return { isEligible, alertMessage, offer };
  } catch (err) {
    console.error(
      "[getCoachingEligibility] failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
