import { HERO_VT_NAME } from '@/modules/ressources/lib/heroTransition';

const pulse: React.CSSProperties = {
  animation: 'nc-skeleton-pulse 1.6s ease-in-out infinite',
  background: 'var(--color-surface-raised)',
  borderRadius: 'var(--nc-radius-xs)',
};

// Skeleton de la page ressource. L'encadré porte le même `view-transition-name`
// que la carte cliquée : la carte s'agrandit donc VERS cet encadré pendant le
// chargement, puis le contenu réel (`nc-hero-reveal` côté page) se fond
// par-dessus ces placeholders. Le skeleton reste au niveau titre / description /
// tags / corps — jamais des blocs de composants de page.
export default function RessourceDetailLoading() {
  return (
    <div className="nc-page-halo" style={{ minHeight: '100dvh' }}>
      <main style={{ position: 'relative', zIndex: 1 }}>
        <div className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10">
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {/* Fil d'ariane — bouton « Revenir » + chemin */}
            <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ ...pulse, height: 30, width: 168, borderRadius: 9999 }} />
              <div style={{ ...pulse, height: 14, width: 220, borderRadius: 8, animationDelay: '60ms' }} />
            </div>

            {/* Encadré — cible du morph (carte → page) */}
            <div
              style={{
                background: 'var(--color-surface-card)',
                borderRadius: 20,
                padding: 32,
                boxShadow: 'var(--nc-shadow-3)',
                marginBottom: 32,
                minHeight: 420,
                viewTransitionName: HERO_VT_NAME,
              }}
            >
              {/* Titre */}
              <div style={{ ...pulse, height: 46, width: '72%', borderRadius: 'var(--nc-radius-sm)' }} />

              {/* Description (2 lignes) */}
              <div style={{ ...pulse, height: 16, width: '94%', marginTop: 20, borderRadius: 8, animationDelay: '60ms' }} />
              <div style={{ ...pulse, height: 16, width: '60%', marginTop: 10, borderRadius: 8, animationDelay: '100ms' }} />

              {/* Date */}
              <div style={{ ...pulse, height: 13, width: 120, marginTop: 20, borderRadius: 8, animationDelay: '140ms' }} />

              {/* Tags */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {[96, 120, 84].map((w, i) => (
                  <div key={w} style={{ ...pulse, height: 24, width: w, borderRadius: 9999, animationDelay: `${160 + i * 40}ms` }} />
                ))}
              </div>

              {/* Séparateur */}
              <div style={{ borderTop: '1px solid var(--color-border-default)', margin: '28px 0' }} />

              {/* Corps (lignes de texte) */}
              {['100%', '96%', '88%', '92%', '70%'].map((w, i) => (
                <div key={w} style={{ ...pulse, height: 14, width: w, marginTop: i === 0 ? 0 : 12, borderRadius: 8, animationDelay: `${200 + i * 40}ms` }} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
