'use client';

import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { FilloutModal } from './FilloutModal';
import type { FilloutType } from './FilloutModal';

interface NoResultsStateProps {
  /** Type de formulaire ouvert par « Suggérer mon idée » — aligné sur la carte
   *  de suggestion en fin de liste. */
  filloutType: FilloutType;
}

/**
 * État « aucun résultat » de la grille des ressources.
 *
 * Reprend le design system de l'état vide de /coaching (titre focal centré +
 * sous-texte) et fait apparaître le texte avec la transition « Texts reveal »
 * de transitions.dev (#18) : montée en cascade avec un léger flou. Un CTA rouge
 * signature ouvre le même pop-up de suggestion que la carte de fin de liste.
 */
export function NoResultsState({ filloutType }: NoResultsStateProps) {
  const [shown, setShown] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Joue l'entrée en cascade au montage (rAF : laisse peindre l'état initial
  // invisible avant de basculer en .is-shown, sinon la transition est sautée).
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      data-fb-label="État aucun résultat · Grille des ressources"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '56px 24px',
        textAlign: 'center',
      }}
    >
      <div className={shown ? 't-stagger is-shown' : 't-stagger'}>
        <strong
          className="t-stagger-line t-stagger-line--1"
          style={{
            fontSize: 'clamp(20px, 4vw, 26px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
            color: 'var(--color-text-primary)',
          }}
        >
          On n&apos;a rien trouvé
        </strong>
        <span
          className="t-stagger-line t-stagger-line--2"
          style={{
            fontSize: 15,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
            margin: '10px auto 0',
          }}
        >
          La ressource que tu cherches n&apos;existe pas encore,
          <br />
          mais elle peut être créée pour toi
        </span>
        <span className="t-stagger-line t-stagger-line--3" style={{ marginTop: 22 }}>
          <button
            type="button"
            data-fb-label="Bouton Suggérer mon idée · Aucun résultat"
            onClick={() => setModalOpen(true)}
            className="hover:opacity-90"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 22px',
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 600,
              color: '#ffffff',
              background: 'var(--color-brand)',
              border: '1px solid var(--color-brand)',
              cursor: 'pointer',
              boxShadow: 'var(--nc-shadow-3)',
              transition: 'opacity 150ms ease, transform 150ms ease',
            }}
          >
            <Lightbulb size={15} />
            Suggérer mon idée
          </button>
        </span>
      </div>

      <FilloutModal isOpen={modalOpen} onClose={() => setModalOpen(false)} type={filloutType} />
    </div>
  );
}
