'use client';

import { useEffect } from 'react';
import { MorphSourceProvider } from '@/modules/ressources/components/morph/MorphSourceContext';
import { ResourceCard } from '@/modules/ressources/components/ResourceCard';
import { TemplateCard } from '@/modules/ressources/components/TemplateCard';
import { mockCurrentUser } from '@/shared/lib/mock/current-user';
import type { Resource, Template, NotionBlock } from '@/modules/ressources/types';

// Données mockées — autosuffisantes, aucune dépendance Notion. `mockCurrentUser`
// = capability 'formation' → un item en visibilité 'Accompagnement' est VERROUILLÉ
// (test du chemin CapabilityLock).

// Helpers de construction de blocs Notion normalisés (forme du routeur unifié).
function rt(text: string): NotionBlock['rich'] {
  return [{ text, href: null, bold: false, italic: false, underline: false, strikethrough: false, code: false, color: 'default' }];
}
function block(id: string, type: NotionBlock['type'], text: string): NotionBlock {
  return { id, type, rich: rt(text) };
}

const RES_OPEN: Resource = {
  category: 'resource',
  slug: 'res-open',
  titre: 'Process de closing en 5 étapes',
  description: 'Un cadre simple pour structurer tes rendez-vous de vente du premier contact à la signature.',
  formation: ['Notion Business'],
  type: ['Sales'],
  visibilite: 'Formation',
  dateCreation: '2026-03-12',
  content: [
    block('h-1', 'heading_2', 'Préparer le terrain'),
    block('p-1', 'paragraph', 'Avant tout appel, qualifie le besoin et fixe un objectif clair pour le rendez-vous.'),
    block('li-1', 'bulleted_list_item', 'Identifier le décideur'),
    block('li-2', 'bulleted_list_item', 'Préparer trois questions ouvertes'),
    block('h-2', 'heading_2', 'Conclure'),
    block('p-2', 'paragraph', 'Reformule la valeur, propose une prochaine étape concrète et engage la signature.'),
  ],
};

const RES_LOCKED: Resource = {
  category: 'resource',
  slug: 'res-locked',
  titre: 'Système de pilotage avancé',
  description: 'Tableau de bord complet réservé aux membres Accompagnement.',
  formation: ['Notion Architecte'],
  type: ['Business'],
  visibilite: 'Accompagnement',
  dateCreation: '2026-04-02',
  content: [block('p-locked', 'paragraph', 'Contenu confidentiel.')],
};

const TPL_OPEN: Template = {
  category: 'template',
  slug: 'tpl-open',
  titre: 'CRM Notion clé en main',
  description: 'Un CRM prêt à dupliquer pour suivre tes prospects et tes deals.',
  type: 'Système Généraliste',
  visibilite: 'Formation',
  urlNotionPublicPage: 'https://www.notion.so/exemple-crm',
  urlTella: 'https://www.tella.tv/video/exemple/embed',
  dateCreation: '2026-02-20',
};

const TPL_LOCKED: Template = {
  category: 'template',
  slug: 'tpl-locked',
  titre: 'Pack Consultant Pro',
  description: 'Réservé aux membres Accompagnement.',
  type: 'Pour les Consultants Notion',
  visibilite: 'Accompagnement',
  urlNotionPublicPage: 'https://www.notion.so/exemple-pack',
  dateCreation: '2026-05-01',
};

export function MorphTestHarness() {
  const cap = mockCurrentUser.capability;
  // Signal d'hydratation : le test e2e attend `html[data-morph-ready]` AVANT de
  // cliquer → sinon le clic part en navigation (handler pas encore attaché).
  useEffect(() => {
    document.documentElement.dataset.morphReady = '1';
    return () => {
      delete document.documentElement.dataset.morphReady;
    };
  }, []);
  return (
    <MorphSourceProvider>
      {/* Fond fixe (échantillonné par le pageBg de l'overlay). C'est un calque
          `position:fixed; z-index:-1; pointer-events:none` → NE PAS y mettre le
          contenu (sinon les cartes héritent de pointer-events:none). */}
      <div className="nc-app-bg" aria-hidden />
      <div style={{ position: 'relative', zIndex: 0, minHeight: '100vh', padding: 24 }}>
        <h1 style={{ fontSize: 18, marginBottom: 16 }}>Lab — morph e2e (dev only)</h1>
        {/* Espaceur haut : décale la grille vers le bas → après un scroll modéré,
            les cartes restent visibles (le test clique sans auto-scroll). */}
        <div data-testid="spacer-top" style={{ height: 400 }} />
        <div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          style={{ position: 'relative', zIndex: 1, maxWidth: 920, margin: '0 auto', display: 'grid', gap: 16 }}
        >
          <div className="nc-grid-card" data-card-id={RES_OPEN.slug}>
            <ResourceCard resource={RES_OPEN} currentCapability={cap} />
          </div>
          <div className="nc-grid-card" data-card-id={RES_LOCKED.slug}>
            <ResourceCard resource={RES_LOCKED} currentCapability={cap} />
          </div>
          <div className="nc-grid-card" data-card-id={TPL_OPEN.slug}>
            <TemplateCard template={TPL_OPEN} currentCapability={cap} />
          </div>
          <div className="nc-grid-card" data-card-id={TPL_LOCKED.slug}>
            <TemplateCard template={TPL_LOCKED} currentCapability={cap} />
          </div>
        </div>
        {/* Espaceur : rend la page défilable → le test e2e peut vérifier que le
            scroll est préservé à la fermeture (pas de saut). */}
        <div data-testid="spacer" style={{ height: 1600 }} />
      </div>
    </MorphSourceProvider>
  );
}
