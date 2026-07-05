import { describe, it, expect } from "vitest";
import { detectVideoEmbed } from "./video-embed";

describe("detectVideoEmbed", () => {
  it("YouTube watch → embed + matchedUrl complet (params inclus)", () => {
    const v = detectVideoEmbed("Regarde https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30 ici");
    expect(v).toEqual({
      provider: "youtube",
      embedSrc: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      id: "dQw4w9WgXcQ",
      matchedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30",
    });
  });

  it("YouTube : id capturé (façade miniature/play)", () => {
    expect(detectVideoEmbed("https://youtu.be/dQw4w9WgXcQ")?.id).toBe("dQw4w9WgXcQ");
  });

  it("youtu.be court", () => {
    const v = detectVideoEmbed("https://youtu.be/dQw4w9WgXcQ");
    expect(v?.provider).toBe("youtube");
    expect(v?.embedSrc).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("Loom share", () => {
    const v = detectVideoEmbed("demo https://www.loom.com/share/abc123def456");
    expect(v?.provider).toBe("loom");
    expect(v?.embedSrc).toBe("https://www.loom.com/embed/abc123def456");
  });

  const TELLA_PARAMS = "b=0&title=0&a=1&loop=0&t=0&muted=0&wt=0&o=1";

  it("Tella video → /embed avec paramètres épurés", () => {
    const v = detectVideoEmbed("https://www.tella.tv/video/clabc-123");
    expect(v?.provider).toBe("tella");
    expect(v?.embedSrc).toBe(`https://www.tella.tv/video/clabc-123/embed?${TELLA_PARAMS}`);
  });

  it("Tella : URL de partage réelle (slug long) → id conservé + embed paramétré", () => {
    const slug = "2025-09-22goumandji-20250922131900-0038-d-smalf09gg37phbq-copy-02cc";
    const v = detectVideoEmbed(`https://www.tella.tv/video/${slug}`)!;
    expect(v.provider).toBe("tella");
    expect(v.id).toBe(slug);
    expect(v.embedSrc).toBe(`https://www.tella.tv/video/${slug}/embed?${TELLA_PARAMS}`);
  });

  it("Tella : une URL déjà /embed?… est renormalisée sur nos paramètres", () => {
    const v = detectVideoEmbed("https://www.tella.tv/video/abc-def/embed?b=1&title=1")!;
    expect(v.embedSrc).toBe(`https://www.tella.tv/video/abc-def/embed?${TELLA_PARAMS}`);
  });

  it("Vimeo → player.vimeo.com", () => {
    const v = detectVideoEmbed("https://vimeo.com/76979871");
    expect(v?.provider).toBe("vimeo");
    expect(v?.embedSrc).toBe("https://player.vimeo.com/video/76979871");
  });

  it("ALLOWLIST : une URL hors providers ne produit AUCUN embed", () => {
    expect(detectVideoEmbed("https://example.com/video.mp4")).toBeNull();
    expect(detectVideoEmbed("https://evil.tv/video/xxx")).toBeNull();
    expect(detectVideoEmbed("https://notyoutube.com/watch?v=abc")).toBeNull();
    expect(detectVideoEmbed("juste du texte sans lien")).toBeNull();
    expect(detectVideoEmbed("")).toBeNull();
  });

  it("premier match par POSITION (Loom avant YouTube dans le texte)", () => {
    const v = detectVideoEmbed(
      "d'abord https://www.loom.com/share/xxx puis https://youtu.be/yyy",
    );
    expect(v?.provider).toBe("loom");
  });

  it("matchedUrl permet de retirer proprement l'URL du body", () => {
    const body = "Mon clip : https://youtu.be/dQw4w9WgXcQ 🎬";
    const v = detectVideoEmbed(body)!;
    expect(body.replace(v.matchedUrl, "").trim()).toBe("Mon clip :  🎬".trim());
  });
});
