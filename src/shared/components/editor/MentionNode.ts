import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mention: {
      insertMention: (attrs: { id: string; name: string }) => ReturnType;
    };
  }
}

export const MentionNode = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      id: { default: "" },
      name: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-mention-id]",
        getAttrs(node) {
          const el = node as HTMLElement;
          return {
            id: el.getAttribute("data-mention-id") ?? "",
            name: (el.textContent ?? "").replace(/^@/, ""),
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      "span",
      mergeAttributes({ "data-mention-id": node.attrs.id, class: "nc-mention" }),
      `@${node.attrs.name}`,
    ];
  },

  addCommands() {
    return {
      insertMention:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

export interface MentionItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  initials: string;
}
