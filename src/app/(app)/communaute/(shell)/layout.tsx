import { listConversations, listPosts } from "@/modules/community/server/queries";
import { CommunityPage } from "@/modules/community/routes/community-page";

// Layout PARTAGÉ de /communaute/* (feed, messages, messages/[username]).
//
// Pourquoi un layout et non un shell rendu par chaque page (l'ancien
// CommunityShell) ? Dans l'App Router, Next préserve le sous-arbre d'un
// layout entre navigations frères : naviguer feed↔messages↔messages/<user>
// ne re-monte PAS ce layout ni ce qu'il rend. En remontant ici le data-fetch
// (une seule fois) + le shell client persistant CommunityPage, on supprime à
// la racine :
//   - le flash blanc (loading.tsx ne se redéclenche plus aux nav internes),
//   - le re-fetch serveur de listPosts()/listConversations() à chaque switch,
//   - le remount de MessagesLayout (et donc la perte de loadedConvIds /
//     activeId / position de scroll / pagination).
//
// Les pages enfants (feed/page, messages/page, messages/[username]/page) sont
// réduites à des marqueurs `return null` : la vue active (feed/messages) et le
// username de conversation sont dérivés de usePathname() dans CommunityPage.
export default function CommunauteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ⚠️ Layout NON bloquant : on ne `await` PAS ici. On crée les promesses et on
  // les passe à CommunityPage, qui les consomme via `use()` dans des bornes
  // <Suspense> INTERNES (liste de posts / messages / badge). Le cadre (halo +
  // carte + switcher + filtres) rend donc instantanément ; seules les données
  // streament. Plus de layout suspendu → plus de fallback plein écran
  // ((app)/loading.tsx ou (shell)/loading.tsx) → plus de chargement « en deux
  // parties » ni de bande de couleur.
  const postsPromise = listPosts();
  const conversationsPromise = listConversations();

  return (
    <div className="nc-page-halo flex flex-col h-full overflow-hidden">
      <main
        className="flex flex-col flex-1 min-h-0 w-full mx-auto px-4 pt-[64px] pb-[120px] md:px-10 md:pt-[104px] md:pb-8"
        style={{ position: "relative", zIndex: 1, maxWidth: 1000 }}
      >
        <CommunityPage
          postsPromise={postsPromise}
          conversationsPromise={conversationsPromise}
        />
      </main>
      {/* children = pages-marqueurs (return null), requis par Next pour que la
          route enfant soit valide, mais sans rendu visible. */}
      {children}
    </div>
  );
}
