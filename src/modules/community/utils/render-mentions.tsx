import type { ReactNode } from "react";
import { linkify } from "./linkify";
import { formatInline } from "./format-inline";

// Applique le format inline (**gras**, *italique*, [libellé](url)) PUIS linkify
// sur les seuls segments texte restants. Les nœuds JSX produits par formatInline
// (dont les liens-libellés) passent tels quels : on ne re-linkifie jamais une URL
// déjà encapsulée dans un lien.
function formatAndLinkify(text: string): ReactNode[] {
  return formatInline(text).flatMap((seg) =>
    typeof seg === "string" ? linkify(seg) : [seg],
  );
}

// Helper de rendu : transforme un body texte en un tableau de ReactNode où
// chaque @nom matchant une mention structurée (table post_mentions / comment_mentions,
// migration 020) est wrappé dans un <span> coloré brand + bold. Les @nom
// écrits à la main qui ne correspondent à aucune mention restent en texte brut.
//
// On échappe les caractères regex du name (au cas où un display_name contient
// un point ou un parenthèse) et on borne avec \b côté droit pour éviter qu'un
// nom soit substring d'un autre (@Théo ne doit pas matcher dans @Théodore).
// Côté gauche : pas de \b sur @ (ce n'est pas un word boundary devant un mot).
export function renderBodyWithMentions(
  body: string,
  mentions: { id: string; name: string }[] | undefined,
): React.ReactNode {
  if (!mentions || mentions.length === 0) return body;

  // Dédup par name (cas marginal mais utile) et tri par longueur DESC pour
  // que les noms les plus longs soient testés en premier (évite "@Théo" de
  // matcher dans "@Théo Gouman").
  const uniqueNames = Array.from(new Set(mentions.map((m) => m.name))).sort(
    (a, b) => b.length - a.length,
  );

  if (uniqueNames.length === 0) return body;

  const escaped = uniqueNames
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  // (?:^|[^\w]) garantit que @ n'est pas accolé à un caractère word avant —
  // exclut les emails (foo@bar) ou les contextes "@truc" déjà imbriqués.
  // On capture (@nom) pour le split.
  const re = new RegExp(`(?:^|[^\\w])(@(?:${escaped}))(?:\\b|$)`, "g");

  // Le résultat alterne string (texte brut) et JSX (mention stylée). On
  // garde les strings raw — pas de wrap dans Fragment — pour faciliter le
  // chaînage avec linkify dans renderBodyRich.
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(body)) !== null) {
    const mention = match[1]!; // "@Nom"
    const matchStart = match.index + match[0].indexOf(mention);
    if (matchStart > lastIndex) {
      parts.push(body.slice(lastIndex, matchStart));
    }
    parts.push(
      <span
        key={`m-${key++}`}
        style={{ color: "var(--color-brand)", fontWeight: 600 }}
      >
        {mention}
      </span>,
    );
    lastIndex = matchStart + mention.length;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }
  return parts.length > 0 ? parts : body;
}

// Variante qui combine mentions + linkify. Utilisée par PostCard / PostDetail
// qui veulent que les URLs ET les @mentions soient transformées. On applique
// linkify SUR les segments string entre les mentions, pour ne pas casser
// le markup brand des mentions.
export function renderBodyRich(
  body: string,
  mentions: { id: string; name: string }[] | undefined,
): ReactNode {
  const withMentions = renderBodyWithMentions(body, mentions);
  if (typeof withMentions === "string") {
    return formatAndLinkify(withMentions);
  }
  if (!Array.isArray(withMentions)) return withMentions;
  // Pour chaque segment string du résultat mentions, on applique format inline
  // puis linkify, et on étale les sous-éléments dans le tableau final. Les
  // mentions déjà stylées (JSX) passent intactes.
  return withMentions.flatMap((node) =>
    typeof node === "string" ? formatAndLinkify(node) : [node],
  );
}
