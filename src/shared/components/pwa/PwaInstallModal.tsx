"use client";

import { X } from "lucide-react";

// ============================================================================
// PwaInstallModal — pop-up d'incitation à installer la PWA.
//
// Reprend le composant / le style du pop-up profil (.nc-profile-* → .nc-pwa-*) :
// bottom sheet mobile (slide-up ↔ slide-down), modale centrée desktop
// (scale + fade). Découplage montage (`mounted`) / visible (`data-open`).
//
// Split screen :
//   • haut  → animation iOS « Sur l'écran d'accueil » (iframe isolée
//             /pwa-install-animation.html), carte blanche détourée ;
//   • bas   → copywriting (titre + étapes en « touches ») + CTA conditionnel.
//
// Croix VS bouton : un bouton ne sert que s'il déclenche réellement l'ajout.
//   • Android / Chromium (deferredPrompt dispo → `canInstall`) : le bouton
//     « Installer » ouvre la vraie invite native → on le garde.
//   • iOS Safari (aucun déclencheur programmatique) : pas de bouton, on ne
//     laisse que la croix liquid glass (la marche à suivre est dans
//     l'animation + le texte à touches).
// La croix de fermeture est TOUJOURS présente (dismiss sur les deux plateformes).
// ============================================================================

// Icône iOS « Partager » (square.and.arrow.up).
function ShareGlyph() {
  return (
    <svg viewBox="0 0 433.35 670.654" fill="currentColor" aria-hidden="true">
      <path d="M433.35 296.387L433.35 484.375C433.35 550.049 396.729 586.426 331.055 586.426L102.051 586.426C36.377 586.426 0 550.049 0 484.375L0 296.387C0 230.957 36.377 194.336 102.051 194.336L151.367 194.336L151.367 233.643L102.051 233.643C62.0117 233.643 39.3066 256.348 39.3066 296.387L39.3066 484.375C39.3066 524.658 62.0117 547.119 102.051 547.119L331.055 547.119C371.338 547.119 394.043 524.658 394.043 484.375L394.043 296.387C394.043 256.348 371.338 233.643 331.055 233.643L281.738 233.643L281.738 194.336L331.055 194.336C396.729 194.336 433.35 230.957 433.35 296.387Z" />
      <path d="M133.789 152.1C138.428 152.1 143.799 150.146 147.217 146.24L185.059 105.957L216.553 72.5098L248.291 105.957L285.889 146.24C289.307 150.146 294.434 152.1 299.072 152.1C309.326 152.1 316.895 145.02 316.895 135.01C316.895 129.639 314.941 125.732 311.279 122.07L230.713 44.4336C225.83 39.5508 221.68 38.0859 216.553 38.0859C211.67 38.0859 207.52 39.5508 202.393 44.4336L122.07 122.07C118.408 125.732 116.211 129.639 116.211 135.01C116.211 145.02 123.535 152.1 133.789 152.1ZM216.553 395.264C227.051 395.264 236.084 386.719 236.084 376.465L236.084 128.174L233.154 62.2559C232.666 53.4668 225.586 45.8984 216.553 45.8984C207.764 45.8984 200.684 53.4668 200.195 62.2559L197.266 128.174L197.266 376.465C197.266 386.719 206.055 395.264 216.553 395.264Z" />
    </svg>
  );
}

