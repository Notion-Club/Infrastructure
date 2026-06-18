// Détection de "vide" pour un éditeur contentEditable.
//
// Un simple `innerText.trim() === ""` ne suffit pas : quand l'utilisateur
// commence par insérer une puce (`insertUnorderedList` → `<ul><li><br></li></ul>`)
// ou une image, le texte rendu reste vide alors que l'éditeur a bel et bien
// du contenu visible. Le placeholder en overlay restait donc affiché par-dessus
// la puce / l'image (bug OPS-88).
//
// On considère l'éditeur non-vide dès qu'il contient un élément de bloc ou un
// média qui occupe de la place, même sans texte.
const NON_EMPTY_SELECTOR = "li, img, ul, ol, table, hr, blockquote, iframe, video";

export function isContentEditableEmpty(el: HTMLElement | null): boolean {
  if (!el) return true;
  if (el.querySelector(NON_EMPTY_SELECTOR)) return false;
  // ​ = zero-width space (utilisé comme placeholder de hauteur dans les
  // <li>) — non retiré par String.trim(), on le neutralise explicitement.
  const text = (el.innerText ?? "").replace(/​/g, "").trim();
  return text.length === 0;
}
