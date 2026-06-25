"use client";

import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CircleDot,
  Download,
  Euro,
  FileText,
  Percent,
  ReceiptEuro,
  Tag,
  X,
} from "lucide-react";

import { ArrowReturn } from "@/shared/components/icons";

import { InvoicePreview } from "./InvoicePreview";
import {
  type Payment,
  STATUS_STYLE,
  formatDate,
  formatEur,
} from "./paymentsShared";

// Détail d'une facture — page 2 de la modale Paiements (PAS un pop-up au-dessus).
// Composition demandée :
//   1. l'aperçu « papier » de la facture, en haut centré, dont le bas se fond en
//      flou (dégradé à partir de la ligne Description/TVA/HT) dans la surface ;
//   2. en-dessous, les propriétés du paiement en disposition « page Notion »
//      (icône + libellé à gauche, valeur à droite) ;
//   3. un pied avec Ouvrir / Télécharger.
// Aucune info Notion dans une en-tête : seuls la flèche retour et la croix
// flottent en haut, sur la même surface que l'aperçu (pas de bande séparée).

function PropRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="nc-invoice-prop">
      <span className="nc-invoice-prop__key">
        {icon}
        {label}
      </span>
      <span className="nc-invoice-prop__val">{children}</span>
    </div>
  );
}

export function InvoiceDetail({
  payment,
  onBack,
  onClose,
}: {
  payment: Payment | null;
  onBack: () => void;
  onClose: () => void;
}) {
  // Page 2 reste montée pour la mesure de hauteur même sans facture : on rend
  // alors un placeholder minimal.
  if (!payment) return <div style={{ minHeight: 1 }} />;

  const href = `/api/payments/invoice/${payment.notionId}`;
  const hasInvoice = Boolean(payment.invoiceUrl);
  const s = STATUS_STYLE[payment.statusCategory];
  const tva =
    payment.amount != null && payment.amountHt != null
      ? payment.amount - payment.amountHt
      : null;

  return (
    <div className="nc-invoice-detail">
      {/* Contrôles flottants — pas d'en-tête à info, pas de séparateur. */}
      <div className="nc-invoice-topbar">
        <button
          type="button"
          onClick={onBack}
          className="nc-modal-icon-btn"
          aria-label="Retour aux paiements"
          data-fb-label="Retour · Détail facture"
        >
          <ArrowReturn size={16} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="nc-modal-icon-btn"
          aria-label="Fermer"
          data-fb-label="Fermer · Détail facture"
        >
          <X size={16} />
        </button>
      </div>

      {/* 1. Aperçu papier — le bas se fond en flou dans la surface du panneau. */}
      <div className="nc-invoice-hero">
        <div className="nc-invoice-hero__paper">
          <InvoicePreview
            decorative={false}
            description={payment.label}
            date={formatDate(payment.paymentDate)}
            amountHt={payment.amountHt ?? null}
            amountTtc={payment.amount}
          />
        </div>
        <div className="nc-invoice-hero__veil" aria-hidden />
      </div>

      {/* 2. Propriétés du paiement — disposition « page Notion ». */}
      <div className="nc-invoice-props">
        <PropRow icon={<FileText size={15} />} label="Intitulé">
          {payment.label || "Paiement"}
        </PropRow>
        <PropRow icon={<ReceiptEuro size={15} />} label="Montant TTC">
          {formatEur(payment.amount)}
        </PropRow>
        <PropRow icon={<Euro size={15} />} label="Montant HT">
          {formatEur(payment.amountHt)}
        </PropRow>
        <PropRow icon={<Percent size={15} />} label="TVA (20 %)">
          {formatEur(tva)}
        </PropRow>
        <PropRow icon={<CalendarDays size={15} />} label="Date de paiement">
          {formatDate(payment.paymentDate)}
        </PropRow>
        <PropRow icon={<CircleDot size={15} />} label="Statut">
          {payment.status ? (
            <span
              className="nc-invoice-status"
              style={{ color: s.fg, background: s.bg, border: `1px solid ${s.border}` }}
            >
              {payment.status}
            </span>
          ) : (
            "—"
          )}
        </PropRow>
        {payment.source && (
          <PropRow icon={<Tag size={15} />} label="Source">
            {payment.source}
          </PropRow>
        )}
      </div>

      {/* 3. Actions. */}
      <div className="nc-invoice-foot">
        {hasInvoice ? (
          <>
            <a
              className="nc-invoice-open nc-modal-btn"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              data-fb-label="Ouvrir facture · Détail facture"
            >
              <ArrowUpRight size={15} />
              Ouvrir
            </a>
            <a
              className="nc-invoice-download"
              href={`${href}?download=1`}
              data-fb-label="Télécharger facture · Détail facture"
            >
              <Download size={15} />
              Télécharger
            </a>
          </>
        ) : (
          <span className="nc-invoice-unavailable">
            Facture indisponible pour ce paiement.
          </span>
        )}
      </div>
    </div>
  );
}
