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

interface NotionMemberLookup {
  pageId: string;       // ID Notion canonique (UUID avec tirets)
  currentUuid: string | null; // UUID Supabase déjà écrit, null si page créée
                              //   manuellement par Théo (ancien membre)
}

interface NotionQueryResponse {
  results: NotionPage[];
}

// Cherche une page Membre dans la DB Notion par email. Sert au signup et au
// premier clic "Réserver" pour réconcilier les anciens membres (créés à la
// main par Théo) avec leur nouveau profile Supabase, sans créer de doublon.
//
// Retourne :
//   - null si la DB n'est pas configurée, ou si aucune page ne matche, ou
//     en cas d'erreur Notion (best-effort, log).
//   - { pageId, currentUuid } si une page existe : currentUuid est l'UUID
//     déjà écrit dans la propriété "UUID" si présent, sinon null (cas typique
//     d'un ancien membre qu'il faudra mettre à jour via updateNotionMemberUuid).
export async function findNotionMemberByEmail(
  email: string,
): Promise<NotionMemberLookup | null> {
  const databaseId = process.env.NOTION_MEMBERS_DATABASE_ID;
  if (!databaseId) return null;

  try {
    const data = await notionFetch<NotionQueryResponse>(
      `/databases/${databaseId}/query`,
      {
        method: "POST",
        body: {
          filter: { property: NOTION_PROP_EMAIL, email: { equals: email } },
          page_size: 1,
        },
      },
    );

    const page = data.results?.[0];
    if (!page) return null;

    const uuidProp = page.properties?.[NOTION_PROP_UUID];
    const currentUuid =
      uuidProp?.rich_text?.map((t) => t.plain_text).join("").trim() || null;

    return { pageId: page.id, currentUuid };
  } catch (err) {
    console.error(
      "[findNotionMemberByEmail] failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// Met à jour la propriété UUID d'une page Notion Membres existante. Utilisé
// lors de la réconciliation d'un ancien membre Notion avec son nouveau
// profile Supabase. Idempotent côté Notion : un PATCH sur une valeur égale
// ne change rien.
//
// Retourne true si l'update a réussi, false sinon (log).
export async function updateNotionMemberUuid(
  pageId: string,
  uuid: string,
): Promise<boolean> {
  try {
    await notionFetch<NotionPage>(`/pages/${pageId}`, {
      method: "PATCH",
      body: {
        properties: {
          [NOTION_PROP_UUID]: {
            rich_text: [{ text: { content: uuid } }],
          },
        },
      },
    });
    return true;
  } catch (err) {
    console.error(
      "[updateNotionMemberUuid] failed:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

// Schéma réel de la DB Notion Membres (vérifié via API le 2026-06-05) :
//   - "Nom"          (title)      → rempli avec firstName + lastName, fallback email
//   - "E-mail"       (email)      → email
//   - "UUID Supabase" (rich_text) → profiles.id pour la réconciliation
//   - "Éligible au Call" (formula) → géré par Théo, on n'écrit pas
//
// On centralise les noms dans des constantes pour les changer en un seul
// endroit si la DB évolue.
const NOTION_PROP_TITLE = "Nom";
const NOTION_PROP_EMAIL = "E-mail";
const NOTION_PROP_UUID = "UUID Supabase";

// Crée une page dans la DB Notion Membres. Retourne l'ID Notion (UUID avec
// tirets) ou null en cas d'échec/désactivation.
//
// Si le schéma Notion diverge (renommage de colonne par Théo), la création
// échouera avec un validation_error Notion — on log mais on ne throw pas.
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
          [NOTION_PROP_TITLE]: {
            title: [{ text: { content: fullName } }],
          },
          [NOTION_PROP_EMAIL]: {
            email: input.email,
          },
          [NOTION_PROP_UUID]: {
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
