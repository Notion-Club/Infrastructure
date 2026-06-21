"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Download, X } from "lucide-react";

import { InvoiceDetail } from "./InvoiceDetail";
import {
  type Payment,
  STATUS_STYLE,
  formatDate,
  formatEur,
} from "./paymentsShared";

// Modale « Mes paiements » — contenu chargé depuis GET /api/payments/me
// (base Notion « Paiements »). Titre animé (shimmer pendant le chargement,
// puis flip vers un titre statique), tableau responsive + skeleton.
//
// Navigation INTERNE (pas de pop-up au-dessus d'un pop-up) : clic sur une ligne
// → la même carte glisse de la liste (page 1) vers le détail de la facture
// (page 2, InvoiceDetail) via le pattern transitions.dev « page side-by-side »,
// et la carte se redimensionne (largeur + hauteur animées). L'état est porté par
// le param d'URL `?invoice={notionId}` (deep-link + bouton retour natif).

// Largeurs de la carte selon la page affichée (px ; bornées à 92vw en mobile).
const CARD_W_LIST = 680;
const CARD_W_DETAIL = 480;

// Lit l'ID de facture courant dans l'URL (?invoice=…). null hors navigateur.
function readInvoiceParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("invoice");
}

const TITLE_LOADING = "Nous cherchons tes paiements";
const TITLE_DONE = "Tes paiements au Notion Club";

// Titre animé : shimmer pendant le chargement, puis flip (text-swap) vers le
// titre statique une fois les paiements chargés. Réutilise .t-text-swap +
// .t-shimmer (cf. transcript coaching).
function PaymentsTitle({ loading }: { loading: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<boolean | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const setText = (t: string) => {
      el.textContent = t;
      el.setAttribute("data-text", t);
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Initialisation au montage.
    if (prev.current === null) {
      setText(loading ? TITLE_LOADING : TITLE_DONE);
      el.classList.toggle("t-shimmer", loading);
      prev.current = loading;
      return;
    }
    if (prev.current === loading) return;
    prev.current = loading;

    if (loading) {
      setText(TITLE_LOADING);
      el.classList.add("t-shimmer");
      return;
    }

    // Chargement terminé → flip vers le titre statique, arrêt du shimmer.
    if (reduce) {
      setText(TITLE_DONE);
      el.classList.remove("t-shimmer");
      return;
    }
    el.classList.add("is-exit");
    const t = window.setTimeout(() => {
      setText(TITLE_DONE);
      el.classList.remove("t-shimmer");
      el.classList.add("is-enter-start");
      void el.offsetWidth;
      el.classList.remove("is-enter-start");
    }, 160);
    return () => window.clearTimeout(t);
  }, [loading]);

  return (
    <span
      ref={ref}
      className="t-text-swap nc-payments-title"
      data-text=""
      aria-live="polite"
    />
  );
}

function StatusBadge({ p }: { p: Payment }) {
  if (!p.status) return null;
  const s = STATUS_STYLE[p.statusCategory];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 9px",
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {p.status}
    </span>
  );
}

// Téléchargement direct (action secondaire) — transite par la route proxy
// /api/payments/invoice/[id]?download=1 (jamais l'URL Notion brute, cf. #132).
// stopPropagation : un clic sur le download n'ouvre pas l'aperçu de la ligne.
function DownloadButton({ payment }: { payment: Payment }) {
  if (payment.invoiceUrl) {
    return (
      <a
        className="nc-pay-dl-btn"
        href={`/api/payments/invoice/${payment.notionId}?download=1`}
        title="Télécharger la facture"
        aria-label="Télécharger la facture"
        data-fb-label="Bouton Télécharger facture · Modale paiements"
        onClick={(e) => e.stopPropagation()}
      >
        <Download size={15} />
      </a>
    );
  }
  return (
    <span
      className="nc-pay-dl-btn"
      aria-disabled="true"
      title="Facture indisponible"
      aria-label="Facture indisponible"
    >
      <Download size={15} />
    </span>
  );
}

