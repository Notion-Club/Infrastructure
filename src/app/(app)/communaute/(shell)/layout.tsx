import { listConversations, listPostsPage } from "@/modules/community/server/queries";
import { CommunityPage } from "@/modules/community/routes/community-page";
import { CommunityKeyboardViewport } from "@/shared/components/dashboard/mobile/CommunityKeyboardViewport";

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
  // 1re page paginée (keyset) : posts + nextCursor + hasMore. Le feed charge la
  // suite au scroll via la server action loadMorePosts (cf. FeedPostList).
  const postsPromise = listPostsPage({ limit: 50 });
  const conversationsPromise = listConversations();

  // Shell `/communaute` — hauteur = viewport VISIBLE (cf. .nc-community-shell) :
  //   • Desktop : min-height 100lvh (scroll-document, inchangé).
  //   • Mobile : `height: var(--nc-vvh, 100dvh); overflow: hidden` → la PAGE ne
  //     scrolle pas, seule la carte scrolle en interne, et l'ensemble RÉTRÉCIT au
  //     clavier (--nc-vvh posée par CommunityKeyboardViewport) pour rester visible
  //     en entier, composer au ras du clavier.
  // AUCUN `position: fixed` ici (contrairement à l'ancien ViewportFrame) → la
  // safe-area iOS n'est jamais reflowée → la BottomNav globale garde sa position,
  // identique à toutes les autres routes. Le padding mobile (haut 64 / bas nav)
  // est porté par `.nc-community-shell > main` (globals.css), pas par des classes
  // ici, pour basculer à 8px quand le clavier masque la nav (body.nc-kb-open).
  return (
    <div className="nc-page-halo nc-community-shell flex flex-col">
      {/* Contrôleur clavier (client) : pose --nc-vvh + body.nc-kb-open. Lecture
          seule, aucun position:fixed/transform → la nav n'est jamais déplacée. */}
      <CommunityKeyboardViewport />
      <main
        className="flex flex-col flex-1 w-full mx-auto px-4 md:px-10 md:pt-[104px] md:pb-8"
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
