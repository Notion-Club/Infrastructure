import { HERO_VT_NAME, HERO_TITLE_VT_NAME } from '@/modules/ressources/lib/heroTransition';

const pulse: React.CSSProperties = {
  animation: 'nc-skeleton-pulse 1.6s ease-in-out infinite',
  background: 'var(--color-surface-raised)',
  borderRadius: 'var(--nc-radius-xs)',
};

// Skeleton de la page template — même principe que la page ressource : l'encadré
// porte le `view-transition-name` partagé, la carte morphe vers lui pendant le
// chargement. Placeholders titre / description / tags + emplacement vidéo Tella.
export default function TemplateDetailLoading() {
  return (
    <div className="nc-page-halo" style={{ minHeight: '100dvh' }}>
      <main style={{ position: 'relative', zIndex: 1 }}>
        <div className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10">
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {/* Fil d'ariane */}
            <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ ...pulse, height: 30, width: 168, borderRadius: 9999 }} />
              <div style={{ ...pulse, height: 14, width: 200, borderRadius: 8, animationDelay: '60ms' }} />
            </div>

            {/* Encadré — cible du morph */}
            <div
              style={{
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--nc-radius-md)',
                padding: 32,
                boxShadow: 'var(--nc-shadow-3)',
                marginBottom: 32,
                minHeight: 420,
                viewTransitionName: HERO_VT_NAME,
              }}
            >
              {/* Titre — porte le nom du titre (morph continu pendant le load). */}
              <div style={{ ...pulse, height: 46, width: '68%', borderRadius: 'var(--nc-radius-sm)', viewTransitionName: HERO_TITLE_VT_NAME }} />

              {/* Description */}
              <div style={{ ...pulse, height: 16, width: '92%', marginTop: 20, borderRadius: 8, animationDelay: '60ms' }} />
              <div style={{ ...pulse, height: 16, width: '54%', marginTop: 10, borderRadius: 8, animationDelay: '100ms' }} />

              {/* Date */}
              <div style={{ ...pulse, height: 13, width: 120, marginTop: 20, borderRadius: 8, animationDelay: '140ms' }} />

              {/* Tags */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {[100, 92].map((w, i) => (
                  <div key={w} style={{ ...pulse, height: 24, width: w, borderRadius: 9999, animationDelay: `${160 + i * 40}ms` }} />
                ))}
              </div>

              {/* Emplacement vidéo Tella (16:9) */}
              <div style={{ ...pulse, marginTop: 24, width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--nc-radius-sm)', animationDelay: '220ms' }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
