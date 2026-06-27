"use client";

import {
  forwardRef,
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
  Palette,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import dynamic from "next/dynamic";

import { Trash } from "@/shared/components/icons";

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
// Chargé à la demande : le cropper n'apparaît qu'après sélection d'un fichier,
// et il embarque `react-easy-crop` (lib lourde). En `dynamic` (ssr:false), ce
// chunk ne part plus dans le bundle initial de la page Réglages — il n'est
// téléchargé que lorsque l'utilisateur ouvre réellement le recadrage.
const AvatarCropper = dynamic(
  () => import("./AvatarCropper").then((m) => m.AvatarCropper),
  { ssr: false },
);

type SourceImage = {
  url: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

type AvatarPickerProps = {
  currentColor: string | null; // null = couleur brand par défaut
  currentAvatarUrl: string | null;
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
  currentAvatarUrl,
  hasPhoto,
  initials,
  isMocked,
  onClose,
  onAvatarUpdated,
}: AvatarPickerProps) {
  const [selectedColor, setSelectedColor] = useState<AvatarColor>(
    (currentColor as AvatarColor | null) ?? DEFAULT_AVATAR_COLOR,
  );
  const [savingColor, setSavingColor] = useState(false);
  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [colorPopupOpen, setColorPopupOpen] = useState(false);

  const colorPopupRef = useRef<HTMLDivElement>(null);
  const colorTriggerRef = useRef<HTMLButtonElement>(null);

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
        if (colorPopupOpen) {
          setColorPopupOpen(false);
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, savingColor, uploading, removing, colorPopupOpen]);

  // Cleanup blob URL si on quitte le picker avec une image en attente
  useEffect(() => {
    return () => {
      if (sourceImage?.url.startsWith("blob:")) {
        URL.revokeObjectURL(sourceImage.url);
      }
    };
  }, [sourceImage]);

  // Fermer le popup couleur si clic en dehors
  useEffect(() => {
    if (!colorPopupOpen) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        colorPopupRef.current &&
        !colorPopupRef.current.contains(target) &&
        colorTriggerRef.current &&
        !colorTriggerRef.current.contains(target)
      ) {
        setColorPopupOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [colorPopupOpen]);

  const colorChanged = selectedColor !== (currentColor ?? DEFAULT_AVATAR_COLOR);

  async function handleSaveColor() {
    if (!colorChanged || savingColor) return;
    setSavingColor(true);
    try {
      if (isMocked) {
        toast.success("Couleur mise à jour (démo)");
        onAvatarUpdated({ avatarColor: selectedColor });
        setColorPopupOpen(false);
        return;
      }
      const result = await updateAvatarColorAction({ color: selectedColor });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Couleur mise à jour");
      onAvatarUpdated({ avatarColor: selectedColor });
      setColorPopupOpen(false);
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
        toast.info("Aperçu local. Connecte-toi pour enregistrer.");
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
        toast.info("Suppression simulée (démo).");
        onAvatarUpdated({ avatarUrl: null });
        return;
      }
      const result = await removeAvatarAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Photo supprimée");
      onAvatarUpdated({ avatarUrl: null });
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
        data-fb-label="Modale sélecteur avatar · Section profil"
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
          // 210 : au-dessus de l'éditeur de profil (#128, z-index 200) d'où il
          // peut être ouvert, tout en restant top-most partout ailleurs.
          zIndex: 210,
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
            background: "var(--color-surface-card)",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 24px 48px -12px rgba(0,0,0,0.35)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <header
            style={{
              padding: "18px 20px 16px",
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
                margin: "4px 0 0",
                fontSize: 13,
                color: "var(--color-text-muted)",
                lineHeight: 1.4,
              }}
            >
              Ajoute une photo, ou survole l&apos;avatar pour changer la couleur
              de fond.
            </p>
          </header>

          <div
            style={{
              padding: "22px 20px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {/* Preview de l'avatar : photo si elle existe, sinon initiales
                sur fond coloré. Au hover, un bouton "Couleur" s'affiche
                par-dessus et déclenche le popup palette. */}
            <AvatarPreview
              avatarUrl={currentAvatarUrl}
              color={selectedColor}
              initials={initials}
              colorTriggerRef={colorTriggerRef}
              onOpenColorPopup={() => setColorPopupOpen((o) => !o)}
              colorPopupOpen={colorPopupOpen}
            />

            {colorPopupOpen && (
              <ColorPopup
                ref={colorPopupRef}
                selected={selectedColor}
                onSelect={setSelectedColor}
                onSave={handleSaveColor}
                onCancel={() => {
                  setSelectedColor(
                    (currentColor as AvatarColor | null) ??
                      DEFAULT_AVATAR_COLOR,
                  );
                  setColorPopupOpen(false);
                }}
                saving={savingColor}
                canSave={colorChanged}
              />
            )}

            {/* Drop zone — le user a explicitement demandé qu'on favorise
                l'insertion de photo, donc elle prend la moitié inférieure
                du modal sans tab à choisir d'abord. */}
            <PhotoDropZone onFile={ingestFile} />

            {hasPhoto && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={removing}
                data-fb-label="Bouton Supprimer la photo · Modale sélecteur avatar"
                style={{
                  alignSelf: "center",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 9999,
                  border: "1px solid rgba(224,98,90,0.3)",
                  background: "var(--color-surface-card)",
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
                  <Trash size={14} />
                )}
                {removing ? "Suppression…" : "Supprimer la photo"}
              </button>
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
              data-fb-label="Bouton Fermer · Modale sélecteur avatar"
              style={{
                padding: "9px 18px",
                borderRadius: 9999,
                border: "1px solid var(--color-border-default)",
                background: "var(--color-surface-card)",
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
              Fermer
            </button>
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
// AvatarPreview — gros aperçu en haut du modal, avec hover qui révèle un
// bouton "Couleur" pour ouvrir le popup palette par-dessus la fenêtre.
// ============================================================================
function AvatarPreview({
  avatarUrl,
  color,
  initials,
  colorTriggerRef,
  onOpenColorPopup,
  colorPopupOpen,
}: {
  avatarUrl: string | null;
  color: AvatarColor;
  initials: string;
  colorTriggerRef: React.RefObject<HTMLButtonElement | null>;
  onOpenColorPopup: () => void;
  colorPopupOpen: boolean;
}) {
  const [hovering, setHovering] = useState(false);
  const showOverlay = hovering || colorPopupOpen;

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        style={{
          position: "relative",
          width: 124,
          height: 124,
          borderRadius: "50%",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: avatarUrl ? "transparent" : color,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: "0.02em",
            border: "4px solid white",
            boxShadow:
              "0 14px 32px -10px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.06)",
            overflow: "hidden",
            transition: "background 200ms ease",
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials
          )}
        </div>
        {/* Overlay "Couleur" visible au hover ou quand le popup est ouvert */}
        <button
          ref={colorTriggerRef}
          type="button"
          onClick={onOpenColorPopup}
          aria-label="Changer la couleur de fond"
          aria-expanded={colorPopupOpen}
          data-fb-label="Bouton Couleur · Modale sélecteur avatar"
          style={{
            position: "absolute",
            inset: 4,
            borderRadius: "50%",
            border: "none",
            background: showOverlay ? "rgba(0,0,0,0.45)" : "transparent",
            color: "white",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            cursor: "pointer",
            opacity: showOverlay ? 1 : 0,
            transition: "opacity 180ms ease, background 180ms ease",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.02em",
            padding: 0,
          }}
        >
          <Palette size={20} />
          Couleur
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ColorPopup — popup compact qui se superpose à la fenêtre, avec la palette
// et un bouton pour enregistrer la couleur sélectionnée.
// ============================================================================
type ColorPopupProps = {
  selected: AvatarColor;
  onSelect: (color: AvatarColor) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  canSave: boolean;
};

const ColorPopup = forwardRef<HTMLDivElement, ColorPopupProps>(
  function ColorPopup(
    { selected, onSelect, onSave, onCancel, saving, canSave },
    ref,
  ) {
    return (
      <div
        ref={ref}
        role="dialog"
        aria-label="Choix de la couleur d'avatar"
        style={{
          padding: 14,
          borderRadius: 14,
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-default)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          role="radiogroup"
          aria-label="Couleur d'avatar"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: 10,
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
                data-fb-label="Pastille couleur · Modale sélecteur avatar"
                onClick={() => onSelect(color)}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: "50%",
                  background: color,
                  border: active
                    ? "3px solid var(--color-text-primary)"
                    : "2px solid white",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  transition: "transform 150ms ease, border-color 150ms ease",
                  transform: active ? "scale(1.08)" : "scale(1)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                }}
              >
                {active && <Check size={14} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            data-fb-label="Bouton Annuler couleur · Modale sélecteur avatar"
            style={{
              padding: "7px 14px",
              borderRadius: 9999,
              border: "1px solid var(--color-border-default)",
              background: "var(--color-surface-card)",
              color: "var(--color-text-secondary)",
              fontSize: 12,
              fontWeight: 500,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || saving}
            data-fb-label="Bouton Appliquer couleur · Modale sélecteur avatar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 9999,
              border: "none",
              background: "var(--color-brand)",
              color: "white",
              fontSize: 12,
              fontWeight: 600,
              cursor: canSave && !saving ? "pointer" : "not-allowed",
              opacity: canSave && !saving ? 1 : 0.55,
              boxShadow: "0 6px 18px -8px rgba(224,98,90,0.55)",
            }}
          >
            {saving && <LoaderCircle size={12} className="animate-spin" />}
            {saving ? "Enregistrement…" : "Appliquer la couleur"}
          </button>
        </div>
      </div>
    );
  },
);

// ============================================================================
// PhotoDropZone — zone drop & click & paste, en vedette dans le nouveau layout.
// ============================================================================
function PhotoDropZone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Paste listener au niveau du document (dropZone focus pas garanti).
  // Capture Cmd/Ctrl+V tant que le modal est ouvert.
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
    <>
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
        data-fb-label="Zone de dépôt photo · Modale sélecteur avatar"
        style={{
          border: `2px dashed ${isDragging ? "var(--color-brand)" : "var(--color-border-default)"}`,
          background: isDragging
            ? "rgba(224,98,90,0.06)"
            : "var(--color-surface-raised)",
          borderRadius: 16,
          padding: "28px 20px",
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
            : "Glisse une photo ici ou clique pour parcourir"}
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
          PNG, JPEG, WebP · {Math.round(AVATAR_MAX_BYTES / 1024 / 1024)} MB max
          <br />
          Tu peux aussi coller une image avec ⌘V
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        // OPS-65 — `accept="image/*"` au lieu d'une liste MIME stricte.
        // Sur macOS, une liste accept restrictive (image/png, image/jpeg,
        // image/webp) ralentit l'ouverture du NSOpenPanel car le système
        // doit filtrer chaque fichier individuellement avant d'afficher la
        // boîte de dialogue (curseur "moulinant" perçu par l'utilisateur).
        // Avec `image/*` le picker s'ouvre en mode natif rapide. La
        // validation stricte des MIME (PNG / JPEG / WebP uniquement) reste
        // intégralement faite par `ingestFile` côté JS : si un fichier
        // sélectionné n'est pas dans `AVATAR_ALLOWED_MIME`, on toast une
        // erreur et on n'ouvre pas le cropper.
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
    </>
  );
}
