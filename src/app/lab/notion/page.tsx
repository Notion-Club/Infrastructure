import { notFound } from 'next/navigation';
import { NotionRenderer, type NotionDensity } from '@/shared/components/notion/NotionRenderer';
import type { NotionBlock, RichSpan } from '@/shared/lib/notion/router';

// ─────────────────────────────────────────────────────────────────────────
// PAGE DE PRÉVISUALISATION — /lab/notion
//
// Rend TOUS les types de blocs Notion + toutes les annotations inline via
// <NotionRenderer />, sur des données 100 % mockées (aucun token Notion). Sert
// à juger d'un coup d'œil le rendu de chaque cas. DEV/preview only (404 en prod,
// même gate que /lab/morph et /lab/zoom).
// ─────────────────────────────────────────────────────────────────────────

// ── Helpers de construction ────────────────────────────────────────────────

let _seq = 0;
const nid = () => `lab-${++_seq}`;

function span(text: string, extra: Partial<RichSpan> = {}): RichSpan {
  return {
    text,
    href: null,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    code: false,
    color: 'default',
    ...extra,
  };
}

function B(type: NotionBlock['type'], extra: Partial<NotionBlock> = {}): NotionBlock {
  return { id: nid(), type, ...extra };
}
function P(...rich: RichSpan[]): NotionBlock {
  return B('paragraph', { rich });
}
function H(level: 1 | 2 | 3 | 4, text: string, extra: Partial<NotionBlock> = {}): NotionBlock {
  return B(`heading_${level}` as NotionBlock['type'], { rich: [span(text)], ...extra });
}
function LI(
  type: 'bulleted_list_item' | 'numbered_list_item',
  text: string,
  children?: NotionBlock[],
): NotionBlock {
  return B(type, { rich: [span(text)], ...(children ? { children } : {}) });
}

// URLs publiques (placeholders) pour visualiser les médias.
const MAKE_ICON = 'https://cdn.simpleicons.org/make/6D00CC';
const NOTION_ICON = 'https://cdn.simpleicons.org/notion';
const IMG = 'https://picsum.photos/seed/notionclub/960/420';
const YT_EMBED = 'https://www.youtube.com/embed/aqz-KE-bpKQ';
const MP4 = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const MP3 = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
const PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

// ── Définition des sections ────────────────────────────────────────────────

type Group = {
  title: string;
  note?: string;
  density?: NotionDensity;
  blocks: NotionBlock[];
};

