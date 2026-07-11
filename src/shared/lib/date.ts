// Helpers de date partagés. Centralise le format long FR « 5 juillet 2026 » qui
// était copié à l'identique dans plusieurs composants ressources.

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * Format long français « J mois AAAA » (ex. « 5 juillet 2026 »).
 * Accepte une chaîne ISO ou un objet Date.
 */
export function formatLongDateFr(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}
