// Helpers partagés entre la modale Paiements (tableau) et la modale d'aperçu de
// facture. Extraits de PaymentsModal pour éviter la duplication (type, styles de
// statut, formatage EUR / date).

export type Payment = {
  notionId: string;
  label: string;
  amount: number | null;
  amountHt?: number | null;
  paymentDate: string | null;
  source: string | null;
  status: string | null;
  statusCategory: "paid" | "due" | "refused" | "unknown";
  invoiceUrl?: string | null;
};

export const STATUS_STYLE: Record<
  Payment["statusCategory"],
  { bg: string; fg: string; border: string }
> = {
  paid: { bg: "rgba(39,174,142,0.10)", fg: "#16805f", border: "rgba(39,174,142,0.25)" },
  due: { bg: "rgba(91,141,239,0.10)", fg: "#2d5bb3", border: "rgba(91,141,239,0.25)" },
  refused: { bg: "rgba(224,98,90,0.10)", fg: "#b3433b", border: "rgba(224,98,90,0.25)" },
  unknown: { bg: "rgba(82,82,91,0.08)", fg: "#52525b", border: "rgba(82,82,91,0.20)" },
};

export function formatEur(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return amount.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// Nom unique de view-transition pour morpher une ligne de paiement vers le
// panneau d'aperçu (cf. heroTransition.ts côté ressources).
export const invoiceVtName = (notionId: string): string => `nc-invoice-${notionId}`;
