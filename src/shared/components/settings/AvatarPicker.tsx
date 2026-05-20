"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import {
  Check,
  Image as ImageIcon,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  AVATAR_ALLOWED_MIME,
  AVATAR_COLOR_PALETTE,
  AVATAR_MAX_BYTES,
  DEFAULT_AVATAR_COLOR,
  isAllowedAvatarMime,
  removeAvatarAction,
  updateAvatarColorAction,
  uploadAvatarAction,
  type AvatarColor,
} from "@/modules/settings";
import { AvatarCropper } from "./AvatarCropper";

type Tab = "color" | "photo";

type SourceImage = {
  url: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

type AvatarPickerProps = {
  currentColor: string | null; // null = couleur brand par défaut
  hasPhoto: boolean;
  initials: string;
  isMocked: boolean;
  onClose: () => void;
  onAvatarUpdated: (next: {
    avatarUrl?: string | null;
    avatarColor?: string | null;
  }) => void;
};

export function AvatarPicker({
  currentColor,
  hasPhoto,
  initials,
  isMocked,
  onClose,
  onAvatarUpdated,
}: AvatarPickerProps) {
  const [tab, setTab] = useState<Tab>("color");
  const [selectedColor, setSelectedColor] = useState<AvatarColor>(
    (currentColor as AvatarColor | null) ?? DEFAULT_AVATAR_COLOR,
  );
  const [savingColor, setSavingColor] = useState(false);
  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Body scroll lock + Escape close
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !savingColor && !uploading && !removing) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, savingColor, uploading, removing]);

  // Cleanup blob URL si on quitte le picker avec une image en attente
  useEffect(() => {
    return () => {
      if (sourceImage?.url.startsWith("blob:")) {
        URL.revokeObjectURL(sourceImage.url);
      }
    };
  }, [sourceImage]);

  const colorChanged = selectedColor !== (currentColor ?? DEFAULT_AVATAR_COLOR);

  async function handleSaveColor() {
    if (!colorChanged || savingColor) return;
    setSavingColor(true);
    try {
      if (isMocked) {
        await new Promise((r) => setTimeout(r, 400));
        toast.success("Couleur mise à jour (démo)");
        onAvatarUpdated({ avatarColor: selectedColor });
        onClose();
        return;
      }
      const result = await updateAvatarColorAction({ color: selectedColor });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Couleur mise à jour");
      onAvatarUpdated({ avatarColor: selectedColor });
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de la mise à jour.";
      toast.error(message);
    } finally {
      setSavingColor(false);
    }
  }

  function ingestFile(file: File) {
    if (!isAllowedAvatarMime(file.type)) {
      toast.error(
        `Format non supporté. Utilise ${AVATAR_ALLOWED_MIME.join(", ")}.`,
      );
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(
        `Le fichier dépasse ${Math.round(AVATAR_MAX_BYTES / 1024 / 1024)} MB.`,
      );
      return;
    }
    const url = URL.createObjectURL(file);
    setSourceImage({ url, mimeType: file.type });
  }

  async function handleCropConfirm(croppedFile: File) {
    setUploading(true);
    try {
      if (isMocked) {
        await new Promise((r) => setTimeout(r, 400));
        toast.info("Aperçu local — connectez-vous pour enregistrer.");
        // Convert to data URL pour aperçu visuel en mode démo
        const reader = new FileReader();
        reader.onload = () => {
          const url =
            typeof reader.result === "string" ? reader.result : null;
          if (url) onAvatarUpdated({ avatarUrl: url });
        };
        reader.readAsDataURL(croppedFile);
        closeCropper();
        onClose();
        return;
      }
      const formData = new FormData();
      formData.append("file", croppedFile);
      const result = await uploadAvatarAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Photo de profil mise à jour");
      onAvatarUpdated({ avatarUrl: result.publicUrl });
      closeCropper();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de l'envoi.";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  function closeCropper() {
    if (sourceImage?.url.startsWith("blob:")) {
      URL.revokeObjectURL(sourceImage.url);
    }
    setSourceImage(null);
  }

  async function handleRemovePhoto() {
    if (removing) return;
    setRemoving(true);
    try {
      if (isMocked) {
        await new Promise((r) => setTimeout(r, 300));
        toast.info("Suppression simulée (démo).");
        onAvatarUpdated({ avatarUrl: null });
        onClose();
        return;
      }
      const result = await removeAvatarAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Photo supprimée");
      onAvatarUpdated({ avatarUrl: null });
      onClose();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Personnaliser l'avatar"
        onClick={(e) => {
          if (
            e.target === e.currentTarget &&
            !savingColor &&
            !uploading &&
            !removing
          ) {
            onClose();
          }
        }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            background: "white",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 24px 48px -12px rgba(0,0,0,0.35)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <header
            style={{
              padding: "18px 20px 0",
              borderBottom: "1px solid var(--color-border-default)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                color: "var(--color-text-primary)",
              }}
            >
              Personnaliser l&apos;avatar
            </h2>
            <p
              style={{
                margin: "4px 0 14px",
                fontSize: 13,
                color: "var(--color-text-muted)",
                lineHeight: 1.4,
              }}
            >
              Choisis une couleur de fond ou ajoute une photo.
            </p>

            <div
              role="tablist"
              style={{
                display: "flex",
                gap: 4,
                marginBottom: -1,
              }}
            >
              <TabButton
                active={tab === "color"}
                onClick={() => setTab("color")}
              >
                Couleur
              </TabButton>
              <TabButton
                active={tab === "photo"}
                onClick={() => setTab("photo")}
              >
                Photo
              </TabButton>
            </div>
          </header>

          <div
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              minHeight: 280,
            }}
          >
            {tab === "color" ? (
              <ColorTab
                selected={selectedColor}
                onSelect={setSelectedColor}
                initials={initials}
              />
            ) : (
              <PhotoTab
                onFile={ingestFile}
                hasPhoto={hasPhoto}
                removing={removing}
                onRemove={handleRemovePhoto}
              />
            )}
          </div>

          <footer
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              padding: "14px 20px",
              borderTop: "1px solid var(--color-border-default)",
              background: "var(--color-surface-raised)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={savingColor || uploading || removing}
              style={{
                padding: "9px 18px",
                borderRadius: 9999,
                border: "1px solid var(--color-border-default)",
                background: "white",
                color: "var(--color-text-secondary)",
                fontSize: 13,
                fontWeight: 500,
                cursor:
                  savingColor || uploading || removing
                    ? "not-allowed"
                    : "pointer",
                opacity: savingColor || uploading || removing ? 0.6 : 1,
              }}
            >
              {tab === "color" && colorChanged ? "Annuler" : "Fermer"}
            </button>
            {tab === "color" && (
              <button
                type="button"
                onClick={handleSaveColor}
                disabled={!colorChanged || savingColor}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 18px",
                  borderRadius: 9999,
                  border: "none",
                  background: "var(--color-brand)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: colorChanged && !savingColor ? "pointer" : "not-allowed",
                  opacity: colorChanged && !savingColor ? 1 : 0.55,
                  boxShadow: "0 6px 18px -8px rgba(224,98,90,0.55)",
                }}
              >
                {savingColor && (
                  <LoaderCircle size={14} className="animate-spin" />
                )}
                {savingColor ? "Enregistrement…" : "Enregistrer"}
              </button>
            )}
          </footer>
        </div>
      </div>

      {sourceImage && (
        <AvatarCropper
          imageSrc={sourceImage.url}
          mimeType={sourceImage.mimeType}
          onConfirm={handleCropConfirm}
          onCancel={closeCropper}
          submitting={uploading}
        />
      )}
    </>
  );
}

