"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Paperclip, X, FileText, Loader2, Reply as ReplyIcon } from "lucide-react";
import { PaperplaneFill } from "@/shared/components/icons";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";

// Bucket + limite alignés sur l'ancienne server action uploadDmFileAction.
const COMMUNITY_BUCKET = "community";
const DM_FILE_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

interface PendingFile {
  name: string;
  // Blob URL local pour la preview avant envoi (lightbox + thumbnail).
  previewUrl: string | null;
  // Fichier brut, conservé EN LOCAL : il n'est uploadé vers Supabase Storage
  // qu'au moment de l'envoi du message (cf. handleSend) → aucun orphelin en
  // storage/DB si l'utilisateur annule, et l'ajout de la PJ est instantané.
  file: File;
  type: "image" | "pdf";
}

// Upload direct navigateur → Supabase Storage (un seul saut réseau, au lieu de
// navigateur → server action → Storage). Déclenché UNIQUEMENT à l'envoi. La RLS
// community_insert_own (mig. 018) restreint au dossier uploads/<auth.uid>/.
async function uploadDmFileToStorage(
  file: File,
): Promise<{ ok: true; publicUrl: string } | { ok: false; message: string }> {
  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "Tu dois être connecté pour envoyer un fichier." };

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const path = `uploads/${user.id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(COMMUNITY_BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      console.error("[MessageComposer] storage upload failed:", error.message);
      return { ok: false, message: "Impossible d'envoyer le fichier. Réessaie." };
    }
    const { data } = supabase.storage.from(COMMUNITY_BUCKET).getPublicUrl(path);
    return { ok: true, publicUrl: data.publicUrl };
  } catch (err) {
    console.error("[MessageComposer] upload exception:", err);
    return { ok: false, message: "Échec de l'upload, réessaie." };
  }
}

// Quote-reply : info minimale nécessaire pour afficher la preview au-dessus
// du textarea ET la propager dans sendMessageAction (reply_to_message_id +
// snippet + author_name dénormalisés, cf. mig. 027).
export interface ReplyContext {
  messageId: string;
  authorName: string;
  snippet: string;
}

interface MessageComposerProps {
  // Signature étendue : on remonte aussi fileUrl pour que la chaîne
  // d'envoi puisse persister l'URL publique Supabase dans messages.file_url
  // (avant : on n'envoyait que fileName, l'URL réelle était perdue).
  onSend: (
    body: string,
    type?: "text" | "pdf" | "image",
    fileUrl?: string,
    fileName?: string,
  ) => void;
  // Appelé à chaque frappe (throttle géré par le hook caller). Sert à
  // broadcast un ping "je suis en train d'écrire" sur le channel Realtime.
  onTyping?: () => void;
  disabled?: boolean;
  disabledMessage?: string;
  // Si fourni, affiche un quote-block au-dessus du textarea avec l'auteur +
  // le snippet du message cité, et une croix pour annuler. Le parent
  // (ConversationThread) résout cet état et l'utilise pour enrichir la
  // payload sendMessageAction.
  replyContext?: ReplyContext;
  onCancelReply?: () => void;
}

// Détection navigateur Mac — sur Mac on remplace le mot "Entrée" par
// l'icône ⌘ dans le hint du textarea, pour s'aligner sur la convention
// visuelle macOS. Calculé côté client uniquement (SSR-safe via useEffect).
function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || "";
  const ua = navigator.userAgent || "";
  return /Mac|iPhone|iPod|iPad/i.test(platform) || /Macintosh/i.test(ua);
}

export function MessageComposer({
  onSend,
  onTyping,
  disabled,
  disabledMessage,
  replyContext,
  onCancelReply,
}: MessageComposerProps) {
  const [value, setValue] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  // Upload en cours AU MOMENT DE L'ENVOI (plus au moment de l'ajout).
  const [sending, setSending] = useState(false);
  const [isMac, setIsMac] = useState(false);
  // OPS-44 — Lightbox sur la preview d'image / PDF avant envoi. On ouvre
  // au click de la vignette ; on garde l'état "viewing" séparé du
  // pendingFile pour que la fermeture de la lightbox ne supprime pas le
  // fichier en attente.
  const [viewing, setViewing] = useState<PendingFile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hydratation : on calcule isMac une fois côté client pour éviter un
  // mismatch SSR (server n'a pas navigator).
  useEffect(() => {
    setIsMac(detectMac());
  }, []);

  // Filet de sécurité : si le composer est démonté alors que le champ était
  // encore focus (navigation, fermeture de conversation), le `blur` peut ne pas
  // se déclencher → on retire la classe de saisie au démontage pour ne pas
  // laisser la BottomNav masquée ailleurs dans l'app.
  useEffect(() => {
    return () => {
      document.body.classList.remove("nc-composer-typing");
    };
  }, []);

  async function handleSend() {
    if (disabled || sending) return;
    if (pendingFile) {
      // Upload JUSTE-À-TEMPS : le fichier était resté en local, on l'envoie
      // vers Storage seulement maintenant. Le bouton passe en spinner pendant
      // ce temps ; en cas d'échec on garde la PJ pour réessayer.
      setSending(true);
      const uploaded = await uploadDmFileToStorage(pendingFile.file);
      setSending(false);
      if (!uploaded.ok) {
        toast.error(uploaded.message);
        return;
      }
      const trimmedText = value.trim();
      onSend(
        trimmedText, // body texte facultatif accompagnant le fichier
        pendingFile.type,
        uploaded.publicUrl,
        pendingFile.name,
      );
      if (pendingFile.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
      setPendingFile(null);
      setViewing(null);
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      return;
    }
    if (!value.trim()) return;
    onSend(value.trim(), "text");
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextareaInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function attachFile(file: File) {
    // Garde-fou taille (25 MB). Le type est borné par l'attribut accept du
    // <input> ; la RLS storage restreint de toute façon au dossier de l'user.
    if (file.size > DM_FILE_MAX_BYTES) {
      toast.error(`Le fichier dépasse ${Math.round(DM_FILE_MAX_BYTES / 1024 / 1024)} MB.`);
      return;
    }
    const isImage = file.type.startsWith("image/");
    // "image" = vraie image (rendu inline) ; "pdf" = bucket générique pour tout
    // autre fichier (rendu icône + nom + lien download).
    const type: "image" | "pdf" = isImage ? "image" : "pdf";

    // Blob URL local pour la preview/lightbox. AUCUN upload ici : le fichier
    // reste en local jusqu'à l'envoi (cf. handleSend) → PJ instantanée, pas
    // d'orphelin en storage si on annule.
    const previewUrl = isImage ? URL.createObjectURL(file) : null;
    setPendingFile({ name: file.name, previewUrl, file, type });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    attachFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) attachFile(file);
  }

  function removePendingFile() {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  }

  if (disabled) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "var(--color-surface-raised)",
          borderTop: "1px solid var(--color-border-default)",
          textAlign: "center",
          fontSize: 13,
          color: "var(--color-text-muted)",
          fontStyle: "italic",
        }}
      >
        {disabledMessage ?? "Conversation désactivée"}
      </div>
    );
  }

  // Envoi possible dès qu'il y a du texte OU une PJ locale ; désactivé le temps
  // de l'upload juste-à-temps (sending).
  const canSend = (!!pendingFile || value.trim().length > 0) && !sending;

  return (
    <div
      data-fb-label="Composer de message · Communauté"
      style={{
        borderTop: "1px solid var(--color-border-default)",
        background: "var(--color-surface-card)",
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {dragging && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(224,98,90,0.08)",
            border: "2px dashed var(--color-brand)",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "var(--color-brand)",
            zIndex: 10,
          }}
        >
          Déposez votre fichier ici
        </div>
      )}

      {/* Quote-reply preview — la prop replyContext pilote l'affichage. La
          payload reply_to_message_id sera passée côté parent dans onSend(). */}
      {replyContext && (
        <div
          style={{
            padding: "10px 16px 0",
            display: "flex",
            alignItems: "stretch",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 3,
              borderRadius: 9999,
              background: "var(--color-brand)",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--color-brand)",
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              <ReplyIcon size={12} />
              Réponse à {replyContext.authorName}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--color-text-secondary)",
                lineHeight: 1.4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {replyContext.snippet}
            </div>
          </div>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              aria-label="Annuler la réponse"
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-text-muted)",
                flexShrink: 0,
                alignSelf: "flex-start",
              }}
              className="hover:bg-[rgba(0,0,0,0.06)]"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Pending file preview */}
      {pendingFile && (
        <div
          style={{
            padding: "10px 16px 0",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <div
            style={{
              position: "relative",
              display: "inline-flex",
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid var(--color-border-default)",
            }}
          >
            {/* OPS-44 — clic sur la vignette = ouvrir la lightbox. La croix
                de suppression au coin supérieur droit garde son comportement
                via stopPropagation pour ne pas déclencher l'ouverture. */}
            <button
              type="button"
              // Lightbox UNIQUEMENT pour les images (la previewUrl est null
              // pour les non-images, on n'a rien à agrandir avant l'envoi).
              onClick={() => {
                if (pendingFile.type === "image" && pendingFile.previewUrl) {
                  setViewing(pendingFile);
                }
              }}
              aria-label={
                pendingFile.type === "image"
                  ? "Agrandir l'image"
                  : `Fichier ${pendingFile.name}`
              }
              style={{
                padding: 0,
                margin: 0,
                background: "transparent",
                border: "none",
                cursor: pendingFile.type === "image" ? "zoom-in" : "default",
                display: "block",
              }}
            >
              {pendingFile.type === "image" && pendingFile.previewUrl ? (
                <img
                  src={pendingFile.previewUrl}
                  alt="preview"
                  style={{ width: 80, height: 80, objectFit: "cover", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    width: 80, height: 80, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 4,
                    background: "var(--color-surface-raised)", fontSize: 10,
                    color: "var(--color-text-muted)", padding: 4, textAlign: "center",
                  }}
                >
                  <FileText size={24} style={{ color: "var(--color-text-secondary)" }} />
                  <span style={{ wordBreak: "break-all", lineHeight: 1.2 }}>{pendingFile.name}</span>
                </div>
              )}
              {/* Overlay loader pendant l'upload AU MOMENT DE L'ENVOI. */}
              {sending && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <Loader2 size={20} color="#fff" className="animate-spin" />
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removePendingFile();
              }}
              style={{
                position: "absolute", top: 4, right: 4,
                width: 20, height: 20, borderRadius: "50%",
                background: "rgba(0,0,0,0.55)", border: "none",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", color: "#fff",
              }}
            >
              <X size={11} />
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: "12px 16px", display: "flex", alignItems: "flex-end", gap: 8 }}>
        <input
          ref={fileRef}
          type="file"
          // Whitelist large : images + PDF + Office + texte + archives +
          // audio + vidéo. Synchro avec DM_FILE_ALLOWED_MIME côté server.
          // Le server retourne une erreur claire si le MIME n'est pas autorisé.
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.zip,.rar,.7z,.tar,.gz,audio/*,video/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          data-fb-label="Bouton Joindre un fichier · Composer de message"
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "1px solid var(--color-border-default)",
            background: "var(--color-surface-raised)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--color-text-muted)", flexShrink: 0,
            transition: "background var(--nc-duration-xfast) var(--nc-ease)",
          }}
          className="hover:bg-[var(--nc-nav-hover-bg)]"
          aria-label="Joindre un fichier"
        >
          <Paperclip size={16} />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            // Ping typing channel — le hook gère le throttle (1 ping / 2s).
            // On émet seulement quand il y a vraiment du texte ajouté pour
            // éviter de signaler "écrit…" sur un backspace en boucle.
            if (e.target.value.length > 0) onTyping?.();
          }}
          onInput={handleTextareaInput}
          onKeyDown={handleKeyDown}
          data-fb-label="Champ de saisie · Composer de message"
          placeholder={`Tapez un message… (${isMac ? "⌘" : "Entrée"} pour envoyer)`}
          rows={1}
          style={{
            flex: 1,
            padding: "9px 14px",
            border: "1px solid var(--color-border-default)",
            borderRadius: 20,
            fontSize: 14,
            resize: "none",
            outline: "none",
            fontFamily: "inherit",
            lineHeight: 1.5,
            background: "var(--color-surface-raised)",
            color: "var(--color-text-primary)",
            transition: "border-color var(--nc-duration-xfast) var(--nc-ease), height var(--nc-duration-xfast) var(--nc-ease)",
            overflow: "hidden",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--color-brand)";
            // Recalibration layout mobile : masque la BottomNav + descend la
            // zone messages juste au-dessus du clavier (cf. body.nc-composer-typing
            // dans globals.css). Pure classe CSS → aucun impact sur le clavier
            // natif / l'autofill.
            document.body.classList.add("nc-composer-typing");
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--color-border-default)";
            document.body.classList.remove("nc-composer-typing");
          }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          data-fb-label="Bouton Envoyer · Composer de message"
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: canSend ? "var(--color-brand)" : "var(--nc-btn-disabled-bg)",
            border: "none", cursor: canSend ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: canSend ? "#fff" : "var(--nc-btn-disabled-text)",
            flexShrink: 0,
            transition: "all var(--nc-duration-xfast) var(--nc-ease)",
          }}
          aria-label="Envoyer"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <PaperplaneFill size={16} />}
        </button>
      </div>

      {/* OPS-44 — Lightbox d'agrandissement pour images ET PDF, ouverte au
          click sur la vignette de la preview ci-dessus. */}
      {viewing && viewing.previewUrl && (
        <FileLightbox
          url={viewing.previewUrl}
          name={viewing.name}
          type={viewing.type}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// FileLightbox — overlay plein écran avec backdrop dim + blur. Images
// affichées en `object-fit: contain` à max 90vw/90vh. PDF rendus via
// <iframe> qui s'appuie sur le viewer natif du navigateur (zoom, scroll,
// pagination gérés nativement). Fermeture : click backdrop, bouton X,
// touche Échap. Mode mobile : le pinch-to-zoom navigateur fonctionne sur
// l'image (et l'iframe PDF). Pas de swipe-to-close volontairement — on
// reste sur les 2 affordances explicites (backdrop click + bouton X).
// ============================================================================
function FileLightbox({
  url,
  name,
  type,
  onClose,
}: {
  url: string;
  name: string;
  type: "image" | "pdf";
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        type === "image" ? "Aperçu agrandi de l'image" : "Aperçu agrandi du PDF"
      }
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "nc-mode-in 180ms var(--nc-ease) both",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer l'aperçu"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.12)",
          color: "white",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "background var(--nc-duration-xfast) var(--nc-ease)",
        }}
        className="hover:bg-white/25"
      >
        <X size={18} />
      </button>

      {type === "image" ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt={name}
          style={{
            maxWidth: "90vw",
            maxHeight: "90vh",
            objectFit: "contain",
            borderRadius: 12,
            boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.5)",
            display: "block",
          }}
        />
      ) : (
        <iframe
          src={url}
          title={name}
          style={{
            width: "min(90vw, 1100px)",
            height: "90vh",
            border: "none",
            borderRadius: 12,
            background: "var(--color-surface-card)",
            boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.5)",
            display: "block",
          }}
        />
      )}
    </div>,
    document.body,
  );
}
