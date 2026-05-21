// API feedback — reçoit un batch de retours et crée une page Notion par retour.
// Variables d'env requises : NOTION_API_TOKEN (token de l'intégration NotionClub).
// NOTION_DATABASE_ID en override optionnel — sinon fallback sur la base roadmap.
import { NextRequest, NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

interface FeedbackItem {
  element: string;
  elementUrl?: string;
  action?: string;
  page: string;
  text: string;
  timestamp: string;
}

// Notion limite chaque rich_text à 2000 caractères.
// Stratégie : property tronquée si dépassement (avec indicateur), texte complet en blocs paragraphes dans le body.
const NOTION_RICH_TEXT_MAX = 2000;
const PROPERTY_PREVIEW_LIMIT = 1900;
const TRUNCATION_MARKER = "… [Contenu complet dans le corps de la page ↓]";

function truncatedProperty(content: string) {
  if (!content) return { rich_text: [] };
  if (content.length <= NOTION_RICH_TEXT_MAX) {
    return { rich_text: [{ text: { content } }] };
  }
  return {
    rich_text: [{ text: { content: content.slice(0, PROPERTY_PREVIEW_LIMIT) + TRUNCATION_MARKER } }],
  };
}

// Découpe un texte en paragraphes Notion (respecte les sauts de ligne, max 2000 char par bloc)
function buildParagraphBlocks(text: string) {
  if (!text) return [];
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const blocks: object[] = [];
  for (const p of paragraphs) {
    for (let i = 0; i < p.length; i += NOTION_RICH_TEXT_MAX) {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: p.slice(i, i + NOTION_RICH_TEXT_MAX) } }],
        },
      });
    }
  }
  return blocks;
}

function buildPageBody(fb: FeedbackItem) {
  const blocks: object[] = [];

  if (fb.elementUrl) {
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: { content: "🔗 Voir l'élément sur le site : ", link: null },
            annotations: { bold: true, color: "default" },
          },
          {
            type: "text",
            text: { content: fb.elementUrl, link: { url: fb.elementUrl } },
            annotations: { color: "blue" },
          },
        ],
      },
    });
  }

  // Si le retour dépasse la limite property, on l'écrit en entier dans le body.
  if (fb.text && fb.text.length > NOTION_RICH_TEXT_MAX) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [{ type: "text", text: { content: "Retour client complet" } }],
      },
    });
    blocks.push(...buildParagraphBlocks(fb.text));
  }

  return blocks;
}

export async function POST(request: NextRequest) {
  const headers = { ...CORS, "Content-Type": "application/json" };

  let body: { sessionId?: string; feedbacks?: FeedbackItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400, headers });
  }

  const { sessionId, feedbacks } = body;

  if (!feedbacks || feedbacks.length === 0) {
    return NextResponse.json({ error: "Aucun retour fourni" }, { status: 400, headers });
  }

  // Base "ticket roadmap" jointe par l'administrateur — destination par défaut
  // pour les flows feedback élément + général.
  const FEEDBACK_DATABASE_ID = "c4209ec9-5e2b-4968-88c8-43e6c4672eda";
  const notionToken = process.env.NOTION_API_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID ?? FEEDBACK_DATABASE_ID;

  if (!notionToken) {
    console.error("[feedback] NOTION_API_TOKEN manquant");
    return NextResponse.json({ success: false, error: "Configuration serveur manquante" }, { status: 500, headers });
  }

  const results = await Promise.allSettled(
    feedbacks.map((fb) =>
      fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: {
            Ticket: {
              title: [{ text: { content: `${fb.element} · ${fb.text.slice(0, 60)}`.slice(0, NOTION_RICH_TEXT_MAX) } }],
            },
            Statut: { select: { name: "À traiter" } },
            ...(fb.action ? { Action: { select: { name: fb.action } } } : {}),
            "Élément ciblé": truncatedProperty(fb.element),
            "Page concernée": { select: { name: fb.page } },
            "Retour client": truncatedProperty(fb.text),
            "Date soumission": { date: { start: fb.timestamp } },
            "Session ID": truncatedProperty(sessionId ?? ""),
            ...(fb.elementUrl ? { URL: { url: fb.elementUrl } } : {}),
          },
          children: buildPageBody(fb),
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(JSON.stringify(err));
        }
        return res.json();
      })
    )
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

  failed.forEach((r) => {
    console.error("[feedback] Erreur Notion :", r.reason?.message);
  });

  if (succeeded === 0) {
    return NextResponse.json(
      { success: false, error: "Toutes les requêtes Notion ont échoué" },
      { status: 500, headers }
    );
  }

  if (failed.length > 0) {
    return NextResponse.json(
      {
        success: "partial",
        created: succeeded,
        failed: failed.length,
        errors: failed.map((r) => r.reason?.message ?? "Erreur inconnue"),
      },
      { status: 207, headers }
    );
  }

  return NextResponse.json({ success: true, created: succeeded, sessionId }, { headers });
}
