// Payments API — GET renvoie la liste des paiements de l'utilisateur courant
// tels qu'ils sont enregistrés dans la base Notion `Paiements`.
//
// Le matching utilisateur → paiements se fait en 2 étapes parce que la DB
// Paiements n'a pas d'email : elle pointe vers la DB `Calls` via la relation
// `Lead`, et c'est la DB `Calls` qui porte la propriété `E-mail Guest`.
//
//   1. Query DB Calls          filter: `E-mail Guest = auth.email`
//      → on récupère les IDs Notion des Calls du prospect
//   2. Query DB Paiements      filter: `Lead.relation.contains <call-id>`
//                              (combiné en `or` si plusieurs Calls matchent)
//      → on récupère et normalise la liste des paiements
//
// Variables d'env :
//   - NOTION_API_TOKEN                  (déjà existant — widget feedback)
//   - NOTION_SALES_CALL_DATABASE_ID     override DB Calls (optionnel, staging)
//   - NOTION_PAYMENTS_DATABASE_ID       override DB Paiements (optionnel, staging)
//
// Aucune écriture, lecture seule. `cache: "no-store"` pour toujours refléter
// l'état Notion courant (l'admin met à jour à la main).
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

const CORS = { "Content-Type": "application/json" };

// IDs Notion transmis par l'admin via les tickets OPS-41 (Roadmap de Production).
const SALES_CALL_DATABASE_ID = "1d4bad05-6a95-808e-8997-d8f73838d2df";
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

interface NotionRelationProp {
  relation: Array<{ id: string }>;
}

interface NotionEmailProp {
  email: string | null;
}

interface CallPage {
  id: string;
  properties: {
    "E-mail Guest"?: NotionEmailProp;
  };
}

interface PaymentPage {
  id: string;
  url?: string;
  created_time?: string;
  properties: {
    Nom?: NotionTitleProp;
    "Montant TTC"?: NotionNumberProp;
    "Date de Paiement"?: NotionDateProp;
    Source?: NotionSelectProp;
    Statut?: NotionSelectProp;
    Lead?: NotionRelationProp;
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

async function queryNotion(dbId: string, body: object, token: string) {
  return fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user || !authData.user.email) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: CORS },
    );
  }

  const userEmail = authData.user.email.trim().toLowerCase();

  const token = process.env.NOTION_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Configuration serveur manquante (NOTION_API_TOKEN)" },
      { status: 500, headers: CORS },
    );
  }

  const callsDbId =
    process.env.NOTION_SALES_CALL_DATABASE_ID ?? SALES_CALL_DATABASE_ID;
  const paymentsDbId =
    process.env.NOTION_PAYMENTS_DATABASE_ID ?? PAYMENTS_DATABASE_ID;

  try {
    // ─── Étape 1 : trouver les Calls correspondant à l'utilisateur ────────
    const callsRes = await queryNotion(
      callsDbId,
      {
        filter: {
          property: "E-mail Guest",
          email: { equals: userEmail },
        },
        page_size: 25,
      },
      token,
    );

    if (!callsRes.ok) {
      const err = await callsRes.json().catch(() => ({}));
      console.error("[payments/me] Calls query error:", JSON.stringify(err));
      return NextResponse.json(
        {
          error: `Notion (Calls) a retourné ${callsRes.status} — vérifiez le token et la connexion de l'intégration.`,
        },
        { status: 502, headers: CORS },
      );
    }

    const callsData = await callsRes.json();
    const calls: CallPage[] = callsData.results ?? [];
    const callIds = calls.map((c) => c.id);

    if (callIds.length === 0) {
      // Pas de Call rattaché à cet email → pas de paiements à afficher.
      return NextResponse.json({ payments: [] }, { headers: CORS });
    }

    // ─── Étape 2 : récupérer les Paiements liés à ces Calls ───────────────
    // Filtre Notion : `or` de `Lead.relation.contains <callId>` pour matcher
    // n'importe quel Call de l'utilisateur. Un seul Lead suffit à inclure
    // la ligne (les paiements ont 1 Lead, mais on reste générique).
    const leadFilter =
      callIds.length === 1
        ? {
            property: "Lead",
            relation: { contains: callIds[0] },
          }
        : {
            or: callIds.map((id) => ({
              property: "Lead",
              relation: { contains: id },
            })),
          };

    const paymentsRes = await queryNotion(
      paymentsDbId,
      {
        filter: leadFilter,
        sorts: [
          {
            property: "Date de Paiement",
            direction: "descending",
          },
        ],
        page_size: 100,
      },
      token,
    );

    if (!paymentsRes.ok) {
      const err = await paymentsRes.json().catch(() => ({}));
      console.error("[payments/me] Payments query error:", JSON.stringify(err));
      return NextResponse.json(
        {
          error: `Notion (Paiements) a retourné ${paymentsRes.status} — vérifiez la connexion de l'intégration à la base Paiements.`,
        },
        { status: 502, headers: CORS },
      );
    }

    const paymentsData = await paymentsRes.json();
    const pages: PaymentPage[] = paymentsData.results ?? [];

    const payments = pages.map((p) => {
      const statutRaw = p.properties.Statut?.select?.name ?? null;
      return {
        notionId: p.id,
        notionUrl: p.url ?? null,
        label: readTitle(p.properties.Nom),
        amount: p.properties["Montant TTC"]?.number ?? null,
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
