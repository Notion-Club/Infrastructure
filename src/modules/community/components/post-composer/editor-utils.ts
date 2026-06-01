// ============================================================================
// Editor utils — manipulation manuelle de Range/Selection
// ============================================================================
// Pourquoi pas execCommand() pour tout ? execCommand("createLink") est
// deprecated et a un comportement instable selon les navigateurs : sur
// Chromium moderne, il consomme parfois la Range sans wrapping le bon node.
// On gère donc les opérations critiques (lien, code) manuellement via Range
// API qui est stable et bien spécifiée.

// ----------------------------------------------------------------------------
// Helper : normalise une URL utilisateur (ajoute https:// si manquant)
// ----------------------------------------------------------------------------
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) return trimmed;
  if (trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) return trimmed;
  return `https://${trimmed}`;
}

// ----------------------------------------------------------------------------
// Insert link — wrap manuel via Range API
// ----------------------------------------------------------------------------
// Pourquoi pas execCommand("createLink") :
//   - Deprecated et flaky : sur certaines versions Chromium, ne wrap que le
//     premier nœud texte de la sélection multi-nodes.
//   - Sur Safari 17+, ajoute parfois un <a> vide à côté.
//   - Pas de contrôle sur target/rel : il faut re-parcourir après.
//
// Approche manuelle : on extrait le contenu de la Range, on crée un <a> avec
// href + target + rel, on insère le <a> à la position de la Range.
export function insertLinkIntoRange(
  range: Range,
  url: string,
  editor: HTMLElement,
): void {
  if (range.collapsed) return;
  if (!editor.contains(range.commonAncestorContainer)) return;

  const href = normalizeUrl(url);
  if (!href) return;

  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.style.color = "var(--color-brand)";
  anchor.style.textDecoration = "underline";

  // Extract le contenu sélectionné et le met dans le <a>
  const contents = range.extractContents();
  anchor.appendChild(contents);
  range.insertNode(anchor);

  // Re-positionne la sélection APRÈS le lien pour que l'user puisse continuer
  // à taper sans rester dans le <a>.
  const after = document.createRange();
  after.setStartAfter(anchor);
  after.collapse(true);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(after);
  }
}

// ----------------------------------------------------------------------------
// Inline code — wrap la sélection dans <code>
// ----------------------------------------------------------------------------
export function applyInlineCode(range: Range, editor: HTMLElement): void {
  if (range.collapsed) return;
  if (!editor.contains(range.commonAncestorContainer)) return;

  const code = document.createElement("code");
  code.style.background = "rgba(0,0,0,0.06)";
  code.style.padding = "1px 5px";
  code.style.borderRadius = "4px";
  code.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
  code.style.fontSize = "0.9em";

  const contents = range.extractContents();
  code.appendChild(contents);
  range.insertNode(code);

  const after = document.createRange();
  after.setStartAfter(code);
  after.collapse(true);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(after);
  }
}

// ----------------------------------------------------------------------------
// Code block — wrap la sélection (ou la ligne courante) dans <pre><code>
// ----------------------------------------------------------------------------
export function applyCodeBlock(range: Range, editor: HTMLElement): void {
  if (!editor.contains(range.commonAncestorContainer)) return;

  const pre = document.createElement("pre");
  pre.style.background = "rgba(0,0,0,0.06)";
  pre.style.padding = "10px 12px";
  pre.style.borderRadius = "8px";
  pre.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
  pre.style.fontSize = "13px";
  pre.style.overflowX = "auto";
  pre.style.whiteSpace = "pre-wrap";
  pre.style.margin = "4px 0";

  const code = document.createElement("code");

  let textContent: string;
  if (range.collapsed) {
    textContent = "\n";
  } else {
    textContent = range.toString() || "\n";
    range.deleteContents();
  }
  code.textContent = textContent;
  pre.appendChild(code);
  range.insertNode(pre);

  const after = document.createRange();
  after.setStartAfter(pre);
  after.collapse(true);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(after);
  }
}

