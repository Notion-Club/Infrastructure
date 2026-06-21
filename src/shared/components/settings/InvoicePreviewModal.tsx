"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Download, X } from "lucide-react";

import { InvoicePreview } from "./InvoicePreview";
import {
  type Payment,
  STATUS_STYLE,
  formatDate,
  formatEur,
} from "./paymentsShared";

// Modale d'aperçu d'une facture — ouverte au clic sur une ligne de paiement.
// Affiche l'aperçu « papier » premium (InvoicePreview rempli avec les vraies
// données) + les métadonnées du paiement + un bouton de téléchargement.
//
// La facture transite par la route applicative /api/payments/invoice/[id]
// (auth + ownership + URL Notion re-résolue à chaque requête, jamais exposée).
//   - aperçu / ouverture : …/invoice/{id}
//   - téléchargement     : …/invoice/{id}?download=1

export function InvoicePreviewModal({
  payment,
  onClose,
}: {
  payment: Payment | null;
  onClose: () => void;
}) {
  // Escape ferme l'aperçu (le lock scroll est déjà posé par la modale parente).
  useEffect(() => {
    if (!payment) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [payment, onClose]);

  if (!payment) return null;

  const href = `/api/payments/invoice/${payment.notionId}`;
  const hasInvoice = Boolean(payment.invoiceUrl);
  const s = STATUS_STYLE[payment.statusCategory];

  return createPortal(
    <div
      className="nc-modal-overlay nc-invoice-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Facture — ${payment.label || "Paiement"}`}
    >
      <div
        className="nc-modal-card nc-invoice-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header : libellé + statut + montant/date | fermeture */}
        <div className="nc-invoice-modal-head">
          <div style={{ minWidth: 0 }}>
            <div className="nc-invoice-modal-title" title={payment.label}>
              {payment.label || "Paiement"}
            </div>
            <div className="nc-invoice-modal-sub">
              <span>{formatEur(payment.amount)}</span>
              <span aria-hidden>·</span>
              <span>{formatDate(payment.paymentDate)}</span>
              {payment.status && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 8px",
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 600,
                    color: s.fg,
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {payment.status}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'aperçu"
            data-fb-label="Fermer · Aperçu facture"
            className="nc-invoice-modal-close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corps : l'aperçu papier rempli, posé sur une « surface bureau ». */}
        <div className="nc-invoice-stage">
          <div className="nc-invoice-paper">
            <InvoicePreview
              decorative={false}
              description={payment.label}
              date={formatDate(payment.paymentDate)}
              amountHt={payment.amountHt ?? null}
              amountTtc={payment.amount}
            />
          </div>
        </div>

        {/* Pied : ouvrir (onglet) + télécharger. */}
        <div className="nc-invoice-modal-foot">
          {hasInvoice ? (
            <>
              <a
                className="nc-invoice-open"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                data-fb-label="Ouvrir facture · Aperçu facture"
              >
                <ArrowUpRight size={15} />
                Ouvrir
              </a>
              <a
                className="nc-invoice-download"
                href={`${href}?download=1`}
                data-fb-label="Télécharger facture · Aperçu facture"
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
    </div>,
    document.body,
  );
}
