// Tickets API — GET liste les items d'une database Notion, DELETE archive une page.
// Variables d'env : NOTION_API_TOKEN (token de l'intégration NotionClub).
// NOTION_DATABASE_ID en override optionnel — sinon fallback sur la base roadmap.
import { NextRequest, NextResponse } from "next/server";

const CORS = { "Content-Type": "application/json" };

// Base "ticket roadmap" jointe par l'administrateur.
const FEEDBACK_DATABASE_ID = "c4209ec9-5e2b-4968-88c8-43e6c4672eda";

interface NotionRichText {
  text: { content: string };
}
interface NotionSelect {
  name: string;
  color?: string;
}
interface NotionPage {
  id: string;
  archived: boolean;
  properties: {
    "Élément ciblé"?: { rich_text: NotionRichText[] };
    "Action"?: { select: NotionSelect | null };
    "Page concernée"?: { select: NotionSelect | null };
    "Retour client"?: { rich_text: NotionRichText[] };
    "Statut"?: { select: NotionSelect | null };
    "Date soumission"?: { date: { start: string } | null };
  };
}

function str(arr?: NotionRichText[]): string {
  return arr?.[0]?.text?.content ?? "";
}

export async function GET() {
  const token = process.env.NOTION_API_TOKEN;
  const dbId  = process.env.NOTION_DATABASE_ID ?? FEEDBACK_DATABASE_ID;

  if (!token) {
    return NextResponse.json(
      { error: "Configuration serveur manquante (NOTION_API_TOKEN)" },
      { status: 500, headers: CORS }
    );
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        page_size: 100,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[tickets] Notion query error:", JSON.stringify(err));
      return NextResponse.json(
        { error: `Notion a retourné ${res.status} — vérifiez NOTION_API_TOKEN, la base Notion et la permission "Lire le contenu" de l'intégration.` },
        { status: 502, headers: CORS }
      );
    }

    const data = await res.json();
    const pages: NotionPage[] = data.results ?? [];

    const tickets = pages
      .filter((p) => !p.archived)
      .filter((p) =>
        str(p.properties["Élément ciblé"]?.rich_text) !== "" ||
        str(p.properties["Retour client"]?.rich_text) !== ""
      )
      .map((p) => ({
        notionId:    p.id,
        element:     str(p.properties["Élément ciblé"]?.rich_text),
        action:      p.properties["Action"]?.select?.name ?? "",
        page:        p.properties["Page concernée"]?.select?.name ?? "",
        text:        str(p.properties["Retour client"]?.rich_text),
        status:      p.properties["Statut"]?.select?.name ?? "À traiter",
        statusColor: p.properties["Statut"]?.select?.color ?? "gray",
        timestamp:   p.properties["Date soumission"]?.date?.start ?? "",
      }));

    return NextResponse.json({ tickets }, { headers: CORS });
  } catch (err) {
    console.error("[tickets] GET error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500, headers: CORS });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("id");

  if (!pageId) {
    return NextResponse.json({ error: "ID manquant" }, { status: 400, headers: CORS });
  }

  const token = process.env.NOTION_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Configuration manquante (NOTION_API_TOKEN)" }, { status: 500, headers: CORS });
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ archived: true }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[tickets] DELETE error:", err);
      return NextResponse.json({ error: "Suppression échouée" }, { status: 502, headers: CORS });
    }

    return NextResponse.json({ success: true }, { headers: CORS });
  } catch (err) {
    console.error("[tickets] DELETE error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500, headers: CORS });
  }
}
