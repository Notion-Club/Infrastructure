// L'URL Fillout reçoit 2 paramètres : email (pour pré-remplir le champ email du form)
// et member_id (notion_member_page_id, pour faire le lookup vers la DB Notion Membres
// et activer le filtrage par éligibilité côté Fillout).
//
// Au branchement backend : remplacer MOCK_USER par useSession() depuis Supabase
// et récupérer notion_member_page_id depuis la table profiles.
export const MOCK_USER = {
  email: "theo@notionclub.fr",
  notion_member_page_id: "159bad05-6a95-80aa-bc8a-d6e0f8b9c1a2",
};
