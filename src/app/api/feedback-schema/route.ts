// API feedback-schema — lit la liste réelle des options des propriétés Select /
// Multi-select de la base Notion roadmap. Permet au widget d'afficher les vrais
// tags disponibles côté Notion plutôt que de hardcoder un sous-ensemble.
// Variables d'env requises : NOTION_API_TOKEN.
// NOTION_DATABASE_ID en override optionnel — sinon fallback sur la base roadmap.
import { NextResponse } from "next/server";

const CORS = { "Content-Type": "application/json" };

// Base "ticket roadmap" jointe par l'administrateur.
const FEEDBACK_DATABASE_ID = "c4209ec9-5e2b-4968-88c8-43e6c4672eda";

interface NotionSelectOption {
  id: string;
  name: string;
  color?: string;
}

interface NotionDatabaseSchema {
  properties: Record<
    string,
    {
      type: string;
      select?: { options: NotionSelectOption[] };
      multi_select?: { options: NotionSelectOption[] };
    }
  >;
}

export const revalidate = 60; // schéma stable, on garde une copie 60s

export async function GET() {
  const token = process.env.NOTION_API_TOKEN;
  const dbId = process.env.NOTION_DATABASE_ID ?? FEEDBACK_DATABASE_ID;

  if (!token) {
    return NextResponse.json(
      { error: "Configuration serveur manquante (NOTION_API_TOKEN)" },
      { status: 500, headers: CORS }
    );
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[feedback-schema] Notion error:", JSON.stringify(err));
      return NextResponse.json(
        {
          error: `Notion a retourné ${res.status} — vérifiez NOTION_API_TOKEN et la connexion de l'intégration à la base.`,
        },
        { status: 502, headers: CORS }
      );
    }

    const data = (await res.json()) as NotionDatabaseSchema;
    const props = data.properties ?? {};

    const action =
      props.Action?.type === "select"
        ? props.Action.select?.options?.map((o) => o.name) ?? []
        : [];

    const end =
      props["/End"]?.type === "multi_select"
        ? props["/End"].multi_select?.options?.map((o) => o.name) ?? []
        : [];

    return NextResponse.json({ action, end }, { headers: CORS });
  } catch (err) {
    console.error("[feedback-schema] error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500, headers: CORS });
  }
}
