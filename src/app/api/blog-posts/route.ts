// Blog posts API — POST crée une page dans la base "ticket roadmap" Notion.
// Variables d'env : NOTION_API_TOKEN (token de l'intégration NotionClub).
// NOTION_BLOG_DATABASE_ID en override optionnel — sinon fallback sur la base
// roadmap jointe par l'administrateur.
import { NextRequest, NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Base "ticket roadmap" jointe par l'administrateur.
const FEEDBACK_DATABASE_ID = "c4209ec9-5e2b-4968-88c8-43e6c4672eda";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

interface BlogPostPayload {
  title: string;
  slug?: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  coverUrl?: string;
  author?: string;
  publishDate?: string;
  readingMinutes?: number;
  metaDescription?: string;
  body?: string;
  status?: "Brouillon" | "À relire" | "Publié" | "Archivé";
}

// Notion limite chaque rich_text à 2000 caractères.
// rt() pour les champs courts : tronque au-delà avec un marqueur, le contenu complet va dans le body de la page.
const NOTION_RICH_TEXT_MAX = 2000;
const PROPERTY_PREVIEW_LIMIT = 1900;
const TRUNCATION_MARKER = "… [Contenu complet dans le corps de la page ↓]";

function rt(content: string) {
  if (!content) return [];
  if (content.length <= NOTION_RICH_TEXT_MAX) {
    return [{ text: { content } }];
  }
  return [{ text: { content: content.slice(0, PROPERTY_PREVIEW_LIMIT) + TRUNCATION_MARKER } }];
}

export async function POST(request: NextRequest) {
  const headers = { ...CORS, "Content-Type": "application/json" };

  let body: BlogPostPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400, headers });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Le titre est requis" }, { status: 400, headers });
  }

  const token = process.env.NOTION_API_TOKEN;
  const dbId = process.env.NOTION_BLOG_DATABASE_ID ?? FEEDBACK_DATABASE_ID;

  if (!token) {
    console.error("[blog-posts] NOTION_API_TOKEN manquant");
    return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500, headers });
  }

  const properties: Record<string, unknown> = {
    Titre: { title: rt(body.title.trim()) },
    Statut: { select: { name: body.status ?? "Brouillon" } },
  };

  if (body.slug) properties["Slug"] = { rich_text: rt(body.slug) };
  if (body.excerpt) properties["Extrait"] = { rich_text: rt(body.excerpt) };
  if (body.category) properties["Catégorie"] = { select: { name: body.category } };
  if (body.tags && body.tags.length > 0) {
    properties["Tags"] = { multi_select: body.tags.map((t) => ({ name: t })) };
  }
  if (body.coverUrl) properties["Image cover"] = { url: body.coverUrl };
  if (body.author) properties["Auteur"] = { rich_text: rt(body.author) };
  if (body.publishDate) properties["Date de publication"] = { date: { start: body.publishDate } };
  if (typeof body.readingMinutes === "number") {
    properties["Temps de lecture (min)"] = { number: body.readingMinutes };
  }
  if (body.metaDescription) {
    properties["Meta description SEO"] = { rich_text: rt(body.metaDescription) };
  }
  if (body.body) properties["Corps"] = { rich_text: rt(body.body) };

  // Body Notion : on découpe en paragraphes naturels (double saut), puis chaque paragraphe
  // est lui-même découpé en blocs ≤ 2000 char si nécessaire.
  const children: object[] = [];
  if (body.body) {
    const paragraphs = body.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    for (const p of paragraphs) {
      for (let i = 0; i < p.length; i += NOTION_RICH_TEXT_MAX) {
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: p.slice(i, i + NOTION_RICH_TEXT_MAX) } }],
          },
        });
      }
    }
  }

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties,
        children,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[blog-posts] Erreur Notion:", JSON.stringify(err));
      return NextResponse.json(
        { error: `Notion a retourné ${res.status}`, details: err },
        { status: 502, headers }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, id: data.id, url: data.url }, { headers });
  } catch (err) {
    console.error("[blog-posts] Erreur réseau:", err);
    return NextResponse.json({ error: "Erreur réseau" }, { status: 500, headers });
  }
}
