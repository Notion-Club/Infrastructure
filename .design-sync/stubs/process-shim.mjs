// Evaluated FIRST in the bundle entry. The DS's modules read NEXT_PUBLIC_*
// env vars (Supabase URL/key, app URL, VAPID) at module scope and some code
// references __dirname; in the browser preview neither exists, so without this
// shim the IIFE throws at eval ("process is not defined" / "__dirname is not
// defined") and nothing renders. Fake (non-empty) Supabase values let
// createBrowserClient() construct without throwing "URL and API key required"
// — no network call happens at static render. Real values aren't needed.
globalThis.process ||= { env: {} };
globalThis.process.env ||= {};
Object.assign(globalThis.process.env, {
  NEXT_PUBLIC_SUPABASE_URL: globalThis.process.env.NEXT_PUBLIC_SUPABASE_URL || "https://preview.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: globalThis.process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "preview-anon-key",
  NEXT_PUBLIC_APP_URL: globalThis.process.env.NEXT_PUBLIC_APP_URL || "https://app.notionclub.fr",
});
globalThis.__dirname ||= "/";
globalThis.__filename ||= "/index.js";
