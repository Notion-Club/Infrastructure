import { createBrowserClient } from "@supabase/ssr";

// Flow Supabase Auth :
// - PKCE (par défaut) : sécurise OAuth en stockant un code verifier dans le
//   browser. Inconvénient majeur pour nos emails (reset password, magic
//   link) : le lien dans l'email DOIT être ouvert dans le MÊME browser que
//   celui qui a initié le flow, sinon le verifier est introuvable et on
//   tombe sur "PKCE code verifier not found in storage". En pratique les
//   users cliquent depuis Mail.app, Gmail web, leur téléphone, etc. — ça
//   échoue trop souvent.
// - implicit : pas de code verifier. Le token complet est dans le lien
//   (token_hash). Marche cross-browser et cross-device. C'est ce qu'on
//   veut pour reset password + magic link.
//
// Note : OAuth (Google) continue d'utiliser PKCE côté Supabase Auth lui-même
// — le paramètre `flowType` ici ne concerne QUE les flows email-based de la
// lib @supabase/ssr.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
      },
    },
  );
}
