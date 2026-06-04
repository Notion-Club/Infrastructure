// Opérations Notion en ÉCRITURE.
//
// ⚠️  Server-only. Le token ne doit jamais atteindre le navigateur.
//
// Première écriture côté NotionClub : createNotionMember, appelée au signup
// pour créer une page dans la DB Notion Membres et y stocker le mapping
// UUID Supabase ↔ page Notion (clé de tous les flows coaching/membres).
//
// Best-effort : si l'env var NOTION_MEMBERS_DATABASE_ID est absente ou que
// l'intégration n'est pas connectée à la DB, on log et on retourne null sans
// faire échouer le caller. Idempotence : skip si profiles.notion_member_page_id
// est déjà set (vérification côté caller).

import { notionFetch, type NotionPage } from "./client";

export interface CreateNotionMemberInput {
  uuid: string; // = profiles.id Supabase, sert de clé de réconciliation
  firstName: string | null;
  lastName: string | null;
  email: string;
}

// Crée une page dans la DB Notion Membres. Retourne l'ID Notion (UUID avec
// tirets) ou null en cas d'échec/désactivation.
//
// Schéma attendu côté Notion (Théo configure la DB pour matcher) :
//   - "Name"  : title (rempli avec firstName + lastName, fallback email)
//   - "Email" : email
//   - "UUID"  : rich_text (UUID Supabase pour réconciliation)
//
// Si le schéma diffère (ex: noms français), la création échouera avec un
// validation_error Notion — on log mais on ne throw pas.
export async function createNotionMember(
  input: CreateNotionMemberInput,
): Promise<string | null> {
  const databaseId = process.env.NOTION_MEMBERS_DATABASE_ID;
  if (!databaseId) {
    // Pas configuré → silencieux. Permet de déployer sans casser le signup
    // tant que Théo n'a pas connecté la DB Notion Membres à l'intégration.
    return null;
  }

  const fullName =
    [input.firstName, input.lastName].filter(Boolean).join(" ").trim() ||
    input.email;

  try {
    const page = await notionFetch<NotionPage>("/pages", {
      method: "POST",
      body: {
        parent: { database_id: databaseId },
        properties: {
          Name: {
            title: [{ text: { content: fullName } }],
          },
          Email: {
            email: input.email,
          },
          UUID: {
            rich_text: [{ text: { content: input.uuid } }],
          },
        },
      },
    });
    return page.id;
  } catch (err) {
    console.error(
      "[createNotionMember] failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
