// Formatte le libellé de la pill "prochain appel" selon la spec roadmap :
//
//  • aujourd'hui          → "Ton prochain appel est aujourd'hui à HH:mm avec X"
//  • demain               → "Ton appel est demain à HH:mm avec X"
//  • dans X jours (≥ 2)   → "Ton appel est dans X jours, le DD MMMM à HH:mm avec X"
//
// Le nom du host est ajouté en suffixe si fourni. Si vide, on omet "avec …"
// proprement pour ne pas finir le libellé par un blanc.
//
// La comparaison se fait par jour calendrier (pas par delta < 24h), via une
// instance de Date alignée minuit local — c'est ce que l'utilisateur attend
// quand il regarde son calendrier.
//
// Locale forcée à fr-FR pour rester cohérent avec le reste de l'app.

export function formatNextCallLabel(
  scheduledAt: string,
  options: { host?: string | null; now?: Date } = {},
): string {
  const { host, now = new Date() } = options;
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

  const withHost = host && host.trim().length > 0 ? ` avec ${host.trim()}` : "";

  if (diffDays <= 0)
    return `Ton prochain appel est aujourd'hui à ${time}${withHost}`;
  if (diffDays === 1) return `Ton appel est demain à ${time}${withHost}`;

  // Plus de 2 jours : "Ton appel est dans X jours, le DD MMMM à HH:mm avec X"
  const longDate = callDate.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
  return `Ton appel est dans ${diffDays} jours, le ${longDate} à ${time}${withHost}`;
}
