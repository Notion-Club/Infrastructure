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

export default async function CoachingPage() {
  // Les deux lectures Notion sont indépendantes — on parallélise pour gagner
  // ~200-400ms sur le premier render (≈ 1 round-trip Notion au lieu de 2).
  const [realCalls, nextCall] = await Promise.all([
    getCallsForCurrentUser(),
    getNextUpcomingCallForCurrentUser(),
  ]);
  return <CoachingPageClient realCalls={realCalls} nextCall={nextCall} />;
}
