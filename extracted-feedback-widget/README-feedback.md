# Outil de retours Mireille — Guide de configuration

## Fonctionnement

L'outil est un widget intégré dans le site (bouton fixe en bas à droite). Il permet à Mireille de :
1. Cliquer sur "Sélectionner un élément" pour activer le mode inspection
2. Cliquer sur n'importe quel élément de la page pour l'annoter
3. Rédiger son retour et l'ajouter à la liste
4. Envoyer tous les retours d'un coup vers la base Notion dédiée

Chaque retour crée automatiquement un ticket dans la base Notion avec le statut "À traiter".

---

## Configuration des variables d'environnement (Vercel)

1. Aller sur le dashboard Vercel du projet : https://vercel.com/g0uman/mireille/settings/environment-variables
2. Ajouter les deux variables suivantes :

| Variable | Valeur |
|---|---|
| `NOTION_TOKEN` | Token de l'intégration Notion (voir ci-dessous) |
| `NOTION_DATA_SOURCE_ID` | `328a9e4c-7cee-4d0a-b00f-f50b801f6fe7` |

3. Cocher les environnements : Production, Preview, Development
4. Sauvegarder et redéployer

---

## Créer l'intégration Notion

1. Aller sur https://www.notion.so/my-integrations
2. Cliquer sur "New integration"
3. Nom : `Swiss Serenity Plus Feedback`
4. Workspace : sélectionner le workspace de Mireille
5. Capabilities : cocher "Insert content" (lecture non nécessaire pour cette version)
6. Cliquer sur "Submit" et copier le token (format `ntn_...` ou `secret_...`)
7. Coller le token dans la variable `NOTION_TOKEN` sur Vercel

## Connecter l'intégration à la base Notion

1. Ouvrir la base de données Notion "Retours site" (ID : `328a9e4c-7cee-4d0a-b00f-f50b801f6fe7`)
2. Cliquer sur les trois points `...` en haut à droite de la page
3. Aller dans "Connections"
4. Rechercher et ajouter l'intégration "Swiss Serenity Plus Feedback"

---

## Tester en local

### Prérequis
Installer la CLI Vercel :
```bash
npm i -g vercel
vercel login
vercel link  # lier au projet Vercel existant
```

### Lancer le serveur local avec les variables d'env
```bash
vercel dev
```

Le serveur démarre sur http://localhost:3000 avec les variables Vercel injectées automatiquement.

### Tester l'endpoint avec curl

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-001",
    "feedbacks": [
      {
        "element": "Bouton Prendre contact",
        "page": "Home",
        "text": "Le bouton est un peu trop discret sur mobile",
        "timestamp": "2026-05-20T14:30:00.000Z"
      }
    ]
  }'
```

Réponse attendue en cas de succès :
```json
{ "success": true, "created": 1, "sessionId": "test-session-001" }
```

---

## Structure de la base Notion

| Propriété | Type | Description |
|---|---|---|
| `Ticket` | Titre | Résumé automatique : `[Élément] · [60 premiers caractères]` |
| `Statut` | Select | Toujours `À traiter` à la création |
| `Élément ciblé` | Texte | Nom de l'élément annoté |
| `Page concernée` | Select | Page du site (Home, Contact, etc.) |
| `Retour client` | Texte | Texte complet du retour |
| `Date soumission` | Date | Horodatage ISO 8601 |
| `Session ID` | Texte | UUID identifiant la session de visite |
