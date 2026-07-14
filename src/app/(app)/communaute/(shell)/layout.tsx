import { listConversations, listPostsPage } from "@/modules/community/server/queries";
import { CommunityPage } from "@/modules/community/routes/community-page";
import { ViewportFrame } from "@/shared/components/dashboard/mobile/ViewportFrame";
import { MobileBrandLogo } from "@/shared/components/dashboard/mobile/MobileBrandLogo";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { PwaBottomFrost } from "@/shared/components/dashboard/mobile/PwaBottomFrost";

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

  // ── Chantier clavier v2 : tout /communaute vit dans un ViewportFrame ────────
  // Sur mobile, le frame (position:fixed, suit --nc-vvh/--nc-vvot) se superpose
  // à la zone RÉELLEMENT visible et crée un containing block : TOUT le chrome
  // fixed (logo, actions, nav, frost) rendu DEDANS se cale sur cette zone, y
  // compris quand le clavier décale le viewport. Sur desktop, le frame est en
  // `display: contents` → transparent, layout inchangé (scroll-document via
  // `.nc-community-shell { min-height: 100lvh }`). Le chrome mobile est rendu ICI
  // (et NON dans (app)/layout via AppMobileChrome) sur cette route — une seule
  // instance simultanée (règle d'unicité §2.1). Les paddings/hauteurs mobiles
  // vivent dans `.nc-community-shell` (globals.css).
  return (
    <>
      <ViewportFrame>
        <div className="md:hidden">
          <MobileBrandLogo />
          <MobileTopActions />
          <BottomNav />
          <PwaBottomFrost />
        </div>
        <div className="nc-page-halo nc-community-shell flex flex-col">
          <main
            className="flex flex-col flex-1 w-full mx-auto px-4 md:px-10 md:pt-[104px] md:pb-8"
            style={{ position: "relative", zIndex: 1, maxWidth: 1000 }}
          >
            <CommunityPage
              postsPromise={postsPromise}
              conversationsPromise={conversationsPromise}
            />
          </main>
          {/* children = pages-marqueurs (return null), requis par Next pour que
              la route enfant soit valide, mais sans rendu visible. */}
          {children}
        </div>
      </ViewportFrame>
    </>
  );
}
