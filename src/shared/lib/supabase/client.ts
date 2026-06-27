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
// Fabrique concrète (non générique) : on infère le type PRÉCIS du client à
// partir de SON retour. NB : annoter directement le singleton avec
// `ReturnType<typeof createBrowserClient>` dégraderait le type en `any`
// (createBrowserClient est générique) et casserait tous les call-sites typés
// (.returns<T>(), .single<T>(), payloads .on()). Le passage par makeBrowserClient
// préserve le typage d'origine.
function makeBrowserClient() {
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

// Singleton module-level : `createBrowserClient` (@supabase/ssr) est conçu pour
// être instancié UNE fois par onglet. Avant, chaque appel créait un client neuf
// → un socket WebSocket Realtime distinct par montage de hook
// (useConversationsRealtime, useNotifications monté 2× desktop+mobile), d'où une
// accumulation silencieuse de channels en session PWA longue. On réutilise donc
// la même instance pour tous les appelants.
let browserClient: ReturnType<typeof makeBrowserClient> | undefined;

export function createSupabaseBrowserClient() {
  return (browserClient ??= makeBrowserClient());
}
