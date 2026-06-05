// Public API du module `coaching`.
// Tout import depuis un autre module doit passer par ce fichier.

// Queries serveur (V1 — lecture Supabase, sync Notion à venir)
export {
  getUpcomingCalls,
  getPastCalls,
  getAcceptedCallsCount,
  type CoachingCall,
  type CoachingCallStatus,
} from "./server/queries";

// Server Action utilisée par le bouton "Réserver" sur /coaching :
// résout (ou crée / matche par email) la page Notion Membres de l'user
// et renvoie les infos pour pré-remplir Fillout.
export {
  ensureNotionMemberPage,
  type EnsureNotionMemberResult,
} from "./server/ensureNotionMemberPage";
