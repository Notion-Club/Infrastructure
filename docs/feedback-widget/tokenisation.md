# Tokenisation des blocs — outil de feedback

> Comment l'outil de feedback nomme précisément le bloc qu'on sélectionne, et
> comment garder ce nommage propre quand on ajoute de nouveaux écrans.

---

## Le problème résolu

Avant, quand on sélectionnait un bloc avec le mode « Retour sur un élément », le
nom remonté côté Notion était générique : « Section », « Navigation », ou le
texte brut du lien cliqué. Impossible de savoir **de quoi** on parlait
réellement ni **où** ça se situait.

Désormais chaque bloc porte un **token** en deux parties :

```
<Quoi> <précision> · <Contexte>
```

- **Quoi** = la nature du bloc (le premier mot) : `Bouton`, `Encadré`, `Titre`,
  `Image`, `Icône`, `Avatar`, `Barre de navigation`, `Switcher`, `Carte`…
- **Contexte** = où il se trouve : `Widget Formation`, `Barre de navigation`,
  `Feed`, `Corps Notion`, etc. Le **nom de la page** (Accueil, Formation,
  Communauté…) est **ajouté automatiquement** par le widget — pas besoin de le
  répéter dans le libellé.

Exemples de tokens finaux remontés à Notion :

| Bloc cliqué | Token résultant |
|---|---|
| Bouton « Reprendre » du widget formation | `Bouton Reprendre · Widget Formation · Accueil` |
| Avatar dans la barre de navigation | `Avatar compte · Barre de navigation · Accueil` |
| Switcher de la page communauté | `Switcher feed/messages · Communauté` |
| Corps Notion d'une ressource | `Corps Notion · Page ressource · Ressources` |

---

## Comment c'est branché

### 1. L'attribut `data-fb-label`

Chaque bloc significatif porte un attribut `data-fb-label` sur sa balise DOM :

```tsx
<button data-fb-label="Bouton Reprendre · Widget Formation">Reprendre</button>
```

Au clic en mode sélection, `getElementLabel()`
(`src/shared/components/feedback-widget/FeedbackWidget.tsx`) **remonte le DOM
depuis l'élément cliqué** et renvoie le **premier** `data-fb-label` rencontré.

Conséquence pratique : un libellé posé sur un sous-élément (un bouton, un
avatar) **prime** sur celui de son conteneur. On peut donc tokeniser à deux
niveaux — l'encadré ET le bouton dedans — et obtenir automatiquement le plus
précis selon où l'utilisateur clique.

### 2. Le contexte page (auto)

`appendPageContext()` ajoute « · <Page> » au libellé, sauf si le libellé
mentionne déjà la page. La page est résolue par `getCurrentPage()` qui gère
aussi les **routes dynamiques** par préfixe (`/communaute/post/123` →
`Communauté`).

### 3. Le fallback intelligent

Si aucun `data-fb-label` n'est trouvé, `getElementLabel()` ne renvoie plus
« Section » : il **préfixe par la nature du bloc** déduite du tag HTML
(`Bouton`, `Lien`, `Titre`, `Image`, `Champ`…) et y accole le texte court de
l'élément. Un bloc non encore tokenisé reste donc identifiable — mais l'idéal
est de lui poser un `data-fb-label` explicite.

---

## Convention à suivre pour un nouvel écran

1. **Pose `data-fb-label` sur le conteneur logique** d'un bloc (encadré, carte,
   section, barre).
2. **Pose-en aussi sur les sous-éléments interactifs** importants (chaque
   bouton, avatar, champ, onglet, switcher) — le plus proche du clic gagne.
3. **Format** : `"<Quoi> <précision> · <Contexte local>"`.
4. **N'inclus jamais le nom de la page** — il est ajouté automatiquement.
5. **Vocabulaire « Quoi »** (premier mot, en français) : Bouton, Encadré, Carte,
   Titre, Sous-titre, Image, Icône, Avatar, Champ, Barre de recherche, Barre de
   navigation, Onglet, Switcher, Interrupteur, Lien, Badge, Pastille, Compteur,
   Menu, Modale, Toast, Bannière, Lecteur vidéo, Bloc Notion, Corps Notion,
   Embed vidéo, Fil d'ariane, Barre de progression, Liste, Filtre, Cadenas.
6. **Toujours sur une vraie balise DOM** (`div`, `button`, `a`, `nav`, `img`…),
   jamais sur un composant React custom qui ne forwarde pas ses props — dans ce
   cas, édite la balise racine à l'intérieur du composant.
7. Pour un `.map()`, on peut interpoler une donnée triviale :
   `data-fb-label={`Carte ressource « ${r.title} »`}`.

---

## Où c'est implémenté

- Logique : `src/shared/components/feedback-widget/FeedbackWidget.tsx`
  (`TAG_KIND`, `getCurrentPage`, `appendPageContext`, `getElementLabel`).
- Les `data-fb-label` sont posés directement dans les composants de chaque
  brique (dashboard, formation, communauté, ressources, coaching, settings,
  auth).
