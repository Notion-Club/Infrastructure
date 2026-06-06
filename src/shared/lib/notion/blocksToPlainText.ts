// Convertisseur NotionBlock[] → texte brut markdown-friendly.
//
// Cible : page publique de transcription consommée par ChatGPT/Claude via
// leur outil browse. Le texte doit être lisible côté IA sans parsing HTML.
// On utilise du markdown light (headings #, listes -, citations >, code ```)
// que les LLMs parsent naturellement, mais sans HTML.
//
// Délibérément simple — pas de support tables ni de styles fins (bold,
// italic ignorés, on extrait le plain_text via richTextToPlain).

import type { NotionBlock } from "./blocks";
import { richTextToPlain } from "./client";
import type { NotionRichText } from "./client";

// NotionBlock.rich a sa propre shape `RichSpan` côté blocks.ts ; on reconstruit
// le minimal nécessaire pour richTextToPlain qui n'a besoin que de plain_text.
function spansToPlain(spans?: NotionBlock["rich"]): string {
  if (!spans) return "";
  const asNotionRT: NotionRichText[] = spans.map((s) => ({
    plain_text: s.text,
    href: s.href,
  }));
  return richTextToPlain(asNotionRT);
}

function captionToPlain(caption?: NotionBlock["caption"]): string {
  return spansToPlain(caption);
}

function renderList(
  items: NotionBlock[],
  ordered: boolean,
  indent: string,
): string {
  const lines: string[] = [];
  items.forEach((item, idx) => {
    const bullet = ordered ? `${idx + 1}.` : "-";
    const text = spansToPlain(item.rich);
    lines.push(`${indent}${bullet} ${text}`);
    if (item.children && item.children.length > 0) {
      // Récursion enfants avec indentation supplémentaire.
      lines.push(renderBlocks(item.children, `${indent}  `));
    }
  });
  return lines.join("\n");
}

function renderBlocks(blocks: NotionBlock[], indent: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];

    // Regroupe les list_item consécutifs du même type → 1 seul bloc liste.
    if (b.type === "bulleted_list_item" || b.type === "numbered_list_item") {
      const ordered = b.type === "numbered_list_item";
      const group: NotionBlock[] = [];
      while (
        i < blocks.length &&
        blocks[i].type === (ordered ? "numbered_list_item" : "bulleted_list_item")
      ) {
        group.push(blocks[i]);
        i++;
      }
      out.push(renderList(group, ordered, indent));
      continue;
    }

    out.push(renderSingle(b, indent));
    i++;
  }
  return out.filter((s) => s.length > 0).join("\n");
}

function renderSingle(b: NotionBlock, indent: string): string {
  const text = spansToPlain(b.rich);
  switch (b.type) {
    case "paragraph":
      return text ? `${indent}${text}` : "";
    case "heading_1":
      return `\n${indent}# ${text}\n`;
    case "heading_2":
      return `\n${indent}## ${text}\n`;
    case "heading_3":
      return `\n${indent}### ${text}\n`;
    case "to_do": {
      const box = b.checked ? "[x]" : "[ ]";
      return `${indent}${box} ${text}`;
    }
    case "quote":
      return `${indent}> ${text}`;
    case "callout": {
      const icon = b.icon ? `${b.icon} ` : "";
      return `${indent}${icon}${text}`;
    }
    case "code": {
      const lang = b.language && b.language !== "plain text" ? b.language : "";
      return `${indent}\`\`\`${lang}\n${indent}${text}\n${indent}\`\`\``;
    }
    case "divider":
      return `${indent}---`;
    case "image":
    case "video":
    case "file":
    case "pdf": {
      const cap = captionToPlain(b.caption);
      const url = b.url ?? "";
      const suffix = cap ? ` — ${cap}` : "";
      return `${indent}[${b.type}: ${url}${suffix}]`;
    }
    case "bookmark":
    case "embed":
    case "link_preview": {
      const url = b.url ?? "";
      return `${indent}[link: ${url}]`;
    }
    case "toggle": {
      // Toggle visible : on render le label + ses enfants.
      const head = `${indent}${text}`;
      if (b.children && b.children.length > 0) {
        return `${head}\n${renderBlocks(b.children, `${indent}  `)}`;
      }
      return head;
    }
    case "column_list":
    case "column":
      // Conteneurs : on récurse sans préfixe.
      if (b.children && b.children.length > 0) {
        return renderBlocks(b.children, indent);
      }
      return "";
    default:
      // unsupported, table, table_row, etc. — skip silencieux.
      return "";
  }
}

// Point d'entrée public — convertit un arbre de blocs en string lisible.
// Post-process : trim global + collapse `\n{3,}` → `\n\n`.
export function blocksToPlainText(blocks: NotionBlock[]): string {
  const raw = renderBlocks(blocks, "");
  return raw.replace(/\n{3,}/g, "\n\n").trim();
}
