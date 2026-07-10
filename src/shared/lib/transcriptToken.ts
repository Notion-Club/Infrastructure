// Signature / vérification de tokens HMAC pour les URLs publiques de
// transcription d'appels coaching.
//
// ⚠️ Server-only — la clé secrète ne doit jamais atteindre le navigateur.
//
// Pourquoi un token signé plutôt qu'une session Supabase :
//   La page /transcript/[token] doit pouvoir être lue par
//   ChatGPT et Claude (qui ne portent pas la session de l'user). Avec un
//   token HMAC, la possession du token vaut autorisation — pas besoin de
//   cookies / Authorization header.
//
// Format token :
//   base64url(callId.userId.exp) . base64url(HMAC-SHA256(payload, KEY))
//   Séparateur "." entre payload et signature (aucun UUID Notion ne contient ".")
//
// TTL fixe 24h. Au-delà, l'user doit recharger /coaching pour obtenir un
// nouveau token (le render server régénère).

import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 24 * 60 * 60 * 1000;

function getKey(): string {
  const key = process.env.TRANSCRIPT_SIGNING_KEY;
  if (!key) {
    throw new Error("TRANSCRIPT_SIGNING_KEY manquant côté serveur");
  }
  return key;
}

// Génère un token signé pour un appel + un user, valide 24h.
// Throw si la clé n'est pas configurée — le caller (queries.ts) doit
// catch pour dégrader proprement (boutons masqués au lieu de crash).
export function signTranscriptToken(callId: string, userId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${callId}.${userId}.${exp}`;
  const sig = createHmac("sha256", getKey()).update(payload).digest();
  const payloadB64 = Buffer.from(payload, "utf-8").toString("base64url");
  const sigB64 = sig.toString("base64url");
  return `${payloadB64}.${sigB64}`;
}

export type VerifyResult =
  | { ok: true; callId: string; userId: string; exp: number }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

// Vérifie un token reçu sur la route publique. Trois failures distincts pour
// debug, mais on retourne le même message générique au client (pas révéler
// si la signature est invalide vs expirée).
export function verifyTranscriptToken(token: string): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, sigB64] = parts;

  let payload: string;
  let sigBytes: Buffer;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf-8");
    sigBytes = Buffer.from(sigB64, "base64url");
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const payloadParts = payload.split(".");
  if (payloadParts.length !== 3) return { ok: false, reason: "malformed" };
  const [callId, userId, expStr] = payloadParts;
  const exp = Number.parseInt(expStr, 10);
  if (!callId || !userId || !Number.isFinite(exp)) {
    return { ok: false, reason: "malformed" };
  }

  // Recompute la signature attendue et compare en timing-safe.
  let expectedSig: Buffer;
  try {
    expectedSig = createHmac("sha256", getKey()).update(payload).digest();
  } catch {
    // Clé manquante côté serveur — on retourne bad_signature (même message).
    return { ok: false, reason: "bad_signature" };
  }

  if (
    sigBytes.length !== expectedSig.length ||
    !timingSafeEqual(sigBytes, expectedSig)
  ) {
    return { ok: false, reason: "bad_signature" };
  }

  if (Date.now() > exp) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, callId, userId, exp };
}
