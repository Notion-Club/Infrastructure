export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  const diffW = Math.floor(diffD / 7);
  const diffMo = Math.floor(diffD / 30);

  if (diffSec < 60) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD === 1) return "hier";
  if (diffD < 7) return `il y a ${diffD} jours`;
  if (diffW < 4) return `il y a ${diffW} sem.`;
  if (diffMo < 12) return `il y a ${diffMo} mois`;
  return `il y a ${Math.floor(diffMo / 12)} an${Math.floor(diffMo / 12) > 1 ? "s" : ""}`;
}

// Format relatif d'ancienneté de membre, préfixé "A rejoint" — utilisé
// dans la UserHoverCard (carte au survol d'un avatar). Granularité :
// minute (<1 h), heure (<24 h), jour (<7 j), semaine (<30 j), mois
// (<365 j), année. Tolère null/undefined/"" et les dates invalides en
// retombant sur "A rejoint récemment" plutôt que d'afficher "A rejoint
// il y a NaN ans" (bug rencontré quand profiles.created_at n'était pas
// remonté depuis Supabase).
//
// Seuils alignés sur les jours (et non sur diffMo/diffW) pour éviter
// les trous "0 mois" entre 28-29 jours et "0 an" entre 360-364 jours :
// l'arrondi floor de 30 j et 365 j cause une discontinuité que la
// review adversariale a relevée.
export function joinedAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return "A rejoint récemment";
  const date = new Date(dateStr);
  const ts = date.getTime();
  if (Number.isNaN(ts)) return "A rejoint récemment";

  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "A rejoint à l'instant";

  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  const diffW = Math.floor(diffD / 7);
  const diffMo = Math.floor(diffD / 30);
  const diffY = Math.floor(diffD / 365);

  if (diffMin < 1) return "A rejoint à l'instant";
  if (diffMin < 60) return `A rejoint il y a ${diffMin} minute${diffMin > 1 ? "s" : ""}`;
  if (diffH < 24) return `A rejoint il y a ${diffH} heure${diffH > 1 ? "s" : ""}`;
  if (diffD < 7) return `A rejoint il y a ${diffD} jour${diffD > 1 ? "s" : ""}`;
  if (diffD < 30) return `A rejoint il y a ${diffW} semaine${diffW > 1 ? "s" : ""}`;
  if (diffD < 365) return `A rejoint il y a ${diffMo} mois`;
  return `A rejoint il y a ${diffY} an${diffY > 1 ? "s" : ""}`;
}

// Format absolu "1 juin 2026 à 14:32" — utilisé pour la date+heure complète
// de publication d'un post (tooltip de hover ou ligne secondaire sur la
// page détail). Renvoie "" si dateStr est manquant pour tolérer les mocks.
export function fullDateTime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const datePart = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} à ${timePart}`;
}

// Retourne true si l'entité a été éditée (updated_at significativement
// postérieur à created_at). Le trigger DB bumpe updated_at à chaque UPDATE
// mais l'INSERT initialise les deux à now() — on tolère 2s de drift pour
// éviter les faux positifs. Retourne false si updatedAt est manquant
// (mocks legacy qui n'ont pas la colonne).
export function wasEdited(createdAt: string, updatedAt: string | undefined): boolean {
  if (!updatedAt) return false;
  const created = new Date(createdAt).getTime();
  const updated = new Date(updatedAt).getTime();
  return updated - created > 2000;
}

export function shortDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffH = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  if (diffH < 24) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffH < 48) return "hier";
  if (diffH < 168) {
    return date.toLocaleDateString("fr-FR", { weekday: "short" });
  }
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
