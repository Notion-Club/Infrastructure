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
