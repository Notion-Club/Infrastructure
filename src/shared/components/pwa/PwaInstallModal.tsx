"use client";

import { Sparkles } from "lucide-react";

// ============================================================================
// PwaInstallModal — pop-up d'incitation à installer la PWA.
//
// Reprend À L'IDENTIQUE le composant / le style du pop-up profil
// (ProfileModalProvider + classes `.nc-profile-*`, ici déclinées en
// `.nc-pwa-*`) : bottom sheet aux ~3/4 sur mobile (slide-up ↔ slide-down),
// modale centrée (scale + fade) sur desktop. Découplage montage (`mounted`)
// / visible (`data-open`) pour animer la fermeture, exactement comme le
// pop-up profil.
//
// Split screen :
//   • haut  → animation iOS « Sur l'écran d'accueil » (iframe isolée qui
//             tourne en boucle, fichier statique /pwa-install-animation.html),
//             dissoute dans le bloc texte par un fondu blanc premium ;
//   • bas   → copywriting + CTA d'installation.
//
// Présentationnel : le montage / la visibilité et la logique d'installation
// (beforeinstallprompt Android, instructions iOS) sont pilotés par
// PwaInstallPrompt.
// ============================================================================

type PwaInstallModalProps = {
  /** Présent dans le DOM (reste monté pendant l'animation de fermeture). */
  mounted: boolean;
  /** data-open=true → joue la transition d'ouverture. */
  visible: boolean;
  /** Libellé du CTA principal (varie iOS / Android). */
  installLabel: string;
  /** CTA principal : déclenche l'installation (ou ferme sur iOS). */
  onInstall: () => void;
  /** Fermeture (backdrop, poignée, « Plus tard »). */
  onDismiss: () => void;
};

export function PwaInstallModal({
  mounted,
  visible,
  installLabel,
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

        {/* Split bas : copywriting + CTA. */}
        <div className="nc-pwa-copy">
          <span className="nc-pwa-eyebrow">
            <Sparkles size={13} strokeWidth={2.4} />
            Expérience app
          </span>
          <h2 className="nc-pwa-title">
            Installe Notion Club sur ton écran d&apos;accueil
          </h2>
          <p className="nc-pwa-subtitle">
            Une icône, un tap, et te voilà dans l&apos;app — plein écran, plus
            rapide, avec les notifications. L&apos;expérience Notion Club comme
            une vraie application.
          </p>

          <div className="nc-pwa-actions">
            <button
              type="button"
              className="nc-pwa-btn-primary"
              onClick={onInstall}
              data-fb-label="CTA installer · Pop-up PWA"
            >
              {installLabel}
            </button>
            <button
              type="button"
              className="nc-pwa-btn-ghost"
              onClick={onDismiss}
              data-fb-label="Plus tard · Pop-up PWA"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