function PaymentsSkeleton() {
  return (
    <div className="nc-pay-table" aria-hidden>
      <div className="nc-pay-head">
        <span>Titre</span>
        <span>Date</span>
        <span>Statut</span>
        <span style={{ textAlign: "right" }}>Montant TTC</span>
        <span />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div className="nc-pay-row" key={i}>
          <span className="nc-pay-c-title">
            <span
              className="nc-skeleton"
              style={{ display: "block", height: 12, width: "70%", borderRadius: 6 }}
            />
          </span>
          <span className="nc-pay-c-date">
            <span
              className="nc-skeleton"
              style={{ display: "block", height: 10, width: 64, borderRadius: 6 }}
            />
          </span>
          <span className="nc-pay-c-meta">
            <span
              className="nc-skeleton"
              style={{ display: "block", height: 18, width: 64, borderRadius: 9999 }}
            />
          </span>
          <span className="nc-pay-c-amount">
            <span
              className="nc-skeleton"
              style={{ display: "inline-block", height: 12, width: 60, borderRadius: 6 }}
            />
          </span>
          <span className="nc-pay-c-dl">
            <span
              className="nc-skeleton"
              style={{ display: "block", height: 32, width: 32, borderRadius: 8 }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

export function PaymentsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // ID Notion de la facture dont l'aperçu est ouvert (miroir de ?invoice=).
  const [previewId, setPreviewId] = useState<string | null>(null);
  // Vrai si c'est NOUS qui avons poussé l'entrée d'historique (clic), pour
  // savoir si fermer = back() natif (notre push) ou replaceState (deep-link).
  const didPushRef = useRef(false);

  // Slide liste ↔ détail (transitions.dev) + hauteur animée sur la page active.
  const page1Ref = useRef<HTMLElement>(null);
  const page2Ref = useRef<HTMLElement>(null);
  const [slideHeight, setSlideHeight] = useState<number | undefined>(undefined);
  // Facture rendue en page 2 — conservée pendant l'animation de sortie (la carte
  // glisse vers la liste) pour ne pas vider le détail en plein slide.
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);

  // Synchronise previewId avec l'URL : init à l'ouverture + bouton retour natif.
  useEffect(() => {
    if (!open) return;
    const sync = () => setPreviewId(readInvoiceParam());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [open]);

  // À la fermeture totale de la modale, on nettoie un éventuel ?invoice= résiduel.
  useEffect(() => {
    if (open) return;
    didPushRef.current = false;
    if (readInvoiceParam()) {
      const url = new URL(window.location.href);
      url.searchParams.delete("invoice");
      window.history.replaceState(null, "", url);
    }
  }, [open]);

  const openPreview = useCallback((id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("invoice", id);
    window.history.pushState(null, "", url);
    didPushRef.current = true;
    setPreviewId(id);
  }, []);

  const closePreview = useCallback(() => {
    if (didPushRef.current) {
      // Notre push → on le défait : back() déclenche popstate qui remet à null.
      didPushRef.current = false;
      window.history.back();
    } else if (readInvoiceParam()) {
      const url = new URL(window.location.href);
      url.searchParams.delete("invoice");
      window.history.replaceState(null, "", url);
    }
    setPreviewId(null);
  }, []);

  // Lock scroll + Escape : sur le détail, Escape revient à la liste ; sur la
  // liste, Escape ferme la modale.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (readInvoiceParam()) closePreview();
      else onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, closePreview]);

  // Charge les paiements à chaque ouverture.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      // `await Promise.resolve()` → sort les setState du corps synchrone de
      // l'effet (règle react-hooks/set-state-in-effect du repo).
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/payments/me", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) {
            if (!cancelled) setPayments([]);
            return;
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Erreur ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setPayments(data.payments ?? []);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Impossible de charger les paiements.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Hauteur animée : la carte épouse la page active (sans saut), mesurée sur la
  // section correspondante. Recalcul quand le contenu change (chargement, page).
  useEffect(() => {
    if (!open) return;
    const el = previewId ? page2Ref.current : page1Ref.current;
    if (!el) return;
    // Borné à 86vh : au-delà, c'est le slide (overflow-y auto) qui scrolle au
    // lieu de laisser le contenu déborder de la carte.
    const update = () =>
      setSlideHeight(
        Math.min(el.offsetHeight, Math.round(window.innerHeight * 0.86)),
      );
    const raf = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [open, previewId, payments, loading, error]);

  // Garde la facture affichée en page 2 à jour quand un ?invoice= est résolu.
  // On NE remet PAS à null quand previewId disparaît : le détail reste visible
  // pendant le slide de sortie vers la liste. setState déféré (rAF) pour la
  // règle react-hooks/set-state-in-effect.
  useEffect(() => {
    const p =
      previewId && payments
        ? payments.find((x) => x.notionId === previewId) ?? null
        : null;
    if (!p) return;
    const raf = requestAnimationFrame(() => setDetailPayment(p));
    return () => cancelAnimationFrame(raf);
  }, [previewId, payments]);

  if (!open) return null;

  // Page active : détail dès qu'un ?invoice= est présent (même en cours de
  // chargement). detailPayment (state) garde la dernière facture pendant la
  // sortie pour que le slide ne se vide pas.
  const page = previewId ? 2 : 1;

  return createPortal(
    <div
      className="nc-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Mes paiements"
    >
      <div
        className="nc-modal-card nc-pay-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: page === 2 ? CARD_W_DETAIL : CARD_W_LIST,
          maxWidth: "92vw",
          transition: "width 280ms var(--nc-ease)",
        }}
      >
        {/* Slide liste ↔ détail — la hauteur épouse la page active. */}
        <div
          className="t-page-slide nc-pay-slide"
          data-page={page}
          style={{
            height: slideHeight,
            maxHeight: "86vh",
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            transition: "height 280ms var(--nc-ease)",
          }}
        >
          {/* ── Page 1 — liste des paiements ── */}
          <section ref={page1Ref} className="t-page" data-page-id="1">
            <div className="nc-pay-list__head">
              <PaymentsTitle loading={loading} />
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                data-fb-label="Fermer · Modale paiements"
                className="nc-modal-icon-btn"
              >
                <X size={16} />
              </button>
            </div>

            <div className="nc-pay-list__body">
              {loading && <PaymentsSkeleton />}

              {!loading && error && (
                <div
                  style={{
                    padding: "16px 14px",
                    fontSize: 13,
                    color: "#b3433b",
                    background: "rgba(224,98,90,0.05)",
                    borderRadius: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </div>
              )}

              {!loading && !error && payments && payments.length === 0 && (
                <div
                  style={{
                    padding: "28px 14px",
                    fontSize: 13,
                    color: "var(--color-text-muted)",
                    textAlign: "center",
                    border: "1px dashed var(--color-border-default)",
                    borderRadius: 12,
                  }}
                >
                  Aucun paiement enregistré pour le moment.
                </div>
              )}

              {!loading && !error && payments && payments.length > 0 && (
                <div className="nc-pay-table">
                  <div className="nc-pay-head">
                    <span>Titre</span>
                    <span>Date</span>
                    <span>Statut</span>
                    <span style={{ textAlign: "right" }}>Montant TTC</span>
                    <span />
                  </div>
                  {payments.map((p) => (
                    <div
                      className="nc-pay-row nc-pay-row--clickable"
                      key={p.notionId}
                      role="button"
                      tabIndex={0}
                      aria-label={`Voir la facture — ${p.label || "Paiement"}`}
                      data-fb-label="Ligne paiement (aperçu facture) · Modale paiements"
                      onClick={() => openPreview(p.notionId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openPreview(p.notionId);
                        }
                      }}
                    >
                      <span className="nc-pay-c-title" title={p.label}>
                        {p.label || "Paiement"}
                      </span>
                      <span className="nc-pay-c-date">
                        {formatDate(p.paymentDate)}
                      </span>
                      <span className="nc-pay-c-meta">
                        <span className="nc-pay-meta-date">
                          {formatDate(p.paymentDate)}
                        </span>
                        <StatusBadge p={p} />
                      </span>
                      <span className="nc-pay-c-amount">{formatEur(p.amount)}</span>
                      <span className="nc-pay-c-dl">
                        <DownloadButton payment={p} />
                        <ChevronRight
                          size={16}
                          className="nc-pay-chevron"
                          aria-hidden
                        />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── Page 2 — détail de la facture (même carte, pas un pop-up) ── */}
          <section ref={page2Ref} className="t-page" data-page-id="2">
            <InvoiceDetail
              payment={detailPayment}
              onBack={closePreview}
              onClose={onClose}
            />
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
