// Payments API — GET renvoie la liste des paiements de l'utilisateur courant
// tels qu'ils sont enregistrés dans la base Notion `Paiements`.
//
// V2 — Matching simplifié via `Membre` (relation directe → DB Membres) au lieu
// du double round-trip `E-mail Guest` → DB Calls → DB Paiements.
//
//   1. Lecture profiles.notion_member_page_id (rempli au 1er clic
//      "Réserver coaching" via ensureNotionMemberPage — pattern existant).
//   2. Query DB Paiements filter: `Membre.relation.contains <memberPageId>`.
//
// Avantages :
//   - 1 seul round-trip Notion (au lieu de 2)
//   - Match déterministe par membre (au lieu de l'email du Call, qui peut
//     varier si l'admin a saisi plusieurs Calls avec des emails différents
//     pour la même personne au fil du temps)
//   - Cohérent avec le matching coaching (PR #113)
//
// Fallback : si l'user n'a pas de notion_member_page_id (jamais ouvert
// /coaching), on retourne `payments: []`. C'est l'état attendu — un user qui
// n'est passé que par signup email n'a pas encore de page Notion liée donc
// pas de paiements à fetch.
//
// Variables d'env :
//   - NOTION_API_TOKEN              (déjà existant — widget feedback, coaching)
//   - NOTION_PAYMENTS_DATABASE_ID   override DB Paiements (optionnel, staging)
//
// Lecture seule. `cache: "no-store"` pour toujours refléter l'état Notion
// courant (l'admin met à jour les paiements à la main).

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { ensureNotionMemberPage } from "@/modules/coaching/server/ensureNotionMemberPage";

export const dynamic = "force-dynamic";

const CORS = { "Content-Type": "application/json" };

const PAYMENTS_DATABASE_ID = "2a1bad05-6a95-80cc-b34d-c3bc28ad2d1d";

// ───────────────────────────────────────────────────────────────────────────
// Types Notion partiels — uniquement les propriétés qu'on lit. On reste
// permissif (chaque champ optionnel) parce que la base est éditée à la main
// par l'admin et qu'une propriété renommée ne doit pas crasher la route.

interface NotionTitleProp {
  title: Array<{ plain_text?: string; text?: { content?: string } }>;
}

interface NotionSelectProp {
  select: { name: string; color?: string } | null;
}

interface NotionNumberProp {
  number: number | null;
}

interface NotionDateProp {
  date: { start: string | null } | null;
}

interface PaymentPage {
  id: string;
  url?: string;
  created_time?: string;
  properties: {
    Nom?: NotionTitleProp;
    "Montant TTC"?: NotionNumberProp;
    "Montant HT"?: NotionNumberProp;
    "Date de Paiement"?: NotionDateProp;
    Source?: NotionSelectProp;
    Statut?: NotionSelectProp;
  };
}

function readTitle(prop?: NotionTitleProp): string {
  const first = prop?.title?.[0];
  return first?.plain_text ?? first?.text?.content ?? "";
}

// Statut Notion → catégorie business simple pour le front. Les options
// existantes en base sont "À payer" / "Payé" / "Refus".
function mapStatut(
  statut: string | null,
): "paid" | "due" | "refused" | "unknown" {
  if (!statut) return "unknown";
  if (statut === "Payé") return "paid";
  if (statut === "À payer") return "due";
  if (statut === "Refus") return "refused";
  return "unknown";
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: CORS },
    );
  }

  const token = process.env.NOTION_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Configuration serveur manquante (NOTION_API_TOKEN)" },
      { status: 500, headers: CORS },
    );
  }

  // Résout (ou crée / matche par email) la page Notion Membre du user. Idem
  // pattern coaching : si la page existe déjà côté Notion (ancien membre),
  // on la matche par email + tagge l'UUID Supabase ; sinon création. Le
  // notion_member_page_id est persisté dans profiles pour la prochaine fois.
  //
  // Cette étape déclenche entre 0 (cache hit) et 2 round-trips Notion au
  // premier appel — mais c'est idempotent : appels suivants tombent en cache
  // direct via profiles.notion_member_page_id.
  const member = await ensureNotionMemberPage();
  if (!member.ok || !member.notionPageId) {
    // Pas de page Notion liée ET impossible d'en créer une → on retourne 0
    // paiement. L'user n'a tout simplement aucune trace dans le CRM côté admin.
    return NextResponse.json({ payments: [] }, { headers: CORS });
  }

  const paymentsDbId =
    process.env.NOTION_PAYMENTS_DATABASE_ID ?? PAYMENTS_DATABASE_ID;

  try {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${paymentsDbId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            property: "Membre",
            relation: { contains: member.notionPageId },
          },
          sorts: [
            // Date de Paiement DESC : les plus récents (ou les à-venir
            // datés) en premier. Les paiements sans date sortent en fin
            // de liste — c'est le comportement Notion par défaut.
            {
              property: "Date de Paiement",
              direction: "descending",
            },
          ],
          page_size: 100,
        }),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[payments/me] query error:", JSON.stringify(err));
      return NextResponse.json(
        {
          error: `Notion a retourné ${res.status} — vérifiez la connexion de l'intégration à la base Paiements.`,
        },
        { status: 502, headers: CORS },
      );
    }

    const data = await res.json();
    const pages: PaymentPage[] = data.results ?? [];

    const payments = pages.map((p) => {
      const statutRaw = p.properties.Statut?.select?.name ?? null;
      return {
        notionId: p.id,
        notionUrl: p.url ?? null,
        label: readTitle(p.properties.Nom),
        amount: p.properties["Montant TTC"]?.number ?? null,
        amountHt: p.properties["Montant HT"]?.number ?? null,
        paymentDate: p.properties["Date de Paiement"]?.date?.start ?? null,
        source: p.properties.Source?.select?.name ?? null,
        status: statutRaw,
        statusCategory: mapStatut(statutRaw),
      };
    });

    return NextResponse.json({ payments }, { headers: CORS });
  } catch (err) {
    console.error("[payments/me] error:", err);
    return NextResponse.json(
      { error: "Erreur interne" },
      { status: 500, headers: CORS },
    );
  }
}
