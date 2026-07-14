import { NextRequest, NextResponse } from "next/server";
import { isRequestAdmin } from "@/shared/lib/auth/requireAdmin";

// ============================================================================
// ROUTE TEMPORAIRE (chantier clavier mobile, Phase 1) — à supprimer en Phase 6
// avec le ViewportDebugOverlay.
//
// Reçoit le journal de mesures viewport et l'écrit dans les logs runtime
// Vercel (console.log), lisibles directement via l'API Vercel — canal choisi
// après échec du presse-papier iOS (Safari Web ET PWA) et faute d'accès de
// lecture à la base Notion roadmap. Chunké : Vercel tronque les lignes trop
// longues ; l'identifiant + n/total permettent le réassemblage.
// ============================================================================

const CHUNK = 1500;

export async function POST(request: NextRequest) {
  // Même garde que /api/feedback : seul un admin authentifié écrit ici (une
  // URL de preview reste accessible à quiconque la connaît).
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let text = "";
  try {
    const body = (await request.json()) as { text?: string };
    text = String(body?.text ?? "");
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Journal vide" }, { status: 400 });
  }

  const id = Math.random().toString(36).slice(2, 8);
  const total = Math.ceil(text.length / CHUNK);
  for (let i = 0; i < total; i += 1) {
    console.log(
      `[vpdebug ${id} ${i + 1}/${total}]\n${text.slice(i * CHUNK, (i + 1) * CHUNK)}`,
    );
  }

  return NextResponse.json({ ok: true, id, chunks: total });
}
