// Queries serveur ressources & templates depuis le cache Supabase, avec
// gating server-side du contenu payant.
//
// ⚠️  Pourquoi pas Notion direct ? Trois raisons :
//   1. Perf : 1 query Supabase remplace ~N appels Notion par page.
//   2. Coûts : Notion rate-limit + budget API.
//   3. Sécurité : le contenu payant DOIT être filtré côté serveur. Si on
//      laissait fetchResourceBySlug() retourner le body même pour un user
//      sans la capability, le HTML serait envoyé au client (devtools bypass).
//      Ici, on ne charge le content que si l'access est validé.
//
// Pattern recommandé pour les pages serveur :
//   const access = await resolveResourceAccess(slug);
//   if (!access) notFound();
//   if (!access.hasAccess) return <LockedView resource={access.resource} />;
//   return <ResourceView resource={access.resource} />; // content présent

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { getCurrentUserCapabilities } from "@/shared/lib/auth/capabilities";
import {
  VISIBILITY_TO_CAPABILITY,
  type ResourceVisibility,
  type UserCapabilities,
} from "@/shared/types/capabilities";
import type { NotionBlock, ResourceItem, Resource, Template } from "../types";

// Forme brute renvoyée par Supabase pour la table resources.
interface ResourceRow {
  id: string;
  notion_id: string;
  slug: string;
  category: "resource" | "template";
  titre: string;
  description: string | null;
  visibilite: ResourceVisibility;
  formation: string[];
  type: string[];
  content: NotionBlock[] | null;
  url_notion_public_page: string | null;
  url_tella: string | null;
  date_creation: string;
}

// Liste TOUTES les ressources & templates visibles pour l'user courant.
// La RLS resources_select filtre déjà côté DB selon les capabilities, donc
// on ne récupère que ce que l'user a le droit de voir dans la liste.
// On exclut le body content de la query (lourd) — il n'est pas affiché en list.
export async function getAllResourceItems(): Promise<ResourceItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("resources")
    .select(
      "id, notion_id, slug, category, titre, description, visibilite, formation, type, url_notion_public_page, url_tella, date_creation",
    )
    .order("date_creation", { ascending: false });

  if (error) {
    console.error("[ressources/queries] getAllResourceItems failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) =>
    rowToResourceItem(row as Omit<ResourceRow, "content"> & { content: null }),
  );
}

type RequiredCap = (typeof VISIBILITY_TO_CAPABILITY)[ResourceVisibility];

// Résout l'accès d'un user à une ressource (par slug). Renvoie :
//   - null si la ressource n'existe pas / n'est pas visible (RLS bloque).
//   - { hasAccess: false, resource (sans content) } si visible mais gating bloqué.
//   - { hasAccess: true, resource (avec content) } si access validé.
//
// Gating server-side : si !hasAccess, le content N'EST PAS chargé. Garantit
// qu'aucun contenu payant ne fuit au client même si le composant UI est altéré.
export async function resolveResourceAccess(slug: string): Promise<
  | null
  | {
      hasAccess: true;
      resource: Resource | Template;
      visibility: ResourceVisibility;
      requiredCapability: RequiredCap;
    }
  | {
      hasAccess: false;
      resource: Resource | Template;
      visibility: ResourceVisibility;
      requiredCapability: NonNullable<RequiredCap>;
    }
> {
  const supabase = await createSupabaseServerClient();

  // 1. Fetch metadata SANS content (rapide, RLS filtre par visibility).
  const { data: meta, error: metaErr } = await supabase
    .from("resources")
    .select(
      "id, notion_id, slug, category, titre, description, visibilite, formation, type, url_notion_public_page, url_tella, date_creation",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (metaErr) {
    console.error("[ressources/queries] resolveResourceAccess failed:", metaErr.message);
    return null;
  }
  if (!meta) return null;

  const metaRow = meta as Omit<ResourceRow, "content"> & { content: null };
  const visibility = metaRow.visibilite;
  const requiredCapability = VISIBILITY_TO_CAPABILITY[visibility];

  // 2. Si visibility = Publique (capability null), accès direct.
  if (requiredCapability === null) {
    return await loadWithContent(supabase, metaRow, visibility, null);
  }

  // 3. Sinon, check les capabilities du user courant.
  const caps: UserCapabilities = await getCurrentUserCapabilities();
  const allowed = caps[requiredCapability] === true;

  if (!allowed) {
    // Retourne la metadata mais SANS content (pour afficher la lock UI).
    return {
      hasAccess: false,
      resource: rowToResourceItem(metaRow),
      visibility,
      requiredCapability,
    };
  }

  return await loadWithContent(supabase, metaRow, visibility, requiredCapability);
}

async function loadWithContent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  metaRow: Omit<ResourceRow, "content"> & { content: null },
  visibility: ResourceVisibility,
  requiredCapability: RequiredCap,
) {
  // Pour les templates, pas de body — la query meta suffit.
  if (metaRow.category === "template") {
    return {
      hasAccess: true as const,
      resource: rowToResourceItem(metaRow),
      visibility,
      requiredCapability,
    };
  }

  // Pour les resources, refetch avec content uniquement (split pour ne pas
  // payer le TOAST sur les query de liste).
  const { data, error } = await supabase
    .from("resources")
    .select("content")
    .eq("slug", metaRow.slug)
    .maybeSingle<{ content: NotionBlock[] | null }>();

  const fullRow: ResourceRow = {
    ...metaRow,
    content: !error && data ? data.content : null,
  };

  return {
    hasAccess: true as const,
    resource: rowToResourceItem(fullRow),
    visibility,
    requiredCapability,
  };
}

function rowToResourceItem(row: ResourceRow): ResourceItem {
  if (row.category === "template") {
    const tpl: Template = {
      category: "template",
      slug: row.slug,
      titre: row.titre,
      description: row.description ?? "",
      type: (row.type[0] ?? "Système Généraliste") as Template["type"],
      visibilite: row.visibilite,
      urlNotionPublicPage: row.url_notion_public_page ?? "",
      urlTella: row.url_tella ?? undefined,
      dateCreation: row.date_creation,
    };
    return tpl;
  }

  const res: Resource = {
    category: "resource",
    slug: row.slug,
    titre: row.titre,
    description: row.description ?? "",
    formation: row.formation as Resource["formation"],
    type: row.type as Resource["type"],
    visibilite: row.visibilite,
    dateCreation: row.date_creation,
    content: row.content ?? [],
  };
  return res;
}
