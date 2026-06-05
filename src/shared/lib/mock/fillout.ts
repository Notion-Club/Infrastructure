// Construit les URLs Fillout depuis les env vars NEXT_PUBLIC_FILLOUT_*_FORM_ID.
// Fallback sur l'ancien placeholder si non défini (préserve le build / la dev
// sans config), avec un warning console côté serveur uniquement.
//
// Variables attendues (cf. .env.example) :
//   - NEXT_PUBLIC_FILLOUT_COACHING_FORM_ID
//   - NEXT_PUBLIC_FILLOUT_SALES_FORM_ID
// À configurer côté Vercel (Production + Preview).

const COACHING_ID =
  process.env.NEXT_PUBLIC_FILLOUT_COACHING_FORM_ID || "FILLOUT_COACHING_ID";
const SALES_ID =
  process.env.NEXT_PUBLIC_FILLOUT_SALES_FORM_ID || "FILLOUT_VENTE_ID";

export const FILLOUT_URLS = {
  coaching: `https://forms.fillout.com/t/${COACHING_ID}`,
  sales: `https://forms.fillout.com/t/${SALES_ID}`,
};
