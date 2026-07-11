// Authentification machine-to-machine par secret partagé.
//
// Vérifie qu'une requête porte `Authorization: Bearer <CRON_SECRET>` — la voie
// utilisée par les crons Vercel custom, les scripts admin curl et les webhooks
// internes. Retourne `false` si `CRON_SECRET` n'est pas configuré (jamais de
// bypass silencieux). Se compose avec `isRequestAdmin()` sur les routes qui
// acceptent AUSSI un admin authentifié (sync formation/ressources).
export function isCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  return Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;
}