const GROUPS: Group[] = [
  {
    title: 'Texte & annotations inline',
    note: 'gras, italique, souligné, barré, code, couleurs, lien, équation, emoji custom (image) + emoji non résolu (masqué)',
    blocks: [
      P(
        span('Texte normal, '),
        span('gras', { bold: true }),
        span(', '),
        span('italique', { italic: true }),
        span(', '),
        span('souligné', { underline: true }),
        span(', '),
        span('barré', { strikethrough: true }),
        span(', '),
        span('code inline', { code: true }),
        span('. Couleurs : '),
        span('rouge', { color: 'red' }),
        span(' · '),
        span('bleu', { color: 'blue' }),
        span(' · '),
        span('vert', { color: 'green' }),
        span('. Un '),
        span('lien externe', { href: 'https://www.notionclub.fr' }),
        span('. Équation inline '),
        span('E=mc²', { equation: 'E = mc^2' }),
        span('. Icône custom (Make) '),
        span('make', { isEmoji: true, emojiUrl: MAKE_ICON }),
        span(' rendue en image ; un emoji non résolu '),
        span('hidden', { isEmoji: true, emojiUrl: null }),
        span(' est masqué (rien entre les espaces).'),
      ),
    ],
  },
  {
    title: 'Titres (h1 → h4) + titre repliable',
    blocks: [
      H(1, 'Heading 1'),
      H(2, 'Heading 2'),
      H(3, 'Heading 3'),
      H(4, 'Heading 4'),
      H(2, 'Heading repliable (toggle)', {
        isToggleable: true,
        children: [P(span('Contenu révélé au clic sur le chevron.'))],
      }),
    ],
  },
  {
    title: 'Listes (à puces / numérotées, imbriquées)',
    blocks: [
      LI('bulleted_list_item', 'Puce de niveau 1'),
      LI('bulleted_list_item', 'Puce avec sous-puces', [
        LI('bulleted_list_item', 'Sous-puce A'),
        LI('bulleted_list_item', 'Sous-puce B'),
      ]),
      LI('bulleted_list_item', 'Puce de niveau 1 (suite)'),
      LI('numbered_list_item', 'Étape 1'),
      LI('numbered_list_item', 'Étape 2 avec sous-étapes', [
        LI('numbered_list_item', 'Sous-étape 2.1'),
        LI('numbered_list_item', 'Sous-étape 2.2'),
      ]),
      LI('numbered_list_item', 'Étape 3'),
    ],
  },
  {
    title: 'Cases à cocher (to-do)',
    blocks: [
      B('to_do', { rich: [span('Tâche terminée')], checked: true }),
      B('to_do', { rich: [span('Tâche à faire')], checked: false }),
      B('to_do', {
        rich: [span('Tâche avec sous-tâche')],
        checked: false,
        children: [B('to_do', { rich: [span('Sous-tâche cochée')], checked: true })],
      }),
    ],
  },
  {
    title: 'Toggle',
    blocks: [
      B('toggle', {
        rich: [span('Cliquer pour dérouler')],
        children: [
          P(span('Contenu du toggle, masqué par défaut.')),
          LI('bulleted_list_item', 'avec une liste à l’intérieur'),
        ],
      }),
    ],
  },
  {
    title: 'Citation',
    blocks: [
      B('quote', {
        rich: [span('« La simplicité est la sophistication suprême. »')],
        children: [P(span('— attribution placée en enfant du quote'))],
      }),
    ],
  },
  {
    title: 'Callouts (emoji natif, couleur, icône image)',
    blocks: [
      B('callout', { rich: [span('Callout avec emoji natif et couleur par défaut.')], icon: '💡', color: 'default' }),
      B('callout', {
        rich: [span('Callout coloré (fond bleu) avec un enfant.')],
        icon: '📘',
        color: 'blue_background',
        children: [LI('bulleted_list_item', 'un point listé dans le callout')],
      }),
      B('callout', {
        rich: [span('Callout avec icône custom (image).')],
        iconUrl: NOTION_ICON,
        color: 'gray_background',
      }),
    ],
  },
  {
    title: 'Code & équation (bloc)',
    blocks: [
      B('code', { rich: [span('const x = 42;\nconsole.log(x);')], language: 'javascript' }),
      B('equation', { expression: '\\int_0^\\infty e^{-x}\\,dx = 1' }),
    ],
  },
  {
    title: 'Médias (image, vidéo embed, vidéo fichier, audio, fichier, PDF)',
    blocks: [
      B('image', { url: IMG, caption: [span('Légende de l’image')] }),
      B('video', { url: YT_EMBED }),
      B('video', { url: MP4 }),
      B('audio', { url: MP3, name: 'Extrait audio.mp3' }),
      B('file', { url: PDF, name: 'Document.pdf', caption: [span('Pièce jointe')] }),
      B('pdf', { url: PDF, name: 'Rapport.pdf' }),
    ],
  },
  {
    title: 'Liens collés → bouton CTA · bouton natif masqué',
    note: 'bookmark / embed / link_preview deviennent des boutons cliquables ; un bloc Bouton natif Notion (unsupported) ne rend rien',
    blocks: [
      P(span('Liens collés recomposés en boutons CTA cliquables :')),
      B('bookmark', { url: 'https://www.notion.so', caption: [span('Ouvrir Notion')] }),
      B('embed', { url: 'https://www.make.com' }),
      B('link_preview', { url: 'https://www.tella.tv' }),
      P(
        span(
          'Ci-dessous, un bloc Bouton NATIF de Notion (l’API ne renvoie ni URL ni action → type « unsupported ») : il est masqué, rien ne s’affiche.',
        ),
      ),
      B('unsupported', { notionType: 'button' }),
    ],
  },
  {
    title: 'Structure (divider, colonnes, table)',
    blocks: [
      B('divider'),
      B('column_list', {
        children: [
          B('column', { widthRatio: 1, children: [H(4, 'Colonne A'), P(span('Texte de la colonne gauche.'))] }),
          B('column', {
            widthRatio: 2,
            children: [H(4, 'Colonne B (2×)'), P(span('Texte de la colonne droite, deux fois plus large.'))],
          }),
        ],
      }),
      B('table', {
        hasColumnHeader: true,
        hasRowHeader: true,
        children: [
          B('table_row', { cells: [[span('Outil')], [span('Usage')], [span('Prix')]] }),
          B('table_row', { cells: [[span('Make')], [span('Automatisation')], [span('Freemium')]] }),
          B('table_row', { cells: [[span('Fillout')], [span('Formulaires')], [span('Freemium')]] }),
        ],
      }),
    ],
  },
  {
    title: 'Table des matières (auto, ancres cliquables)',
    blocks: [
      B('table_of_contents'),
      H(2, 'Section Alpha'),
      P(span('Contenu de la section Alpha.')),
      H(2, 'Section Bravo'),
      P(span('Contenu de la section Bravo.')),
      H(3, 'Sous-section Bravo.1'),
      P(span('Détail de la sous-section.')),
    ],
  },
  {
    title: 'Références (sous-page / sous-base)',
    blocks: [
      B('child_page', { title: 'Une sous-page Notion' }),
      B('child_database', { title: 'Une sous-base Notion' }),
    ],
  },
  {
    title: 'Densité compacte (prop density="compact")',
    note: 'même contenu, échelle typographique resserrée (ex. modale transcription)',
    density: 'compact',
    blocks: [
      H(2, 'Titre en compact'),
      P(span('Paragraphe en densité compacte : '), span('gras', { bold: true }), span(' et '), span('lien', { href: 'https://www.notionclub.fr' }), span('.')),
      LI('bulleted_list_item', 'Une puce compacte'),
      B('callout', { rich: [span('Callout compact.')], icon: 'ℹ️', color: 'gray_background' }),
    ],
  },
  {
    title: 'État vide (aucun bloc)',
    blocks: [],
  },
];

// ── Rendu ──────────────────────────────────────────────────────────────────

function Section({ title, note, blocks, density }: Group) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-text-muted)',
          margin: '0 0 6px',
        }}
      >
        {title}
      </h2>
      {note && (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>{note}</p>
      )}
      <div
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--nc-radius-md)',
          padding: 24,
          boxShadow: 'var(--nc-shadow-3)',
        }}
      >
        <NotionRenderer blocks={blocks} density={density} label={null} />
      </div>
    </section>
  );
}

export default function NotionLabPage() {
  if (process.env.VERCEL_ENV === 'production') {
    notFound();
  }
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-surface-page)', padding: '40px 16px 120px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <header style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 'clamp(28px, 5vw, 40px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--color-text-primary)',
              margin: '0 0 8px',
            }}
          >
            NotionRenderer — tous les cas
          </h1>
          <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
            Prévisualisation du rendu unifié (Formation · Coaching · Ressources) sur chaque type de bloc et chaque
            annotation. Données mockées, aucun appel Notion. Page de dev (404 en production).
          </p>
        </header>
        {GROUPS.map((g) => (
          <Section key={g.title} {...g} />
        ))}
      </div>
    </div>
  );
}
