"use client";

import { useState, useRef, useEffect } from "react";
import { Bold, Italic, List, Link, Image as ImageIcon, Loader2 } from "lucide-react";
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

// Type local minimal pour brancher CommunityMember sur UserAvatar (qui attend
// un User complet). On comble les champs manquants avec des valeurs neutres ;
// UserAvatar n'utilise concrètement que id / avatarUrl / avatarColor / initials.
function memberAsUserShape(m: CommunityMember): User {
  return {
    id: m.id,
    name: m.name,
    avatarUrl: m.avatarUrl,
    avatarColor: null,
    initials: m.initials,
    role: "member",
    offer: "free",
    joinedAt: "",
  };
}

function detectVideoUrl(text: string): string | null {
  const ytMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const loomMatch = text.match(/https?:\/\/(?:www\.)?loom\.com\/share\/([a-z0-9]+)/i);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;
  const tellaMatch = text.match(/https?:\/\/(?:www\.)?tella\.tv\/video\/([^?\s]+)/i);
  if (tellaMatch) return `https://www.tella.tv/video/${tellaMatch[1]}/embed`;
  return null;
}

// Mention sélectionnée et toujours présente dans le body final au submit.
// Permet aux call sites d'alimenter post_mentions / comment_mentions ou
// comment_replies.mentioned_user_id sans devoir reparser le texte.
export type ComposerMention = { id: string; name: string };

