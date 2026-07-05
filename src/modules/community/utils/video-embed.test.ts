import { describe, it, expect } from "vitest";
import { detectVideoEmbed } from "./video-embed";

describe("detectVideoEmbed", () => {
  it("YouTube watch → embed + matchedUrl complet (params inclus)", () => {
    const v = detectVideoEmbed("Regarde https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30 ici");
    expect(v).toEqual({
      provider: "youtube",
      embedSrc: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      matchedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30",
    });
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

  it("Tella video → /embed", () => {
    const v = detectVideoEmbed("https://www.tella.tv/video/clabc-123");
    expect(v?.provider).toBe("tella");
    expect(v?.embedSrc).toBe("https://www.tella.tv/video/clabc-123/embed");
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
