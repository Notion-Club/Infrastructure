import { redirect } from "next/navigation";

// /communaute n'affiche rien en propre : on redirige vers l'onglet feed pour
// que l'URL soit toujours explicite (/communaute/feed). Les anciens liens
// /communaute continuent donc de fonctionner.
export default function CommunautePage() {
  redirect("/communaute/feed");
}
