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

export function joinedAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffD = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffW = Math.floor(diffD / 7);
  const diffMo = Math.floor(diffD / 30);

  if (diffD < 7) return `A rejoint il y a ${diffD} jour${diffD !== 1 ? "s" : ""}`;
  if (diffMo < 1) return `A rejoint il y a ${diffW} semaine${diffW !== 1 ? "s" : ""}`;
  if (diffMo < 12) return `A rejoint il y a ${diffMo} mois`;
  const years = Math.floor(diffMo / 12);
  return `A rejoint il y a ${years} an${years > 1 ? "s" : ""}`;
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
