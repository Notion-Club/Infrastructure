<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Référence front-end : transitions, animations & design d'interface

Pour **toute** la partie front-end — transitions, animations, micro-interactions et design d'interface — la référence canonique du projet est le skill **`transitions-dev`** (source : [`Jakubantalik/transitions.dev`](https://github.com/Jakubantalik/transitions.dev)), installé dans `.agents/skills/transitions-dev/` et symlinké pour Claude Code.

Règles :

- **Avant** d'écrire une transition ou une animation (modale, dropdown, badge, skeleton, tabs, tooltip, swap d'icône/texte, reveal, shake d'erreur, etc.), consulte d'abord `.agents/skills/transitions-dev/SKILL.md` et le fichier de référence correspondant. On s'en inspire de bout en bout plutôt que de réinventer des `@keyframes` ad hoc.
- Le bloc de variables `_root.css` est importé **une seule fois** dans le stylesheet global ; ne pas dupliquer les `:root`.
- Préserver systématiquement les guards `@media (prefers-reduced-motion: reduce)` fournis par les snippets.
- Commandes du skill : `transitions reveal` (catalogue), `transitions review` (audit du repo), `transitions apply` (pose la transition la mieux adaptée).
- Mettre à jour le skill : `npx skills add Jakubantalik/transitions.dev`.
