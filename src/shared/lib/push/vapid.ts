// VAPID — config serveur pour Web Push.
//
// VAPID = Voluntary Application Server Identification : un keypair que ton
// backend utilise pour s'identifier auprès des push services (Mozilla,
// Apple, Google). Sans ça, le navigateur refuse la souscription
// (`PushManager.subscribe()` throws).
//
// Génération des clés (une fois, en local) :
//   npx web-push generate-vapid-keys
//
// Variables d'env (cf. .env.example) :
//   - NEXT_PUBLIC_VAPID_PUBLIC_KEY : exposée au client, sert à
//     `PushManager.subscribe({ applicationServerKey })`.
//   - VAPID_PRIVATE_KEY            : SERVER ONLY, sert à signer chaque
//     push envoyé via `web-push.sendNotification()`.
//   - VAPID_SUBJECT                : mailto: ou https:// — point de
//     contact si un push abuse ; les push services peuvent t'écrire ici.

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

// Côté serveur uniquement. Throw une erreur claire si une variable manque
// pour éviter les pushes silencieusement no-op en prod.
export function getServerVapidConfig(): VapidConfig {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  // Fallback hardcodé sur theo@gouman.fr — décision produit, cf. PR push.
  const subject = process.env.VAPID_SUBJECT ?? "mailto:theo@gouman.fr";

  if (!publicKey || !privateKey) {
    throw new Error(
      "Web Push : VAPID keys manquantes. Lancer `npx web-push generate-vapid-keys` et renseigner NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (cf. .env.example).",
    );
  }
  return { publicKey, privateKey, subject };
}

// Côté client : juste la clé publique pour PushManager.subscribe().
// Retourne null si pas configurée — l'UI doit gracieusement masquer le
// toggle push dans ce cas (au lieu de crasher).
export function getClientVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}
