// Server wrapper de /coaching :
//   1. Lit les vrais appels Notion du user via getCallsForCurrentUser
//   2. Passe le payload au client component qui gère l'UI/dev switcher
//
// La logique métier (états dev, sélection mock vs réel) vit dans le client
// component pour préserver l'expérience de test de Théo via DevStateSwitcher.

import CoachingPageClient from "./CoachingPageClient";
import {
  getCallsForCurrentUser,
  getNextUpcomingCallForCurrentUser,
} from "@/modules/coaching/server/queries";
import { getCoachingEligibilityForCurrentUser } from "@/modules/coaching/server/eligibility";

export default async function CoachingPage() {
  // Les trois lectures Notion sont indépendantes — on parallélise pour gagner
  // ~400-600ms sur le premier render (1 seule round-trip au lieu de 3).
  const [realCalls, nextCall, eligibility] = await Promise.all([
    getCallsForCurrentUser(),
    getNextUpcomingCallForCurrentUser(),
    getCoachingEligibilityForCurrentUser(),
  ]);
  return (
    <CoachingPageClient
      realCalls={realCalls}
      nextCall={nextCall}
      eligibility={eligibility}
    />
  );
}