// ============================================================================
// TabButton
// ============================================================================
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "10px 16px",
        borderRadius: "10px 10px 0 0",
        border: "none",
        borderBottom: active
          ? "2px solid var(--color-brand)"
          : "2px solid transparent",
        background: "transparent",
        color: active
          ? "var(--color-text-primary)"
          : "var(--color-text-muted)",
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        transition: "color 150ms ease, border-bottom-color 150ms ease",
      }}
    >
      {children}
    </button>
  );
}

// ============================================================================
// ColorTab
// ============================================================================
function ColorTab({
  selected,
  onSelect,
  initials,
}: {
  selected: AvatarColor;
  onSelect: (color: AvatarColor) => void;
  initials: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Preview */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "8px 0",
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            background: selected,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.02em",
            border: "4px solid white",
            boxShadow:
              "0 14px 32px -10px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.06)",
            transition: "background 200ms ease",
          }}
        >
          {initials}
        </div>
      </div>

      {/* Palette grid 4x2 */}
      <div
        role="radiogroup"
        aria-label="Couleur d'avatar"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
        }}
      >
        {AVATAR_COLOR_PALETTE.map((color) => {
          const active = selected === color;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`Couleur ${color}`}
              onClick={() => onSelect(color)}
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                borderRadius: "50%",
                background: color,
                border: active
                  ? "3px solid var(--color-text-primary)"
                  : "3px solid transparent",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                transition: "transform 150ms ease, border-color 150ms ease",
                transform: active ? "scale(1.05)" : "scale(1)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              }}
            >
              {active && <Check size={20} strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// PhotoTab — zone drop & click & paste
// ============================================================================
function PhotoTab({
  onFile,
  hasPhoto,
  removing,
  onRemove,
}: {
  onFile: (file: File) => void;
  hasPhoto: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Paste listener au niveau du modal (dropZone focus pas garanti).
  // Capture Cmd/Ctrl+V quand le tab Photo est actif.
  useEffect(() => {
    function onPaste(e: globalThis.ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item && item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onFile(file);
            return;
          }
        }
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [onFile]);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Le dragleave fire aussi sur les enfants — on check qu'on quitte vraiment
    // le dropZone (et pas juste un enfant).
    if (
      dropZoneRef.current &&
      !dropZoneRef.current.contains(e.relatedTarget as Node)
    ) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  function handleClick() {
    inputRef.current?.click();
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClipboardPaste(e: ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item && item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          onFile(file);
          return;
        }
      }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        ref={dropZoneRef}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaste={handleClipboardPaste}
        aria-label="Zone de dépôt pour photo de profil"
        style={{
          border: `2px dashed ${isDragging ? "var(--color-brand)" : "var(--color-border-default)"}`,
          background: isDragging
            ? "rgba(224,98,90,0.06)"
            : "var(--color-surface-raised)",
          borderRadius: 16,
          padding: "32px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          cursor: "pointer",
          transition: "background 150ms ease, border-color 150ms ease",
          outline: "none",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: isDragging
              ? "var(--color-brand)"
              : "rgba(0,0,0,0.04)",
            color: isDragging ? "white" : "var(--color-text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 150ms ease, color 150ms ease",
          }}
        >
          {isDragging ? <Upload size={22} /> : <ImageIcon size={22} />}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            textAlign: "center",
          }}
        >
          {isDragging
            ? "Lâche pour importer"
            : "Glisse une photo ici ou clique"}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-text-muted)",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          PNG, JPEG, WebP · 2 MB max
          <br />
          Tu peux aussi coller une image avec ⌘V
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {hasPhoto && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          style={{
            alignSelf: "center",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 9999,
            border: "1px solid rgba(224,98,90,0.3)",
            background: "white",
            color: "var(--color-brand)",
            fontSize: 13,
            fontWeight: 500,
            cursor: removing ? "wait" : "pointer",
            opacity: removing ? 0.6 : 1,
          }}
        >
          {removing ? (
            <LoaderCircle size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
          {removing ? "Suppression…" : "Supprimer la photo"}
        </button>
      )}
    </div>
  );
}
