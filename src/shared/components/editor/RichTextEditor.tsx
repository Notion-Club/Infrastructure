"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import TiptapImage from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Youtube from "@tiptap/extension-youtube";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Video,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IframeEmbed, detectVideoEmbed, isYouTubeUrl } from "./VideoExtension";
import type { MentionItem } from "./MentionNode";
import { MentionNode } from "./MentionNode";

interface RichTextEditorProps {
  placeholder?: string;
  initialContent?: string;
  onChange?: (html: string, isEmpty: boolean) => void;
  onImageUpload?: (file: File) => Promise<string | null>;
  minHeight?: number;
  autoFocus?: boolean;
  // Optional mention support — pass mentionables to enable @mention autocomplete
  mentionables?: MentionItem[];
  // Expose editor isEmpty state for external use
  onEmptyChange?: (isEmpty: boolean) => void;
  // Allow external reset (e.g., after form submit)
  resetKey?: number;
}

export function RichTextEditor({
  placeholder = "Écris quelque chose…",
  initialContent = "",
  onChange,
  onImageUpload,
  minHeight = 120,
  autoFocus = false,
  mentionables,
  onEmptyChange,
  resetKey,
}: RichTextEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoInput, setVideoInput] = useState("");
  const [videoError, setVideoError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  // Mention autocomplete state
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const extensions = [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
      strike: false,
      code: false,
    }),
    TiptapLink.configure({
      openOnClick: false,
      HTMLAttributes: { class: "nc-link", target: "_blank", rel: "noopener noreferrer" },
    }),
    TiptapImage.configure({ HTMLAttributes: { class: "nc-editor-img" } }),
    Placeholder.configure({ placeholder }),
    Youtube.configure({ width: 560, height: 315, HTMLAttributes: { class: "nc-yt" } }),
    IframeEmbed,
    ...(mentionables ? [MentionNode] : []),
  ];

  const editor = useEditor({
    extensions,
    content: initialContent,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: "nc-prose nc-editor-content",
        style: `min-height:${minHeight}px;padding:12px 14px;outline:none;font-size:14px;line-height:1.6;color:var(--color-text-primary);word-break:break-word;`,
      },
    },
    onUpdate({ editor }) {
      const html = editor.getHTML();
      const isEmpty = editor.isEmpty;
      onChange?.(html, isEmpty);
      onEmptyChange?.(isEmpty);

      // @mention detection
      if (mentionables && mentionables.length > 0) {
        const { from } = editor.state.selection;
        const textBefore = editor.state.doc.textBetween(Math.max(0, from - 80), from, "\n");
        const match = textBefore.match(/@(\w*)$/);
        if (match) {
          const coords = editor.view.coordsAtPos(from);
          setMentionSearch(match[1]);
          setMentionPos({ top: coords.bottom + 6, left: coords.left });
        } else {
          setMentionSearch(null);
        }
      }
    },
  });

  // Reset when resetKey changes
  useEffect(() => {
    if (resetKey !== undefined && editor) {
      editor.commands.clearContent();
    }
  }, [resetKey, editor]);

  // Focus link input when panel opens
  useEffect(() => {
    if (linkOpen) setTimeout(() => linkInputRef.current?.focus(), 10);
  }, [linkOpen]);

  useEffect(() => {
    if (videoOpen) setTimeout(() => videoInputRef.current?.focus(), 10);
  }, [videoOpen]);

  if (!editor) return null;

  // ── Toolbar helpers ─────────────────────────────────────────────────────────

  function handleLinkSubmit() {
    const url = linkInput.trim();
    if (!url) { setLinkOpen(false); return; }
    const href = url.startsWith("http") ? url : `https://${url}`;
    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    } else {
      editor.chain().focus().insertContent(`<a href="${href}">${href}</a>`).run();
    }
    setLinkInput("");
    setLinkOpen(false);
  }

  async function handleVideoSubmit() {
    const url = videoInput.trim();
    if (!url) { setVideoOpen(false); return; }
    setVideoError("");

    if (isYouTubeUrl(url)) {
      editor.chain().focus().setYoutubeVideo({ src: url }).run();
      setVideoInput("");
      setVideoOpen(false);
      return;
    }

    const embed = detectVideoEmbed(url);
    if (embed) {
      editor.commands.setIframeEmbed(embed);
      editor.commands.focus();
      setVideoInput("");
      setVideoOpen(false);
      return;
    }

    setVideoError("Lien non reconnu — colle une URL YouTube, Loom ou Tella.");
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;
    e.target.value = "";
    setUploadingImage(true);
    try {
      const url = await onImageUpload(file);
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    } finally {
      setUploadingImage(false);
    }
  }

  function insertMention(item: MentionItem) {
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 80), from, "\n");
    const match = textBefore.match(/@(\w*)$/);
    const matchLength = match ? match[0].length : 0;
    editor
      .chain()
      .focus()
      .deleteRange({ from: from - matchLength, to: from })
      .insertMention({ id: item.id, name: item.name })
      .insertContent(" ")
      .run();
    setMentionSearch(null);
  }

  const filteredSuggestions =
    mentionSearch !== null
      ? (mentionables ?? [])
          .filter((m) => m.name.toLowerCase().includes(mentionSearch.toLowerCase()))
          .slice(0, 5)
      : [];

  // ── Active states for toolbar ─────────────────────────────────────────────
  const isBold = editor.isActive("bold");
  const isItalic = editor.isActive("italic");
  const isBullet = editor.isActive("bulletList");
  const isOrdered = editor.isActive("orderedList");
  const isLink = editor.isActive("link");

  function ToolBtn({
    active,
    title,
    onClick,
    children,
    disabled,
  }: {
    active?: boolean;
    title: string;
    onClick: () => void;
    children: React.ReactNode;
    disabled?: boolean;
  }) {
    return (
      <button
        type="button"
        title={title}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          border: "none",
          background: active ? "rgba(224,98,90,0.10)" : "transparent",
          color: active ? "var(--color-brand)" : "var(--color-text-secondary)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.4 : 1,
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 100ms ease, color 100ms ease",
          flexShrink: 0,
        }}
        className={disabled ? "" : "hover:bg-[rgba(0,0,0,0.05)] hover:!text-[var(--color-text-primary)]"}
      >
        {children}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "6px 8px",
          borderBottom: "1px solid var(--color-border-default)",
          background: "var(--color-surface-raised)",
          flexWrap: "wrap",
        }}
      >
        <ToolBtn active={isBold} title="Gras" onClick={() => editor.chain().focus().toggleBold().run()}>
          <BoldIcon size={13} />
        </ToolBtn>
        <ToolBtn active={isItalic} title="Italique" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <ItalicIcon size={13} />
        </ToolBtn>

        <span style={{ width: 1, height: 16, background: "var(--color-border-default)", margin: "0 2px", flexShrink: 0 }} />

        <ToolBtn active={isBullet} title="Liste à puces" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={13} />
        </ToolBtn>
        <ToolBtn active={isOrdered} title="Liste numérotée" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={13} />
        </ToolBtn>

        <span style={{ width: 1, height: 16, background: "var(--color-border-default)", margin: "0 2px", flexShrink: 0 }} />

        <ToolBtn
          active={isLink || linkOpen}
          title="Lien"
          onClick={() => { setVideoOpen(false); setLinkOpen((v) => !v); }}
        >
          <LinkIcon size={13} />
        </ToolBtn>

        {onImageUpload && (
          <ToolBtn
            title={uploadingImage ? "Upload en cours…" : "Image"}
            disabled={uploadingImage}
            onClick={() => imageInputRef.current?.click()}
          >
            {uploadingImage ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
          </ToolBtn>
        )}

        <ToolBtn
          active={videoOpen}
          title="Vidéo (YouTube, Loom, Tella)"
          onClick={() => { setLinkOpen(false); setVideoOpen((v) => !v); }}
        >
          <Video size={13} />
        </ToolBtn>
      </div>

      {/* Link panel */}
      {linkOpen && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 10px",
            borderBottom: "1px solid var(--color-border-default)",
            background: "var(--color-surface-raised)",
          }}
        >
          <input
            ref={linkInputRef}
            type="url"
            placeholder="https://…"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleLinkSubmit(); }
              if (e.key === "Escape") { setLinkOpen(false); setLinkInput(""); }
            }}
            style={{
              flex: 1,
              border: "1px solid var(--color-border-default)",
              borderRadius: 8,
              padding: "5px 10px",
              fontSize: 13,
              outline: "none",
              fontFamily: "inherit",
              background: "var(--color-surface-card)",
              color: "var(--color-text-primary)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--color-border-default)")}
          />
          <button
            type="button"
            onClick={handleLinkSubmit}
            style={{
              padding: "5px 12px",
              background: "var(--color-brand)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => { setLinkOpen(false); setLinkInput(""); }}
            style={{
              width: 26, height: 26, borderRadius: "50%", border: "none",
              background: "transparent", cursor: "pointer", color: "var(--color-text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Video panel */}
      {videoOpen && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "8px 10px",
            borderBottom: "1px solid var(--color-border-default)",
            background: "var(--color-surface-raised)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              ref={videoInputRef}
              type="url"
              placeholder="Colle un lien YouTube, Loom ou Tella…"
              value={videoInput}
              onChange={(e) => { setVideoInput(e.target.value); setVideoError(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleVideoSubmit(); }
                if (e.key === "Escape") { setVideoOpen(false); setVideoInput(""); setVideoError(""); }
              }}
              style={{
                flex: 1,
                border: `1px solid ${videoError ? "var(--color-brand)" : "var(--color-border-default)"}`,
                borderRadius: 8,
                padding: "5px 10px",
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
                background: "var(--color-surface-card)",
                color: "var(--color-text-primary)",
              }}
              onFocus={(e) => { if (!videoError) e.target.style.borderColor = "var(--color-brand)"; }}
              onBlur={(e) => { if (!videoError) e.target.style.borderColor = "var(--color-border-default)"; }}
            />
            <button
              type="button"
              onClick={handleVideoSubmit}
              style={{
                padding: "5px 12px",
                background: "var(--color-brand)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => { setVideoOpen(false); setVideoInput(""); setVideoError(""); }}
              style={{
                width: 26, height: 26, borderRadius: "50%", border: "none",
                background: "transparent", cursor: "pointer", color: "var(--color-text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>
          {videoError && (
            <span style={{ fontSize: 12, color: "var(--color-brand)", paddingLeft: 4 }}>
              {videoError}
            </span>
          )}
        </div>
      )}

      {/* Hidden file input for images */}
      {onImageUpload && (
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageSelect}
        />
      )}

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Mention autocomplete dropdown */}
      {filteredSuggestions.length > 0 && mentionPos && (
        <div
          style={{
            position: "fixed",
            top: mentionPos.top,
            left: mentionPos.left,
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            boxShadow: "var(--nc-shadow-3)",
            overflow: "hidden",
            zIndex: 500,
            minWidth: 200,
            animation: "nc-mode-in 120ms var(--nc-ease) both",
          }}
        >
          {filteredSuggestions.map((m) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 13,
                color: "var(--color-text-primary)",
              }}
              className="hover:bg-[var(--color-surface-raised)]"
            >
              <div
                style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: "var(--color-brand)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  m.initials
                )}
              </div>
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Utility: extract mention ids from TipTap HTML for server-side persistence
export function extractMentions(html: string): Array<{ id: string; name: string }> {
  if (typeof window === "undefined") return [];
  const div = document.createElement("div");
  div.innerHTML = html;
  const spans = div.querySelectorAll("[data-mention-id]");
  const seen = new Set<string>();
  const result: Array<{ id: string; name: string }> = [];
  spans.forEach((span) => {
    const id = span.getAttribute("data-mention-id") ?? "";
    const name = (span.textContent ?? "").replace(/^@/, "");
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push({ id, name });
    }
  });
  return result;
}
