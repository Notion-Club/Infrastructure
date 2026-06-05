"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import {
  deletePostMediaAction,
  listMembersAction,
  uploadPostMediaAction,
} from "../../server/actions";
import { ImageLightbox } from "../shared/ImageLightbox";
import type { CommunityMember } from "../../server/queries";
import { UserAvatar } from "../shared/UserAvatar";
import { RichTextEditor, extractMentions } from "@/shared/components/editor/RichTextEditor";
import type { MentionItem } from "@/shared/components/editor/MentionNode";

export type ComposerMention = { id: string; name: string };

interface CommentComposerProps {
  currentUser: User;
  devRole: DevRole;
  placeholder?: string;
  replyingTo?: string;
  replyingToUser?: { id: string; name: string };
  onCancelReply?: () => void;
  onSubmit: (body: string, mentions: ComposerMention[]) => void;
  compact?: boolean;
  initialValue?: string;
  submitLabel?: string;
  disabled?: boolean;
}

function memberToMentionItem(m: CommunityMember): MentionItem {
  return { id: m.id, name: m.name, avatarUrl: m.avatarUrl, initials: m.initials };
}

export function CommentComposer({
  currentUser,
  placeholder = "Ajouter un commentaire…",
  replyingTo,
  replyingToUser,
  onCancelReply,
  onSubmit,
  initialValue,
  submitLabel,
  disabled = false,
}: CommentComposerProps) {
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyEmpty, setBodyEmpty] = useState(true);
  const [editorFocused, setEditorFocused] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [pendingImagePath, setPendingImagePath] = useState<string | null>(null);
  const [previewLightbox, setPreviewLightbox] = useState(false);
  const [mentionables, setMentionables] = useState<MentionItem[]>([]);
  // resetKey forces editor to clear after submit
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listMembersAction().then((members) => {
      if (cancelled) return;
      setMentionables(
        members
          .filter((m) => m.id !== currentUser.id)
          .map(memberToMentionItem),
      );
    });
    return () => { cancelled = true; };
  }, [currentUser.id]);

  // Build initial content for the editor
  // If replying to someone, pre-fill with @mention HTML
  const initialContent = (() => {
    if (replyingTo && replyingToUser) {
      return `<span data-mention-id="${replyingToUser.id}" class="nc-mention">@${replyingTo}</span>&nbsp;`;
    }
    if (initialValue) {
      // initialValue may be plain text — wrap in <p>
      return initialValue.trimStart().startsWith("<") ? initialValue : `<p>${initialValue}</p>`;
    }
    return "";
  })();

  function handleSubmit() {
    if ((bodyEmpty && !pendingImageUrl) || disabled) return;

    const mentions = extractMentions(bodyHtml);

    // Append pending image URL in body if present (same pattern as before)
    const finalBody = pendingImageUrl
      ? bodyEmpty
        ? `<p><img src="${pendingImageUrl}" alt="" /></p>`
        : `${bodyHtml}<p><img src="${pendingImageUrl}" alt="" /></p>`
      : bodyHtml;

    onSubmit(finalBody, mentions);

    // Reset editor
    setBodyHtml("");
    setBodyEmpty(true);
    setResetKey((k) => k + 1);
    setPendingImageUrl(null);
    setPendingImagePath(null);
  }

  async function handleImageUpload(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadPostMediaAction(formData);
    if (!result.ok) {
      toast.error(result.message);
      return null;
    }
    if (pendingImagePath) {
      deletePostMediaAction(pendingImagePath).catch(() => {});
    }
    setPendingImageUrl(result.publicUrl);
    setPendingImagePath(result.storagePath);
    return result.publicUrl;
  }

  const canSubmit = (!bodyEmpty || !!pendingImageUrl) && !disabled;

  return (
    <>
      <div style={{ display: "flex", gap: 10, position: "relative" }}>
        <UserAvatar user={currentUser} size={36} />
        <div style={{ flex: 1 }}>
          {replyingTo && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, color: "var(--color-text-muted)" }}>
              Réponse à <strong style={{ color: "var(--color-brand)" }}>@{replyingTo}</strong>
              {onCancelReply && (
                <button type="button" onClick={onCancelReply} style={{ marginLeft: 4, fontSize: 11, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                  ✕ Annuler
                </button>
              )}
            </div>
          )}

          {/* Editor container */}
          <div
            style={{
              border: `1px solid ${editorFocused ? "var(--color-brand)" : "var(--color-border-default)"}`,
              borderRadius: 12, overflow: "hidden",
              background: "var(--color-surface-raised)",
              transition: "border-color 150ms ease",
            }}
            onFocusCapture={() => setEditorFocused(true)}
            onBlurCapture={() => setEditorFocused(false)}
          >
            <RichTextEditor
              key={`${resetKey}-${replyingTo ?? ""}`}
              placeholder={placeholder}
              initialContent={initialContent}
              minHeight={60}
              mentionables={mentionables}
              onImageUpload={handleImageUpload}
              onChange={(html, isEmpty) => {
                setBodyHtml(html);
                setBodyEmpty(isEmpty);
              }}
            />
          </div>

          {/* Pending image preview */}
          {pendingImageUrl && (
            <div style={{ marginTop: 8, position: "relative", display: "inline-block" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImageUrl}
                alt="Aperçu"
                onClick={() => setPreviewLightbox(true)}
                style={{
                  maxWidth: 240, maxHeight: 200, borderRadius: 10,
                  border: "1px solid var(--color-border-default)",
                  objectFit: "cover", display: "block", cursor: "zoom-in",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (pendingImagePath) deletePostMediaAction(pendingImagePath).catch(() => {});
                  setPendingImageUrl(null);
                  setPendingImagePath(null);
                }}
                aria-label="Retirer l'image"
                style={{
                  position: "absolute", top: 6, right: 6,
                  width: 22, height: 22, borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 11,
                }}
              >
                ✕
              </button>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                padding: "7px 18px",
                background: canSubmit ? "var(--color-brand)" : "var(--nc-btn-disabled-bg)",
                color: canSubmit ? "#fff" : "var(--nc-btn-disabled-text)",
                border: "none", borderRadius: 9999, fontSize: 13, fontWeight: 600,
                cursor: canSubmit ? "pointer" : "not-allowed",
                transition: "all 150ms ease",
                opacity: disabled ? 0.7 : 1,
              }}
            >
              {submitLabel ?? "Commenter"}
            </button>
          </div>
        </div>
      </div>

      {previewLightbox && pendingImageUrl && (
        <ImageLightbox
          url={pendingImageUrl}
          alt="Aperçu de l'image en cours de publication"
          onClose={() => setPreviewLightbox(false)}
        />
      )}
    </>
  );
}
