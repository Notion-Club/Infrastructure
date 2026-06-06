// Route publique servant la transcription brute d'un appel coaching en
// `text/plain`, consommée par ChatGPT et Claude via leur outil browse.
//
// ⚠️ Pas d'auth Supabase ici — ChatGPT/Claude ne portent pas la session de
// l'user. L'autorisation passe par la possession d'un token HMAC signé
// (TRANSCRIPT_SIGNING_KEY côté server). Voir src/shared/lib/transcriptToken.ts.
//
// Le token est généré au render server de /coaching pour chaque past call
// du user, et embarqué dans l'URL du bouton "Demander à ChatGPT/Claude" via
// le href du <a>. ChatGPT suit l'URL, hit cette route, récupère la
// transcription, et la lit pour répondre à l'user.
//
// Pas de cache (Cache-Control: no-store) — lecture live Notion à chaque hit,
// permet à l'admin de corriger une transcription et de la voir mise à jour
// immédiatement côté IA.

import { verifyTranscriptToken } from "@/shared/lib/transcriptToken";
import { fetchPageBlocks } from "@/shared/lib/notion/blocks";
import { filterNavBlocks } from "@/shared/lib/notion/filterNavBlocks";
import { blocksToPlainText } from "@/shared/lib/notion/blocksToPlainText";
import { normalizeNotionId } from "@/shared/lib/notion/client";

function plainText(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function plainErrorFor(
  reason: "malformed" | "bad_signature" | "expired",
): string {
  // On expose un message générique côté client mais on distingue côté logs.
  // L'expired est différencié pour aider l'utilisateur à comprendre qu'il
  // faut rafraîchir /coaching pour obtenir un nouveau lien.
  if (reason === "expired") {
    return "Lien expiré. Reviens sur /coaching pour en obtenir un nouveau.";
  }
  return "Lien invalide.";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await ctx.params;

  const verified = verifyTranscriptToken(token);
  if (!verified.ok) {
    return plainText(plainErrorFor(verified.reason), 401);
  }

  try {
    const callId = normalizeNotionId(verified.callId);
    const blocks = await fetchPageBlocks(callId);
    const filtered = filterNavBlocks(blocks);
    const text = blocksToPlainText(filtered);
    if (!text) {
      return plainText("(Aucune transcription disponible pour cet appel.)", 200);
    }
    return plainText(text, 200);
  } catch (err) {
    console.error(
      "[transcript route] fetchPageBlocks failed:",
      err instanceof Error ? err.message : err,
    );
    return plainText("Transcript temporairement indisponible.", 502);
  }
}
