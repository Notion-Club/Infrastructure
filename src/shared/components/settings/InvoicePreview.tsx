// Aperçu de facture (décoratif) affiché à droite du bouton « Voir mes
// paiements ». Reprend le design system de la facture du projet sales-invoice
// (papier blanc, en-tête logo + « Facture », parties Émetteur/Client, tableau,
// totaux). Les valeurs autrefois remplies par des inputs (numéro, dates, client,
// montants) sont remplacées par des barres de skeleton.

const PAPER = "#ffffff";
const INK = "#010101";
const MUTED = "#9a9a9a";
const LINE = "#ece8e8";
const INVOICE_LOGO =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1776642089/Notion_Club_-_Black_-_White_BG_ypuv2a.png";

// Barre de skeleton « papier » (gris clair pulsé) pour les valeurs dynamiques.
function Skel({
  w,
  h = 8,
}: {
  w: number | string;
  h?: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: w,
        height: h,
        borderRadius: 3,
        background: LINE,
        animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
      }}
    />
  );
}

export function InvoicePreview() {
  return (
    <div
      aria-hidden
      style={{
        width: 260,
        flexShrink: 0,
        background: PAPER,
        color: INK,
        borderRadius: 12,
        border: "1px solid rgba(1,1,1,0.06)",
        boxShadow:
          "0 1px 2px rgba(1,1,1,.04), 0 8px 20px rgba(1,1,1,.10)",
        padding: "16px 18px",
        fontFamily:
          "-apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* En-tête : logo + « Facture » + n° (skeleton) | dates (skeleton) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingBottom: 10,
          borderBottom: `1px solid ${LINE}`,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={INVOICE_LOGO}
            alt=""
            style={{ height: 18, width: "auto", display: "block" }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Facture
            </span>
            <Skel w={52} h={6} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
          <Skel w={44} h={6} />
          <Skel w={36} h={6} />
        </div>
      </div>

      {/* Parties : Émetteur (statique) | Client (skeleton) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 8,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: MUTED,
              marginBottom: 4,
            }}
          >
            Émetteur
          </div>
          <div style={{ fontSize: 10, fontWeight: 600 }}>Gouman Operates</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
            <Skel w="80%" h={5} />
            <Skel w="60%" h={5} />
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 8,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: MUTED,
              marginBottom: 4,
            }}
          >
            Client
          </div>
          <Skel w="70%" h={7} />
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 5 }}>
            <Skel w="85%" h={5} />
            <Skel w="55%" h={5} />
          </div>
        </div>
      </div>

      {/* Tableau : en-tête + une ligne (description statique, montant skeleton) */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            gap: 10,
            fontSize: 8,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: MUTED,
            paddingBottom: 6,
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <span>Description</span>
          <span>TVA</span>
          <span style={{ textAlign: "right" }}>Total HT</span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            gap: 10,
            alignItems: "center",
            fontSize: 10,
            padding: "7px 0",
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <span>Formation Notion Club</span>
          <span>20 %</span>
          <span style={{ textAlign: "right" }}>
            <Skel w={32} h={6} />
          </span>
        </div>
      </div>

      {/* Totaux : valeurs en skeleton */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
        <div style={{ display: "flex", gap: 28, fontSize: 9, color: MUTED, alignItems: "center" }}>
          <span>Total HT</span>
          <Skel w={40} h={6} />
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 9, color: MUTED, alignItems: "center" }}>
          <span>TVA 20 %</span>
          <Skel w={40} h={6} />
        </div>
        <div
          style={{
            display: "flex",
            gap: 28,
            alignItems: "center",
            fontSize: 11,
            fontWeight: 700,
            paddingTop: 6,
            borderTop: `1px solid ${LINE}`,
            marginTop: 2,
          }}
        >
          <span>Total TTC</span>
          <Skel w={48} h={8} />
        </div>
      </div>
    </div>
  );
}
