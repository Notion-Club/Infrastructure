import { describe, it, expect } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { renderBodyRich } from "./render-mentions";

// Représentation simplifiée et testable de l'arbre ReactNode produit par le
// renderer : chaque nœud devient { tag, text, href? }. `tag: "#text"` pour un
// segment texte brut ; sinon le nom de la balise intrinsèque ("strong", "em",
// "a", "span", "button"…). On ne descend pas dans les enfants imbriqués : le
// renderer produit des enfants plats (string) pour strong/em/a, ce qui suffit.
interface Token {
  tag: string;
  text: string;
  href?: string;
}

function childText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(childText).join("");
  if (isValidElement(node)) {
    return childText((node.props as { children?: ReactNode }).children);
  }
  return node == null || node === false ? "" : String(node);
}

function tokenize(result: ReactNode): Token[] {
  const arr = Array.isArray(result) ? result : [result];
  return arr.map((node) => {
    if (typeof node === "string") return { tag: "#text", text: node };
    if (isValidElement(node)) {
      const props = node.props as { href?: string; children?: ReactNode };
      return {
        tag: typeof node.type === "string" ? node.type : "component",
        text: childText(props.children),
        href: props.href,
      };
    }
    return { tag: "#unknown", text: String(node) };
  });
}

/** Concatène tout le texte visible (utile pour vérifier l'absence de marqueurs). */
function fullText(result: ReactNode): string {
  return tokenize(result)
    .map((t) => t.text)
    .join("");
}

describe("renderBodyRich — format inline", () => {
  it("texte simple : inchangé, aucun wrapping", () => {
    const tokens = tokenize(renderBodyRich("Bonjour le monde", undefined));
    expect(tokens).toEqual([{ tag: "#text", text: "Bonjour le monde", href: undefined }]);
  });

  it("gras seul : **x** → <strong>x</strong>, pas d'astérisques littéraux", () => {
    const result = renderBodyRich("un **mot** fort", undefined);
    const strong = tokenize(result).find((t) => t.tag === "strong");
    expect(strong?.text).toBe("mot");
    expect(fullText(result)).not.toContain("*");
    expect(fullText(result)).toBe("un mot fort");
  });

  it("italique seul : *x* → <em>x</em>", () => {
    const result = renderBodyRich("un *mot* penché", undefined);
    const em = tokenize(result).find((t) => t.tag === "em");
    expect(em?.text).toBe("mot");
    expect(fullText(result)).toBe("un mot penché");
  });

  it("lien-libellé : [libellé](url) → <a href> avec libellé ≠ URL", () => {
    const result = renderBodyRich("voir [le blog](https://exemple.com/x) ici", undefined);
    const a = tokenize(result).find((t) => t.tag === "a");
    expect(a?.text).toBe("le blog");
    expect(a?.href).toBe("https://exemple.com/x");
    // L'URL ne doit PAS apparaître en texte brut (pas de double linkify).
    expect(fullText(result)).not.toContain("https://exemple.com/x");
  });

  it("mélange : gras + lien-libellé + mention + URL nue cohabitent", () => {
    const result = renderBodyRich(
      "**salut** @Théo vois [ici](https://a.co) et https://nu.com",
      [{ id: "u1", name: "Théo" }],
    );
    const tokens = tokenize(result);
    // Gras
    expect(tokens.find((t) => t.tag === "strong")?.text).toBe("salut");
    // Mention stylée (span brand)
    expect(tokens.find((t) => t.tag === "span")?.text).toBe("@Théo");
    // Lien-libellé
    const labelled = tokens.find((t) => t.tag === "a" && t.text === "ici");
    expect(labelled?.href).toBe("https://a.co");
    // URL nue autolinkée séparément
    const bare = tokens.find((t) => t.tag === "a" && t.href === "https://nu.com");
    expect(bare).toBeTruthy();
  });

  it("`**` non fermé : reste littéral, aucun <strong>", () => {
    const result = renderBodyRich("texte **pas fermé ici", undefined);
    expect(tokenize(result).some((t) => t.tag === "strong")).toBe(false);
    expect(fullText(result)).toContain("**pas fermé ici");
  });

  it("rétro-compat : un body sans marqueur produit un unique segment texte", () => {
    const result = renderBodyRich("Rien de spécial, juste du texte.", undefined);
    expect(tokenize(result)).toHaveLength(1);
  });

  it("href de lien-libellé restreint à http(s) (garde-fou XSS)", () => {
    const result = renderBodyRich("[clic](javascript:alert(1))", undefined);
    // Non reconnu comme lien → reste littéral, aucun <a>.
    expect(tokenize(result).some((t) => t.tag === "a")).toBe(false);
    expect(fullText(result)).toContain("[clic](javascript:alert(1))");
  });
});