// ----------------------------------------------------------------------------
// Lists (ul / ol) — wrap manuel parce que execCommand("insertUnorderedList")
// est silent no-op quand le contentEditable n'a pas de block-level parent
// pour la sélection (cas typique : on tape direct du texte dans <div ce>).
// ----------------------------------------------------------------------------
export function applyList(
  type: "ul" | "ol",
  range: Range,
  editor: HTMLElement,
): void {
  if (!editor.contains(range.commonAncestorContainer)) return;

  // Si on est déjà DANS une <li> du même type → toggle off (sortir de la liste)
  const existingList = findAncestor(range.startContainer, (n) =>
    n.nodeName === (type === "ul" ? "UL" : "OL"),
  );
  if (existingList) {
    unwrapList(existingList as HTMLElement);
    return;
  }

  // Cas standard : on a une sélection (collapsed ou non) dans du texte brut.
  // Stratégie : on récupère le texte sélectionné, on le split par lignes
  // (sur \n) ; on crée un <ul>/<ol> avec une <li> par ligne ; on remplace.
  // Si pas de sélection, on wrap la ligne courante (texte avant/après le
  // caret jusqu'à \n ou edges).

  const listEl = document.createElement(type);
  listEl.style.margin = "4px 0";
  listEl.style.paddingLeft = "28px";
  // Tailwind v4 reset supprime les list-style par défaut. On force le bon
  // marker explicitement sinon les puces/numéros sont invisibles.
  listEl.style.listStyleType = type === "ul" ? "disc" : "decimal";
  listEl.style.listStylePosition = "outside";

  if (range.collapsed) {
    // Pas de sélection : on crée juste une <li> vide et on met le caret dedans
    const li = document.createElement("li");
    li.style.display = "list-item";
    li.appendChild(document.createElement("br"));
    listEl.appendChild(li);
    range.insertNode(listEl);
    // Place le caret dans la <li>
    const caret = document.createRange();
    caret.setStart(li, 0);
    caret.collapse(true);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(caret);
    }
    return;
  }

  const text = range.toString();
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) lines.push("");

  for (const line of lines) {
    const li = document.createElement("li");
    li.style.display = "list-item";
    li.textContent = line;
    listEl.appendChild(li);
  }

  range.deleteContents();
  range.insertNode(listEl);

  // Caret à la fin de la dernière <li>
  const lastLi = listEl.lastElementChild as HTMLElement | null;
  if (lastLi) {
    const caret = document.createRange();
    caret.selectNodeContents(lastLi);
    caret.collapse(false);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(caret);
    }
  }
}

function findAncestor(
  node: Node,
  predicate: (n: Node) => boolean,
): Node | null {
  let cur: Node | null = node;
  while (cur) {
    if (predicate(cur)) return cur;
    cur = cur.parentNode;
  }
  return null;
}

function unwrapList(list: HTMLElement): void {
  const parent = list.parentNode;
  if (!parent) return;
  const lis = Array.from(list.children);
  for (const li of lis) {
    // Remplace chaque <li> par son contenu + <br> entre
    const text = (li as HTMLElement).innerText;
    const textNode = document.createTextNode(text);
    parent.insertBefore(textNode, list);
    parent.insertBefore(document.createElement("br"), list);
  }
  parent.removeChild(list);
}

// ----------------------------------------------------------------------------
// Insert mention chip — créé un span non-éditable pour @username
// ----------------------------------------------------------------------------
export function insertMention(
  range: Range,
  member: { id: string; username: string | null; name: string },
  editor: HTMLElement,
): void {
  if (!editor.contains(range.commonAncestorContainer)) return;

  const mention = document.createElement("span");
  mention.contentEditable = "false";
  mention.dataset.mentionId = member.id;
  mention.style.background = "rgba(91,141,239,0.12)";
  mention.style.color = "#3a6fd1";
  mention.style.padding = "1px 6px";
  mention.style.borderRadius = "9999px";
  mention.style.fontSize = "0.92em";
  mention.style.fontWeight = "500";
  mention.style.userSelect = "all";
  mention.textContent = `@${member.username ?? member.name}`;

  range.insertNode(mention);

  // Espace après la mention pour faciliter la saisie
  const space = document.createTextNode(" ");
  mention.after(space);

  const after = document.createRange();
  after.setStartAfter(space);
  after.collapse(true);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(after);
  }
}

// ----------------------------------------------------------------------------
// Insert emoji at current caret
// ----------------------------------------------------------------------------
export function insertEmojiAtCaret(emoji: string, editor: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    // Si pas de selection, on append à la fin de l'éditeur
    editor.appendChild(document.createTextNode(emoji));
    return;
  }
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    editor.appendChild(document.createTextNode(emoji));
    return;
  }
  range.deleteContents();
  const node = document.createTextNode(emoji);
  range.insertNode(node);

  const after = document.createRange();
  after.setStartAfter(node);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
}
