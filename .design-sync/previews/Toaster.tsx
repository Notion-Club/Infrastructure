import { Toaster } from "notionclub-infra";
import {
  CircleCheckIcon,
  InfoIcon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";

// Le Toaster sonner rend ses toasts dans un portal attaché au <body>, hors du
// cadre de la carte de preview — il apparaît donc vide ici. On rend le vrai
// <Toaster/> (pour la config DS) ET une réplique statique d'un toast, stylée
// avec exactement les tokens passés à sonner (surface, border, radius 14px,
// nc-shadow-2), afin de montrer le rendu réel des 4 variantes.

function MockToast({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        width: 360,
        background: "white",
        border: "1px solid var(--color-border-default)",
        borderRadius: 14,
        boxShadow: "var(--nc-shadow-2)",
        padding: "14px 16px",
        fontSize: 14,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
          {title}
        </span>
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          {description}
        </span>
      </div>
    </div>
  );
}

export const SuccessAndError = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <Toaster />
    <MockToast
      icon={<CircleCheckIcon className="size-4" style={{ color: "#16a34a" }} />}
      title="Profil enregistré"
      description="Vos modifications ont bien été prises en compte."
    />
    <MockToast
      icon={<OctagonXIcon className="size-4" style={{ color: "var(--color-brand)" }} />}
      title="Échec de l'envoi"
      description="Vérifiez votre connexion et réessayez."
    />
  </div>
);

export const InfoAndWarning = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <Toaster />
    <MockToast
      icon={
        <InfoIcon
          className="size-4"
          style={{ color: "var(--color-text-secondary)" }}
        />
      }
      title="Nouvel appel de coaching planifié"
      description="Jeudi 19 juin à 18h00."
    />
    <MockToast
      icon={<TriangleAlertIcon className="size-4" style={{ color: "#d97706" }} />}
      title="Pensez à confirmer votre e-mail"
      description="Un lien vous a été envoyé."
    />
  </div>
);
