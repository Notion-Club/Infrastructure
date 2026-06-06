// Public API du module `coaching`.
// Tout import depuis un autre module doit passer par ce fichier.

// Queries serveur :
//  - getCallsForCurrentUser : lecture live Notion des appels du user (V1
//    branchée sur /coaching).
//  - getUpcomingCalls / getPastCalls / getAcceptedCallsCount : queries
//    Supabase legacy (table coaching_calls). Conservées pour la future
//    sync Notion → Supabase mais non utilisées par la page actuelle.
export {
  getCallsForCurrentUser,
  getUpcomingCalls,
  getPastCalls,
  getAcceptedCallsCount,
  type CoachingCall,
  type CoachingCallStatus,
  type CoachingCallView,
} from "./server/queries";

// Server Action utilisée par le bouton "Réserver" sur /coaching :
// résout (ou crée / matche par email) la page Notion Membres de l'user
// et renvoie les infos pour pré-remplir Fillout.
export {
  ensureNotionMemberPage,
  type EnsureNotionMemberResult,
} from "./server/ensureNotionMemberPage";

// Server Action lazy-load transcription d'un appel (clic sur CallCard).
export {
  getCallTranscriptionBlocks,
  type CallTranscriptionResult,
} from "./server/getCallTranscriptionBlocks";
