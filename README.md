# NotionClub-Infra
Toute l'infrastructure du Notion Club avec les différents composants formant la plateforme délivrée aux clients..

## Police signature

L'ensemble de l'infrastructure utilise **SF Pro Display** (poids 400 / 500 / 600 / 700).

Les fichiers `.otf` sont versionnés dans `src/shared/fonts/` et chargés via `next/font/local` (cf. `src/shared/lib/fonts.ts`) — self-hostés, optimisés et embarqués au build, aucun appel réseau au runtime.

Source des fichiers : https://github.com/sahibjotsaggu/San-Francisco-Pro-Fonts
