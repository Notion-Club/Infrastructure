// Formatte le libellé de la pill "prochain appel" selon la spec roadmap :
//
//  • aujourd'hui          → "Ton prochain appel est aujourd'hui à HH:mm"
//  • demain               → "Ton appel est demain à HH:mm"
//  • dans X jours (≥ 2)   → "Ton appel est dans X jours, le DD MMMM à HH:mm"
//
// La comparaison se fait par jour calendrier (pas par delta < 24h), via une
// instance de Date alignée minuit local — c'est ce que l'utilisateur attend
// quand il regarde son calendrier.
//
// Locale forcée à fr-FR pour rester cohérent avec le reste de l'app.

export function formatNextCallLabel(scheduledAt: string, now: Date = new Date()): string {
  const callDate = new Date(scheduledAt);
  if (Number.isNaN(callDate.getTime())) return "";

  const time = callDate.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const startOfDay = (d: Date): number => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((startOfDay(callDate) - startOfDay(now)) / MS_PER_DAY);

  if (diffDays <= 0) return `Ton prochain appel est aujourd'hui à ${time}`;
  if (diffDays === 1) return `Ton appel est demain à ${time}`;

  // Plus de 2 jours : "Ton appel est dans X jours, le DD MMMM à HH:mm"
  const longDate = callDate.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
  return `Ton appel est dans ${diffDays} jours, le ${longDate} à ${time}`;
}
