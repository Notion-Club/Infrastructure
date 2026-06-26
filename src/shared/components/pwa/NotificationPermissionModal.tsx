"use client";

import { LoaderCircle, X } from "lucide-react";

// ============================================================================
// NotificationPermissionModal — pop-up d'opt-in « Active les notifications ».
//
// Jumeau visuel du PwaInstallModal : même squelette `.nc-pwa-*` (bottom sheet
// mobile slide-up ↔ slide-down, modale centrée desktop scale + fade), même
// découplage montage (`mounted`) / visible (`data-open`). On réutilise donc
// tout le CSS `.nc-pwa-*` déjà présent dans globals.css — rien à dupliquer.
//
// Split screen :
//   • haut  → animation iOS « écran verrouillé » (iframe isolée
//             /notification-permission-animation.html) : 2 notifications
//             Notion Club qui glissent en boucle ;
//   • bas   → copywriting (titre + sous-titre) + CTA unique.
//
// Différence clé avec l'install : ici le CTA déclenche TOUJOURS une vraie
// action (la demande de permission native iOS/Android), donc le bouton est
// toujours présent (pas de variante « croix seule »). La croix liquid glass
// reste le moyen de fermer sans accepter.
// ============================================================================

type NotificationPermissionModalProps = {
  /** Présent dans le DOM (reste monté pendant l'animation de fermeture). */
  mounted: boolean;
  /** data-open=true → joue la transition d'ouverture. */
  visible: boolean;
  /** Demande en cours (permission native + souscription) → spinner + disabled. */
  activating: boolean;
  /** CTA principal : déclenche la permission native + la souscription push. */
  onActivate: () => void;
  /** Fermeture (croix, backdrop, Escape). */
  onDismiss: () => void;
};

export function NotificationPermissionModal({
  mounted,
  visible,
  activating,
  onActivate,
  onDismiss,
}: NotificationPermissionModalProps) {
  if (!mounted) return null;

  return (
    <div
      className="nc-pwa-modal-root"
      data-open={visible ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-label="Activer les notifications Notion Club"
    >
      {/* Backdrop flouté — clic = fermeture. */}
      <div className="nc-pwa-backdrop" onClick={onDismiss} aria-hidden />

      <div className="nc-pwa-panel" data-fb-label="Pop-up activation notifications">
        {/* Croix liquid glass — fermer sans accepter. */}
        <button
          type="button"
          className="nc-pwa-close"
          onClick={onDismiss}
          aria-label="Fermer"
          data-fb-label="Fermer · Pop-up notifications"
        >
          <X size={14} strokeWidth={2.4} />
        </button>

        {/* Split haut : animation lock screen en boucle, isolée dans une iframe. */}
        <div className="nc-pwa-anim">
          <iframe
            src="/notification-permission-animation.html"
            title="Aperçu : notifications Notion Club sur l'écran verrouillé"
            loading="lazy"
            scrolling="no"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>

        {/* Split bas : copywriting + CTA. */}
        <div className="nc-pwa-copy">
          <h2 className="nc-pwa-title">
            Active les notifications pour ne rien louper
          </h2>
          <p className="nc-pwa-subtitle">
            On t&apos;informera dès qu&apos;il se passe quelque chose
            d&apos;intéressant pour toi : nouveau message, nouvelles ressources
            etc.
          </p>

          <div className="nc-pwa-actions">
            <button
              type="button"
              className="nc-pwa-btn-primary"
              onClick={onActivate}
              disabled={activating}
              data-fb-label="CTA activer notifications · Pop-up notifications"
            >
              {activating && (
                <LoaderCircle size={16} className="animate-spin" aria-hidden />
              )}
              {activating ? "Activation…" : "Activer les notifications"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
