// URLs Fillout consommées par la page /coaching.
//
// Préférence : variables d'environnement (configurées côté Vercel pour la
// prod). Fallback : URLs des formulaires actuels pour permettre le dev local
// sans config.
//
// Variables attendues (préfixe NEXT_PUBLIC_ car consommées côté client) :
//   - NEXT_PUBLIC_FILLOUT_COACHING_URL : URL complète du formulaire coaching
//   - NEXT_PUBLIC_FILLOUT_SALES_URL    : URL complète du formulaire sales
//                                         (Théo prépare un form dédié — vide
//                                         pour l'instant côté Vercel)

const COACHING_FALLBACK = "https://gouman.fillout.com/coaching";
// Pas de fallback sales tant que le form n'est pas créé : on tombe sur la
// même URL coaching pour ne pas crasher l'UI en dev, mais ça doit être
// remplacé en prod.
const SALES_FALLBACK = COACHING_FALLBACK;

export const FILLOUT_URLS = {
  coaching:
    process.env.NEXT_PUBLIC_FILLOUT_COACHING_URL || COACHING_FALLBACK,
  sales:
    process.env.NEXT_PUBLIC_FILLOUT_SALES_URL || SALES_FALLBACK,
};
