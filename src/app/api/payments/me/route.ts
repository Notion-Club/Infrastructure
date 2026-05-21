// Payments API — GET renvoie l'engagement de paiement de l'utilisateur courant
// tel qu'il est enregistré dans la base Notion "Calls" (DB SalesCall), filtré
// par `E-mail Guest = auth.email`.
//
// Variables d'env : NOTION_API_TOKEN (token de l'intégration NotionClub, déjà
// configurée pour la base de tickets feedback côté /api/feedback).
// NOTION_SALES_CALL_DATABASE_ID en override optionnel — sinon fallback sur
// l'ID hardcodé (transmis en session par l'admin via le ticket OPS-41).
//
// Aucune écriture, lecture seule. Cache: no-store pour toujours refléter
// l'état Notion (l'admin met à jour les Calls manuellement).
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

const CORS = { "Content-Type": "application/json" };

// ID Notion de la base "Calls" (alias SalesCall) — transmis dans le ticket
// OPS-41. La propriété `E-mail Guest` est la clé de jointure avec l'auth user.
const SALES_CALL_DATABASE_ID = "1d4bad05-6a95-808e-8997-d8f73838d2df";

// ───────────────────────────────────────────────────────────────────────────
// Types Notion — uniquement les propriétés qu'on lit côté serveur. On reste
// permissif sur la forme exacte de Notion (les `?` partout) parce que la base
// est éditée à la main par l'admin et qu'une propriété renommée ne doit pas
// faire crasher la route.

interface NotionRichText {
  text?: { content?: string };
  plain_text?: string;
}

interface NotionEmail {
  email: string | null;
}

interface NotionSelect {
  name: string;
}

interface NotionStatus {
  name: string;
  color?: string;
}

interface NotionNumber {
  number: number | null;
}

interface NotionDate {
  date: { start: string | null } | null;
}

interface NotionTitle {
  title: NotionRichText[];
}

interface NotionPage {
  id: string;
  url?: string;
  archived?: boolean;
  created_time?: string;
  properties: {
    "Nom"?: NotionTitle;
    "Prénom"?: { rich_text: NotionRichText[] };
    "E-mail Guest"?: NotionEmail;
    "Montant closés"?: NotionNumber;
    "Modalité"?: { select: NotionSelect | null };
    "État"?: { status: NotionStatus | null };
    "Date de Closing"?: NotionDate;
  };
}

function readRichText(arr?: NotionRichText[]): string {
  const first = arr?.[0];
  return first?.text?.content ?? first?.plain_text ?? "";
}

// État Notion → catégorie business simplifiée pour le front.
// active = paiements en cours (Close, En acompte), expired = annulé/abandonné,
// pending = en attente de R1/R2 ou en relance, none si pas d'engagement.
function mapEtat(etat: string | null): "active" | "expired" | "pending" {
  if (!etat) return "pending";
  if (etat === "Close" || etat === "En acompte") return "active";
  if (etat === "Annulé" || etat === "Abandon acompte" || etat === "No-show")
    return "expired";
  return "pending";
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
  const dbId =
    process.env.NOTION_SALES_CALL_DATABASE_ID ?? SALES_CALL_DATABASE_ID;

  if (!token) {
    return NextResponse.json(
      { error: "Configuration serveur manquante (NOTION_API_TOKEN)" },
      { status: 500, headers: CORS },
    );
  }

  try {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${dbId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            property: "E-mail Guest",
            email: { equals: userEmail },
          },
          page_size: 5,
        }),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[payments/me] Notion query error:", JSON.stringify(err));
      return NextResponse.json(
        {
          error: `Notion a retourné ${res.status} — vérifiez NOTION_API_TOKEN et la connexion de l'intégration à la base Calls.`,
        },
        { status: 502, headers: CORS },
      );
    }

    const data = await res.json();
    const pages: NotionPage[] = data.results ?? [];

    // Plusieurs Calls peuvent matcher (multiples rendez-vous successifs). On
    // garde le plus récent (Date de Closing décroissante, fallback created_time).
    const sorted = [...pages].sort((a, b) => {
      const aDate =
        a.properties["Date de Closing"]?.date?.start ?? a.created_time ?? "";
      const bDate =
        b.properties["Date de Closing"]?.date?.start ?? b.created_time ?? "";
      return bDate.localeCompare(aDate);
    });

    const latest = sorted[0];
    if (!latest) {
      return NextResponse.json({ engagement: null }, { headers: CORS });
    }

    const nom = readRichText(latest.properties["Nom"]?.title);
    const prenom = readRichText(latest.properties["Prénom"]?.rich_text);
    const montant = latest.properties["Montant closés"]?.number ?? null;
    const modalite =
      latest.properties["Modalité"]?.select?.name ?? null;
    const etat = latest.properties["État"]?.status?.name ?? null;
    const closingDate =
      latest.properties["Date de Closing"]?.date?.start ?? null;

    return NextResponse.json(
      {
        engagement: {
          notionId: latest.id,
          notionUrl: latest.url ?? null,
          fullName: [prenom, nom].filter(Boolean).join(" "),
          amount: montant,
          installmentPlan: modalite,
          state: etat,
          status: mapEtat(etat),
          closingDate,
        },
      },
      { headers: CORS },
    );
  } catch (err) {
    console.error("[payments/me] error:", err);
    return NextResponse.json(
      { error: "Erreur interne" },
      { status: 500, headers: CORS },
    );
  }
}
