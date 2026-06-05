import { Node, mergeAttributes } from "@tiptap/core";

export function detectVideoEmbed(url: string): { provider: "loom" | "tella"; src: string } | null {
  const loomMatch = url.match(/https?:\/\/(?:www\.)?loom\.com\/share\/([a-z0-9]+)/i);
  if (loomMatch) return { provider: "loom", src: `https://www.loom.com/embed/${loomMatch[1]}` };
  const tellaMatch = url.match(/https?:\/\/(?:www\.)?tella\.tv\/video\/([^?\s]+)/i);
  if (tellaMatch) return { provider: "tella", src: `https://www.tella.tv/video/${tellaMatch[1]}/embed` };
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/.test(url);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    iframeEmbed: {
      setIframeEmbed: (attrs: { src: string; provider: string }) => ReturnType;
    };
  }
}

export const IframeEmbed = Node.create({
  name: "iframeEmbed",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      provider: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-iframe-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-iframe-embed": "" })];
  },

  addNodeView() {
    return ({ node }) => {
      const wrapper = document.createElement("div");
      wrapper.dataset.iframeEmbed = "";
      wrapper.style.cssText =
        "margin:8px 0;border-radius:12px;overflow:hidden;aspect-ratio:16/9;";
      const iframe = document.createElement("iframe");
      iframe.src = node.attrs.src as string;
      iframe.style.cssText = "width:100%;height:100%;border:none;";
      iframe.allow =
        "accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture";
      iframe.allowFullscreen = true;
      wrapper.appendChild(iframe);
      return { dom: wrapper };
    };
  },

  addCommands() {
    return {
      setIframeEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