// Icône iOS « Sur l'écran d'accueil » (rectangle arrondi + plus).
function AddToHomeGlyph() {
  return (
    <svg viewBox="0 0 450.195 449.951" fill="currentColor" aria-hidden="true">
      <path d="M132.812 449.951L317.139 449.951C360.107 449.951 393.555 437.5 415.527 415.527C438.232 393.066 450.195 359.619 450.195 316.895L450.195 133.057C450.195 90.332 438.232 56.8848 415.527 34.4238C393.311 12.207 360.107 0 317.139 0L132.812 0C90.0879 0 56.3965 12.4512 34.4238 34.4238C11.9629 56.8848 0 90.332 0 133.057L0 316.895C0 359.619 11.7188 393.066 34.4238 415.527C56.6406 437.744 90.0879 449.951 132.812 449.951ZM132.812 410.645C102.539 410.645 78.8574 402.1 63.4766 386.719C47.6074 371.094 39.3066 347.656 39.3066 316.895L39.3066 133.057C39.3066 102.295 47.6074 78.8574 63.4766 63.2324C78.6133 48.0957 102.539 39.3066 132.812 39.3066L317.139 39.3066C347.656 39.3066 371.094 47.8516 386.719 63.2324C402.588 78.8574 410.889 102.295 410.889 133.057L410.889 316.895C410.889 347.656 402.588 371.094 386.719 386.719C371.338 401.855 347.656 410.645 317.139 410.645Z" />
      <path d="M245.605 316.895L245.605 132.324C245.605 119.873 237.061 111.328 224.854 111.328C212.891 111.328 204.834 119.873 204.834 132.324L204.834 316.895C204.834 329.102 212.891 337.646 224.854 337.646C237.061 337.646 245.605 329.346 245.605 316.895ZM133.057 244.873L317.627 244.873C329.834 244.873 338.379 236.816 338.379 224.854C338.379 212.646 329.834 204.102 317.627 204.102L133.057 204.102C120.361 204.102 112.061 212.646 112.061 224.854C112.061 236.816 120.605 244.873 133.057 244.873Z" />
    </svg>
  );
}

type PwaInstallModalProps = {
  /** Présent dans le DOM (reste monté pendant l'animation de fermeture). */
  mounted: boolean;
  /** data-open=true → joue la transition d'ouverture. */
  visible: boolean;
  /** Titre du pop-up. */
  title: string;
  /** Vrai déclencheur d'installation dispo (Android/Chromium) → bouton affiché. */
  canInstall: boolean;
  /** CTA installer (seulement si canInstall). */
  onInstall: () => void;
  /** Fermeture (croix, backdrop, poignée). */
  onDismiss: () => void;
};

export function PwaInstallModal({
  mounted,
  visible,
  title,
  canInstall,
  onInstall,
  onDismiss,
}: PwaInstallModalProps) {
  if (!mounted) return null;

  return (
    <div
      className="nc-pwa-modal-root"
      data-open={visible ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-label="Installer l'application Notion Club"
    >
      {/* Backdrop flouté — clic = fermeture. */}
      <div className="nc-pwa-backdrop" onClick={onDismiss} aria-hidden />

      <div className="nc-pwa-panel" data-fb-label="Pop-up installation PWA">
        {/* Poignée (mobile) — clic = fermeture vers le bas. */}
        <div
          className="nc-pwa-grabber"
          onClick={onDismiss}
          role="button"
          tabIndex={-1}
          aria-label="Fermer"
          data-fb-label="Poignée · Pop-up installation PWA"
        />

        {/* Croix liquid glass (toujours présente) — seul moyen de fermer sur iOS. */}
        <button
          type="button"
          className="nc-pwa-close"
          onClick={onDismiss}
          aria-label="Fermer"
          data-fb-label="Fermer · Pop-up installation PWA"
        >
          <X size={14} strokeWidth={2.4} />
        </button>

        {/* Split haut : animation en boucle, isolée dans une iframe. */}
        <div className="nc-pwa-anim">
          <iframe
            src="/pwa-install-animation.html"
            title="Aperçu : ajouter Notion Club à l'écran d'accueil"
            loading="lazy"
            scrolling="no"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>

        {/* Split bas : copywriting + CTA conditionnel. */}
        <div className="nc-pwa-copy">
          <h2 className="nc-pwa-title">{title}</h2>
          <p className="nc-pwa-subtitle">
            Plus de fonctionnalités et de meilleures performances. Clique sur{" "}
            <kbd className="nc-pwa-kbd">
              Partager
              <ShareGlyph />
            </kbd>{" "}
            puis{" "}
            <kbd className="nc-pwa-kbd">
              Sur l&apos;écran d&apos;accueil
              <AddToHomeGlyph />
            </kbd>{" "}
            pour y accéder en 1 clic.
          </p>

          {/* Bouton uniquement quand un vrai déclencheur existe (Android/Chromium). */}
          {canInstall && (
            <div className="nc-pwa-actions">
              <button
                type="button"
                className="nc-pwa-btn-primary"
                onClick={onInstall}
                data-fb-label="CTA installer · Pop-up PWA"
              >
                Installer l&apos;application
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
