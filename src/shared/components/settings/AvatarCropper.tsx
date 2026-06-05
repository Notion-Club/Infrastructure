"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { LoaderCircle, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

// Taille de sortie de l'image cropée. 512px est un bon compromis qualité/poids
// pour un avatar affiché en 124px max (retina 2x = 248px) avec marge.
const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type AvatarCropperProps = {
  // Source : un blob URL ou data URL généré côté client à partir du File.
  imageSrc: string;
  // MIME type d'origine — on essaie de garder le même format en sortie.
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  // Callback déclenché quand l'user valide. Le blob est l'image cropée
  // au format `mimeType`, taille OUTPUT_SIZE × OUTPUT_SIZE.
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
  submitting?: boolean;
};

export function AvatarCropper({
  imageSrc,
  mimeType,
  onConfirm,
  onCancel,
  submitting = false,
}: AvatarCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  // Lock scroll quand le modal est ouvert.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Esc → cancel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting && !busy) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, submitting, busy]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function reset() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  async function handleConfirm() {
    if (!croppedAreaPixels || busy || submitting) return;
    setBusy(true);
    try {
      const file = await cropImageToFile({
        imageSrc,
        areaPixels: croppedAreaPixels,
        mimeType,
      });
      onConfirm(file);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recadrer la photo de profil"
      data-fb-label="Modale recadrage avatar · Section profil"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting && !busy) onCancel();
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
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--color-border-default)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            Recadrer la photo
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "var(--color-text-muted)",
            }}
          >
            Glisse l&apos;image et ajuste le zoom pour bien la cadrer.
          </p>
        </header>

        <div
          style={{
            position: "relative",
            width: "100%",
            height: 340,
            background: "#0e0e10",
          }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
          />
        </div>

        <div
          style={{
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: "1px solid var(--color-border-default)",
          }}
        >
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.1))}
            aria-label="Dézoomer"
            disabled={zoom <= MIN_ZOOM || submitting || busy}
            data-fb-label="Bouton Dézoomer · Modale recadrage avatar"
            style={iconBtnStyle(zoom <= MIN_ZOOM)}
          >
            <ZoomOut size={16} />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={submitting || busy}
            style={{
              flex: 1,
              accentColor: "var(--color-brand)",
              cursor: "pointer",
            }}
            aria-label="Zoom"
            data-fb-label="Curseur Zoom · Modale recadrage avatar"
          />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.1))}
            aria-label="Zoomer"
            disabled={zoom >= MAX_ZOOM || submitting || busy}
            data-fb-label="Bouton Zoomer · Modale recadrage avatar"
            style={iconBtnStyle(zoom >= MAX_ZOOM)}
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="Réinitialiser le cadrage"
            disabled={submitting || busy}
            data-fb-label="Bouton Réinitialiser cadrage · Modale recadrage avatar"
            style={iconBtnStyle(false)}
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <footer
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "14px 20px",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting || busy}
            data-fb-label="Bouton Annuler · Modale recadrage avatar"
            style={{
              padding: "9px 18px",
              borderRadius: 9999,
              border: "1px solid var(--color-border-default)",
              background: "var(--color-surface-card)",
              color: "var(--color-text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: submitting || busy ? "not-allowed" : "pointer",
              opacity: submitting || busy ? 0.6 : 1,
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || busy || !croppedAreaPixels}
            data-fb-label="Bouton Valider · Modale recadrage avatar"
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
              cursor:
                submitting || busy || !croppedAreaPixels
                  ? "not-allowed"
                  : "pointer",
              opacity: submitting || busy || !croppedAreaPixels ? 0.6 : 1,
              boxShadow: "0 6px 18px -8px rgba(224,98,90,0.55)",
            }}
          >
            {(submitting || busy) && (
              <LoaderCircle size={14} className="animate-spin" />
            )}
            {submitting ? "Envoi…" : busy ? "Recadrage…" : "Valider"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid var(--color-border-default)",
    background: "var(--color-surface-card)",
    color: "var(--color-text-secondary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
  };
}

// ============================================================================
// cropImageToFile — extrait le crop carré via canvas et retourne un File
// ============================================================================
async function cropImageToFile({
  imageSrc,
  areaPixels,
  mimeType,
}: {
  imageSrc: string;
  areaPixels: Area;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
}): Promise<File> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de créer le contexte canvas.");

  // PNG et WebP supportent la transparence ; JPEG non. Pour JPEG on remplit
  // d'un fond blanc avant de dessiner pour éviter du noir résiduel si
  // l'image source a un alpha.
  if (mimeType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  }

  ctx.drawImage(
    image,
    areaPixels.x,
    areaPixels.y,
    areaPixels.width,
    areaPixels.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      mimeType,
      mimeType === "image/jpeg" ? 0.92 : undefined,
    );
  });

  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return new File([blob], `avatar.${ext}`, { type: mimeType });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}
