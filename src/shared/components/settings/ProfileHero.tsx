"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import {
  AVATAR_ALLOWED_MIME,
  AVATAR_MAX_BYTES,
  isAllowedAvatarMime,
  uploadAvatarAction,
} from "@/modules/settings";
import { AvatarCropper } from "./AvatarCropper";

type SourceImage = {
  url: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

function getInitials(displayName: string | null, email: string): string {
  const source = (displayName ?? email).trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function colorFromName(seed: string): string {
  const palette = [
    "#e0625a",
    "#5b8def",
    "#8a6cf2",
    "#27ae8e",
    "#ed9d3a",
    "#c97c97",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length]!;
}

type ProfileHeroProps = {
  avatarUrl: string | null;
  displayName: string | null;
  email: string;
  isMocked: boolean;
  onAvatarChange: (url: string) => void;
};

export function ProfileHero({
  avatarUrl,
  displayName,
  email,
  isMocked,
  onAvatarChange,
}: ProfileHeroProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null);

  const effectiveAvatar = previewUrl ?? avatarUrl;
  const initials = getInitials(displayName, email);
  const bg = colorFromName(displayName ?? email);

  // Cleanup du blob URL quand le cropper se ferme — sinon fuite mémoire.
  useEffect(() => {
    return () => {
      if (sourceImage?.url.startsWith("blob:")) {
        URL.revokeObjectURL(sourceImage.url);
      }
    };
  }, [sourceImage]);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isMocked) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = typeof ev.target?.result === "string" ? ev.target.result : null;
        if (data) {
          setPreviewUrl(data);
          onAvatarChange(data);
          toast.info("Aperçu local — connectez-vous pour enregistrer.");
        }
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Pré-validation côté client pour feedback immédiat (le serveur revérifie
    // dans tous les cas, c'est juste pour éviter un round-trip inutile).
    if (!isAllowedAvatarMime(file.type)) {
      toast.error(
        `Format non supporté. Utilise ${AVATAR_ALLOWED_MIME.join(", ")}.`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(
        `Le fichier dépasse ${Math.round(AVATAR_MAX_BYTES / 1024 / 1024)} MB.`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Ouvre le cropper avec l'image source. L'upload arrive après validation.
    const url = URL.createObjectURL(file);
    setSourceImage({ url, mimeType: file.type });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCropConfirm(croppedFile: File) {
    if (!sourceImage) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", croppedFile);
      const result = await uploadAvatarAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onAvatarChange(result.publicUrl);
      toast.success("Photo de profil mise à jour");
      closeCropper();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erreur lors de l'envoi de la photo";
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: "8px 0 12px",
      }}
    >
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Modifier la photo de profil"
        disabled={uploading}
        style={{
          position: "relative",
          width: 124,
          height: 124,
          borderRadius: "50%",
          border: "none",
          padding: 0,
          cursor: uploading ? "wait" : "pointer",
          background: "transparent",
          flexShrink: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: "50%",
            background:
              "conic-gradient(from 0deg, rgba(224,98,90,0.0), rgba(224,98,90,0.55) 35%, rgba(224,98,90,0.0) 65%)",
            filter: "blur(10px)",
            opacity: 0.7,
            pointerEvents: "none",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: effectiveAvatar ? "transparent" : bg,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: "0.02em",
            border: "4px solid white",
            boxShadow: "0 14px 32px -10px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          {effectiveAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={effectiveAvatar}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials
          )}
        </span>
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: 4,
            bottom: 4,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--color-brand)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "3px solid white",
            boxShadow: "0 6px 16px -4px rgba(224,98,90,0.45)",
          }}
        >
          {uploading ? (
            <LoaderCircle size={14} className="animate-spin" />
          ) : (
            <Camera size={14} />
          )}
        </span>
      </button>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          {displayName?.trim() || email}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text-muted)",
          }}
        >
          {email}
        </p>
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{
          padding: "6px 14px",
          borderRadius: 9999,
          border: "1px solid var(--color-border-default)",
          background: "white",
          color: "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: 500,
          cursor: uploading ? "wait" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          transition: "background 150ms ease",
        }}
        className="hover:bg-[var(--color-surface-raised)]"
      >
        {uploading ? (
          <LoaderCircle size={12} className="animate-spin" />
        ) : (
          <Camera size={12} />
        )}
        {uploading ? "Envoi…" : "Modifier la photo"}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      {sourceImage && (
        <AvatarCropper
          imageSrc={sourceImage.url}
          mimeType={sourceImage.mimeType}
          onConfirm={handleCropConfirm}
          onCancel={closeCropper}
          submitting={uploading}
        />
      )}
    </div>
  );
}
