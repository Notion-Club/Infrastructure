// Server wrapper de /coaching :
//   1. Lit les vrais appels Notion du user via getCallsForCurrentUser
//   2. Passe le payload au client component qui gère l'UI/dev switcher
//
// La logique métier (états dev, sélection mock vs réel) vit dans le client
// component pour préserver l'expérience de test de Théo via DevStateSwitcher.

import CoachingPageClient from "./CoachingPageClient";
import { getCallsForCurrentUser } from "@/modules/coaching/server/queries";

export default async function CoachingPage() {
  const realCalls = await getCallsForCurrentUser();
  return <CoachingPageClient realCalls={realCalls} />;
}