interface CommentComposerProps {
  currentUser: User;
  devRole: DevRole;
  placeholder?: string;
  replyingTo?: string;
  // Si fourni avec un id valide (≠ string vide), on l'enregistre comme mention
  // dans insertedMentions au mount → persistée côté DB (comment_mentions /
  // comment_reply_mentions). Sans ça, l'@name pré-rempli reste un simple
  // texte coloré sans lien vers la table de mentions structurée.
  replyingToUser?: { id: string; name: string };
  onCancelReply?: () => void;
  // Le second arg `mentions` ne contient que les @user encore présents dans
  // le body au moment du submit (l'utilisateur peut effacer une mention après
  // l'avoir insérée — on ne la persistera pas). Optionnel pour les call sites
  // qui n'en ont pas besoin.
  onSubmit: (body: string, mentions: ComposerMention[]) => void;
  compact?: boolean;
  // Pré-remplit l'éditeur (utilisé pour le mode édition d'un commentaire
  // existant). Ignoré si replyingTo est aussi fourni.
  initialValue?: string;
  // Label du bouton submit ("Publier" par défaut, "Enregistrer" en mode edit).
  submitLabel?: string;
  // Désactive le composer pendant un await (loading state).
  disabled?: boolean;
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
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [editorFocused, setEditorFocused] = useState(false);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null);
  const [urlVisible, setUrlVisible] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlPos, setUrlPos] = useState({ top: 0, left: 0 });
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  // Loader pendant l'upload d'image vers Supabase Storage. Pas de spinner
  // distinct dans l'UI courante — on désactive juste le bouton et on toggle
  // une icône Loader2 en place de ImageIcon.
  const [uploadingImage, setUploadingImage] = useState(false);
  // Image en attente de publication — pattern Slack : on upload immédiatement
  // vers Supabase Storage, on affiche une preview sous le textarea, et au
  // submit on append l'URL en fin de body (linkify la rendra en <img> inline).
  // pendingImagePath sert au cleanup orphelin si l'user retire la preview.
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [pendingImagePath, setPendingImagePath] = useState<string | null>(null);
  // Lightbox sur la preview pour vérifier avant publication.
  const [previewLightbox, setPreviewLightbox] = useState(false);
  // Liste des membres autorisés à être mentionnés — alimentée par la Server
  // Action listMembersAction au mount. On filtre l'utilisateur courant (pas
  // de self-mention) côté UI. La capability check (can_view_community) est
  // déjà appliquée côté serveur dans listMembersAction.
  const [mentionables, setMentionables] = useState<CommunityMember[]>([]);
  // Mentions effectivement insérées dans le body — gardées entre le clic du
  // picker et le submit. Une fois le submit fait on filtre celles qui sont
  // toujours visibles dans le texte pour éviter de persister des @name que
  // l'utilisateur aurait effacés.
  const insertedMentions = useRef<ComposerMention[]>([]);

  useEffect(() => {
    let cancelled = false;
    listMembersAction().then((members) => {
      if (cancelled) return;
      setMentionables(members.filter((m) => m.id !== currentUser.id));
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  const suggestions = mentionSearch !== null
    ? mentionables.filter((m) => m.name.toLowerCase().includes(mentionSearch.toLowerCase())).slice(0, 5)
    : [];

  useEffect(() => {
    if (!editorRef.current) return;
    if (replyingTo) {
      // contenteditable="false" + data-mention-id : on aligne le markup sur
      // celui produit par le mention picker (cf. selectMember plus bas) pour
      // que l'effacement caractère-par-caractère retire la mention en bloc.
      const userId = replyingToUser?.id ?? "";
      editorRef.current.innerHTML = `<span data-mention-id="${userId}" contenteditable="false" style="color:var(--color-brand);font-weight:600">@${replyingTo}</span>&nbsp;`;
      setEditorEmpty(false);
      // Enregistre la mention comme insérée pour qu'elle soit persistée côté
      // serveur dans comment_reply_mentions au submit. Sans ça, l'@name
      // pré-rempli ne génère AUCUNE ligne en DB → 0 branding au re-render.
      if (replyingToUser && !insertedMentions.current.some((m) => m.id === replyingToUser.id)) {
        insertedMentions.current.push({ id: replyingToUser.id, name: replyingToUser.name });
      }
      return;
    }
    if (initialValue !== undefined) {
      // textContent évite l'injection HTML — on attend du body plain text.
      editorRef.current.textContent = initialValue;
      setEditorEmpty(initialValue.trim().length === 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyingTo, replyingToUser, initialValue]);

  function syncEmpty() {
    const text = editorRef.current?.innerText?.trim() ?? "";
    setEditorEmpty(text.length === 0);
    setVideoPreview(detectVideoUrl(text));
  }

  function handleInput() {
    syncEmpty();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setMentionSearch(null); return; }
    const range = sel.getRangeAt(0);
    const textBefore = (range.startContainer.textContent ?? "").slice(0, range.startOffset);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      const rect = range.getBoundingClientRect();
      setMentionPos({ top: rect.bottom + 6, left: rect.left });
      setMentionSearch(match[1]);
    } else {
      setMentionSearch(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function insertMention(member: CommunityMember) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType === Node.TEXT_NODE && textNode instanceof Text) {
      const text = textNode.textContent ?? "";
      const offset = range.startOffset;
      const match = text.slice(0, offset).match(/@(\w*)$/);
      if (match) {
        const start = offset - match[0].length;
        // Découpe le textNode : avant @, [@search] retiré, après. On insère
        // un <span> stylé brand+bold pour la mention, puis un espace texte
        // pour relancer la saisie en flux normal (et permettre au regex de
        // détection mention de ne plus se déclencher tant qu'on ne retape
        // pas @).
        const before = text.slice(0, start);
        const after = text.slice(offset);
        textNode.textContent = before;

        const span = document.createElement("span");
        span.textContent = `@${member.name}`;
        // data-mention-id pour qu'on puisse extraire les UUIDs au submit
        // (future amélioration : aujourd'hui on garde insertedMentions ref).
        span.setAttribute("data-mention-id", member.id);
        span.setAttribute("contenteditable", "false");
        span.style.color = "var(--color-brand)";
        span.style.fontWeight = "600";

        const spaceNode = document.createTextNode(" ");
        const afterNode = document.createTextNode(after);

        const parent = textNode.parentNode;
        if (parent) {
          parent.insertBefore(span, textNode.nextSibling);
          parent.insertBefore(spaceNode, span.nextSibling);
          parent.insertBefore(afterNode, spaceNode.nextSibling);

          // Caret après l'espace insécable.
          const newRange = document.createRange();
          newRange.setStart(spaceNode, 1);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
      }
    }
    // Mémorise l'association name→id pour qu'on puisse la remonter au submit
    // même si l'utilisateur retouche le texte autour. On dédoublonne par id
    // (mention multiple du même user → un seul enregistrement).
    if (!insertedMentions.current.some((m) => m.id === member.id)) {
      insertedMentions.current.push({ id: member.id, name: member.name });
    }
    setMentionSearch(null);
    editorRef.current?.focus();
    syncEmpty();
  }

  function handleSubmit() {
    const text = editorRef.current?.innerText?.trim() ?? "";
    // On accepte un commentaire vide en texte SI une image pending est attachée
    // (cas "j'envoie juste une image"). Sinon refus comme avant.
    if (!text && !pendingImageUrl) return;
    // Filtre : on ne garde que les mentions dont le @name est toujours
    // présent dans le body final (l'utilisateur peut avoir effacé une
    // mention insérée). Comparaison insensible à la casse et délimitée
    // pour éviter qu'un nom soit substring d'un autre.
    const stillPresent = insertedMentions.current.filter((m) => {
      const escaped = m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`@${escaped}\\b`, "i").test(text);
    });

    // Append l'URL de l'image en attente en fin de body. Le rendu côté
    // CommentItem détecte les URLs d'image (extension) via linkify et les
    // affiche en <img> inline. Séparation par double newline pour aérer
    // visuellement le texte de l'image.
    const finalBody = pendingImageUrl
      ? (text ? `${text}\n\n${pendingImageUrl}` : pendingImageUrl)
      : text;

    onSubmit(finalBody, stillPresent);
    if (editorRef.current) editorRef.current.innerHTML = "";
    insertedMentions.current = [];
    setEditorEmpty(true);
    setMentionSearch(null);
    // Une fois publié, le pending est "consommé" — pas de cleanup orphelin
    // car le path pointe sur une image désormais référencée dans un comment.
    setPendingImageUrl(null);
    setPendingImagePath(null);
  }

  function handleLinkClick() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    savedRange.current = sel.getRangeAt(0).cloneRange();
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setUrlPos({ top: rect.top - 52, left: rect.left });
    setUrlVisible(true);
    setUrlInput("");
  }

  function insertLink() {
    if (!savedRange.current || !urlInput.trim()) return;
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
    document.execCommand("createLink", false, urlInput.trim());
    setUrlVisible(false);
    editorRef.current?.focus();
    syncEmpty();
  }

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
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--color-surface-raised)",
            transition: "border-color 150ms ease",
          }}
          onFocusCapture={() => setEditorFocused(true)}
          onBlurCapture={() => setEditorFocused(false)}
        >
          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "6px 8px", borderBottom: "1px solid var(--color-border-default)", background: "var(--color-surface-raised)" }}>
            {[
              { Icon: Bold, title: "Gras", cmd: "bold" },
              { Icon: Italic, title: "Italique", cmd: "italic" },
              { Icon: List, title: "Liste", cmd: "insertUnorderedList" },
            ].map(({ Icon, title, cmd }) => (
              <button
                key={cmd}
                type="button"
                title={title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { document.execCommand(cmd, false); editorRef.current?.focus(); syncEmpty(); }}
                style={{ width: 26, height: 26, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", transition: "background 100ms ease" }}
                className="hover:bg-[var(--nc-nav-hover-bg)]"
              >
                <Icon size={13} />
              </button>
            ))}
            <div style={{ width: 1, height: 14, background: "var(--color-border-default)", margin: "0 2px" }} />
            <button
              type="button"
              title="Lien (sélectionne du texte d'abord)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleLinkClick}
              style={{ width: 26, height: 26, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", transition: "background 100ms ease" }}
              className="hover:bg-[rgba(0,0,0,0.06)]"
            >
              <Link size={13} />
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // Reset input value AVANT l'await pour permettre le re-upload
                // du même fichier après une erreur (browsers ignorent un
                // onChange si la value n'a pas changé).
                e.target.value = "";
                setUploadingImage(true);
                const formData = new FormData();
                formData.append("file", file);
                const result = await uploadPostMediaAction(formData);
                setUploadingImage(false);
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                // Pattern Slack : on stocke en state pour afficher une preview
                // sous le textarea. L'URL ne sera append au body qu'au submit.
                // Si une image était déjà en attente, on nettoie l'orphelin.
                if (pendingImagePath) {
                  deletePostMediaAction(pendingImagePath).catch(() => {
                    /* best-effort */
                  });
                }
                setPendingImageUrl(result.publicUrl);
                setPendingImagePath(result.storagePath);
              }}
            />
            <button
              type="button"
              title={uploadingImage ? "Upload en cours…" : "Image"}
              disabled={uploadingImage}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => !uploadingImage && imageInputRef.current?.click()}
              style={{
                width: 26, height: 26, borderRadius: 5, border: "none",
                background: "transparent",
                cursor: uploadingImage ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--color-text-muted)",
                opacity: uploadingImage ? 0.5 : 1,
                transition: "background 100ms ease",
              }}
              className={uploadingImage ? "" : "hover:bg-[rgba(0,0,0,0.06)]"}
            >
              {uploadingImage ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
            </button>
            {/* Bouton vidéo retiré — décision produit 2026-06-02 (Théo).
                Le preview vidéo est toujours auto-détecté à partir d'un
                lien Tella/YouTube/Loom collé dans le body. */}
          </div>

          {/* ContentEditable */}
          <div style={{ position: "relative" }}>
            {editorEmpty && (
              <span style={{ position: "absolute", top: 10, left: 14, color: "var(--color-text-muted)", fontSize: 14, pointerEvents: "none", userSelect: "none" }}>
                {placeholder}
              </span>
            )}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              style={{ minHeight: 60, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", lineHeight: 1.55, color: "var(--color-text-primary)", wordBreak: "break-word" }}
            />

            {/* Preview image en attente — sous le textarea, taille modérée
                Slack-like, click pour agrandir, croix pour retirer + delete
                de l'orphelin côté Supabase. */}
            {pendingImageUrl && (
              <div style={{ padding: "0 14px 10px", position: "relative", display: "inline-block" }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingImageUrl}
                    alt="Aperçu"
                    onClick={() => setPreviewLightbox(true)}
                    style={{
                      maxWidth: 240,
                      maxHeight: 200,
                      borderRadius: 10,
                      border: "1px solid var(--color-border-default)",
                      objectFit: "cover",
                      display: "block",
                      cursor: "zoom-in",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingImagePath) {
                        deletePostMediaAction(pendingImagePath).catch(() => {
                          /* best-effort */
                        });
                      }
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
              </div>
            )}
          </div>
        </div>

        {/* Mention suggestions */}
        {suggestions.length > 0 && mentionPos && (
          <div style={{ position: "fixed", top: mentionPos.top, left: mentionPos.left, background: "var(--color-surface-card)", border: "1px solid var(--color-border-default)", borderRadius: 12, boxShadow: "var(--nc-shadow-3)", overflow: "hidden", zIndex: 500, minWidth: 200 }}>
            {suggestions.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: "var(--color-text-primary)" }}
                className="hover:bg-[var(--color-surface-raised)]"
              >
                <UserAvatar user={memberAsUserShape(m)} size={24} />
                {m.name}
              </button>
            ))}
          </div>
        )}

        {/* URL input flottant */}
        {urlVisible && (
          <div style={{ position: "fixed", top: urlPos.top, left: urlPos.left, background: "var(--color-surface-card)", border: "1px solid var(--color-border-default)", borderRadius: 12, boxShadow: "var(--nc-shadow-3)", padding: "8px 10px", display: "flex", alignItems: "center", gap: 6, zIndex: 500, animation: "nc-mode-in 150ms var(--nc-ease) both" }}>
            <input
              autoFocus
              type="url"
              placeholder="https://…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertLink(); } if (e.key === "Escape") setUrlVisible(false); }}
              style={{ border: "1px solid var(--color-border-default)", borderRadius: 8, padding: "6px 10px", fontSize: 13, outline: "none", width: 200, fontFamily: "inherit" }}
            />
            <button type="button" onClick={insertLink} style={{ padding: "6px 12px", background: "var(--color-brand)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>OK</button>
            <button type="button" onClick={() => setUrlVisible(false)} style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✕</button>
          </div>
        )}

        {videoPreview && (
          <div style={{ borderRadius: 10, overflow: "hidden", aspectRatio: "16/9", marginTop: 8 }}>
            <iframe
              src={videoPreview}
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={(editorEmpty && !pendingImageUrl) || disabled}
            style={{
              padding: "7px 18px",
              background: (!editorEmpty || pendingImageUrl) && !disabled ? "var(--color-brand)" : "var(--nc-btn-disabled-bg)",
              color: (!editorEmpty || pendingImageUrl) && !disabled ? "#fff" : "var(--nc-btn-disabled-text)",
              border: "none",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              cursor: (!editorEmpty || pendingImageUrl) && !disabled ? "pointer" : "not-allowed",
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
