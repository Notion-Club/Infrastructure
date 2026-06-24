"use client";

import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useTransition,
  useCallback,
  useLayoutEffect,
  startTransition,
  use,
  Suspense,
} from "react";
import { MessageCircle, MessagesSquare, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import type { PostTag } from "../types/post.types";
import { useDevRoleToggle } from "../hooks/useDevRoleToggle";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { FeedTagFilters } from "../components/feed/FeedTagFilters";
import { FeedPostList } from "../components/feed/FeedPostList";
import { FeedSkeletonState } from "../components/feed/FeedSkeletonState";
import { FeedErrorState } from "../components/feed/FeedErrorState";
import { PostComposerModal } from "../components/post-composer/PostComposerModal";
import { MessagesLayout } from "../components/messages/MessagesLayout";
import { DevRoleToggle } from "../components/dev/DevRoleToggle";
import { ImageLightboxRoot } from "../components/shared/ImageLightboxRoot";
import { CommunityRestrictedPage } from "./community-restricted-page";
import { createPostAction } from "../server/actions";
import type { Post } from "../types/post.types";
import type { Conversation } from "../types/conversation.types";
import type { User } from "../types/user.types";
import type { DevRole, DevFeedState } from "../hooks/useDevRoleToggle";

type Tab = "feed" | "messages";
type TagFilter = PostTag | "all";

const COMMUNITY_TABS: Tab[] = ["feed", "messages"];

// ============================================================================
// Chargement : le LAYOUT (non bloquant) passe des PROMESSES (listPosts /
// listConversations) plutôt que des tableaux résolus. Le cadre — halo (layout)
// + carte + switcher + filtres — rend INSTANTANÉMENT, et seules les données
// (liste de posts / messages, compteur non-lus) sont mises en <Suspense> via
// `use()`. Conséquence : le cadre ne disparaît jamais → plus de chargement
// « cassé en deux parties » ni de bande de couleur (le halo du layout reste
// visible en continu). Cf. communaute/(shell)/layout.tsx.
// ============================================================================

interface CommunityPageProps {
  postsPromise: Promise<Post[]>;
  conversationsPromise: Promise<Conversation[]>;
}

export function CommunityPage({
  postsPromise,
  conversationsPromise,
}: CommunityPageProps) {
  const { role, setRole, feedState, setFeedState } = useDevRoleToggle();
  const currentUser = useCurrentUser(role);
  const router = useRouter();
  const pathname = usePathname();

  // Vue active + conversation ouverte dérivées de l'URL (le layout partagé
  // garde ce composant monté entre les sous-routes ; on lit donc l'URL via
  // usePathname plutôt que via des props injectées par chaque page).
  //
  // ANTI-FREEZE #156 : conversationUsername DOIT être une string mémoïsée
  // stable. L'effet de résolution de MessagesLayout dépend de [conversationUsername] ;
  // une nouvelle référence à chaque render le relancerait → boucle infinie.
  const activeTab: Tab = pathname.startsWith("/communaute/messages")
    ? "messages"
    : "feed";
  const conversationUsername = useMemo(() => {
    const m = pathname.match(/^\/communaute\/messages\/(.+)$/);
    return m ? decodeURIComponent(m[1]!) : null;
  }, [pathname]);

  // Restore scroll position saved before navigating into a post detail
  useEffect(() => {
    try {
      const savedY = sessionStorage.getItem("communaute:scrollY");
      if (savedY) {
        sessionStorage.removeItem("communaute:scrollY");
        const y = parseInt(savedY, 10);
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
      }
    } catch {}
  }, []);
  // activeTab vient désormais de l'URL (prop), plus d'un state local — c'est
  // la route qui est la source de vérité. Le switcher navigue via router.push.
  const [activeTag, setActiveTag] = useState<TagFilter>("all");

  const tabItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabPillRef  = useRef<HTMLDivElement>(null);
  const tabLastClickedRef = useRef<number>(-1);
  // Onglet actif courant exposé via ref pour l'effet de re-mesure fonts.ready
  // (monté une seule fois) — tenu à jour dans le useLayoutEffect ci-dessous,
  // jamais pendant le render (règle react-hooks/refs).
  const activeTabRef = useRef(activeTab);

  const moveTabTo = useCallback((idx: number, animate: boolean) => {
    const el   = tabItemRefs.current[idx];
    const pill = tabPillRef.current;
    if (!el || !pill) return;
    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
      void pill.offsetWidth;
      pill.style.transition = prev;
    } else {
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
    }
  }, []);

  useLayoutEffect(() => {
    activeTabRef.current = activeTab;
    const idx = COMMUNITY_TABS.indexOf(activeTab);
    if (tabLastClickedRef.current === idx) {
      tabLastClickedRef.current = -1;
      return;
    }
    tabLastClickedRef.current = -1;
    moveTabTo(idx, false);
  }, [activeTab, moveTabTo]);

  // Re-mesure de la pilule APRÈS le 1ᵉʳ paint. La police SF Pro Display est en
  // `display: swap` : au premier rendu les onglets sont mesurés avec la police
  // de fallback, puis SF Pro la remplace → la largeur des onglets change. Sans
  // ce recalcul, la pilule garde des offsets périmés et la 1ʳᵉ glisse est
  // saccadée / décalée. Même garde que BottomNav.
  //
  // ⚠️ Monté UNE SEULE FOIS (pas de dep `activeTab`) : sinon un rAF snap ~1
  // frame après un clic couperait l'animation en cours. On lit l'onglet actif
  // courant via `activeTabRef` (tenue à jour dans le useLayoutEffect ci-dessus).
  useEffect(() => {
    const snap = () => moveTabTo(COMMUNITY_TABS.indexOf(activeTabRef.current), false);
    const raf = requestAnimationFrame(snap);
    let cancelled = false;
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => {
        if (!cancelled) snap();
      });
    }
    window.addEventListener("resize", snap);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", snap);
    };
  }, [moveTabTo]);

  const [showComposer, setShowComposer] = useState(false);
  // Optimistic posts ajoutés côté client juste après publication. À chaque
  // router.refresh() post-create, le Server Component recharge les posts
  // (nouvelle promesse) et l'optimistic est dédoublonné par id côté FeedList.
  const [optimisticPosts, setOptimisticPosts] = useState<Post[]>([]);
  const [publishing, startPublish] = useTransition();

  const canViewCommunity = true;
  if (!canViewCommunity) return <CommunityRestrictedPage />;

  function handlePublish(partial: Partial<Post>) {
    const titleNormalized = (partial.title ?? "").trim();
    const bodyNormalized = (partial.body ?? "").trim();
    if (!titleNormalized || !bodyNormalized) return;

    startPublish(async () => {
      const result = await createPostAction({
        title: titleNormalized,
        body: bodyNormalized,
        tag: partial.tag ?? "general",
        audience: partial.audience ?? "all",
        pinned: partial.pinned ?? false,
        pinned_until: null,
        image_url: partial.imageUrl ?? null,
        video_url: null,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const optimistic: Post = {
        id: result.postId,
        author: currentUser,
        tag: partial.tag ?? "general",
        audience: partial.audience ?? "all",
        title: titleNormalized,
        body: bodyNormalized,
        imageUrl: partial.imageUrl,
        pinned: partial.pinned ?? false,
        reactions: [],
        commentCount: 0,
        createdAt: new Date().toISOString(),
      };
      setOptimisticPosts((prev) => [optimistic, ...prev]);
      setShowComposer(false);
      toast.success("Post publié");
      router.refresh();
    });
  }

  return (
    <>
      {/* Lightbox globale : capte les CustomEvent 'nc-image-open' émis
          par linkify.tsx quand l'utilisateur clique sur une image inline
          dans un body de post / commentaire. */}
      <ImageLightboxRoot />

      {/* Global container card — CADRE toujours présent (jamais en Suspense) */}
      <div
        className="flex flex-col flex-1 min-h-0"
        data-fb-label="Encadré principal · Communauté"
        style={{
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 20,
          boxShadow: "var(--nc-shadow-3)",
          overflow: "hidden",
        }}
      >
        {/* iOS-style pill switcher — full width, sticky header */}
        <div
          className="shrink-0"
          data-fb-label="Switcher feed/messages · Communauté"
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-border-default)",
            background: "var(--color-surface-card)",
          }}
        >
          <div
            style={{
              display: "flex",
              background: "var(--color-surface-raised)",
              borderRadius: 10,
              padding: 3,
              gap: 2,
              position: "relative",
            }}
          >
            {/* Pill glissante */}
            <div
              ref={tabPillRef}
              aria-hidden
              className="nc-nav-pill"
              style={{
                position: "absolute",
                left: 0,
                background: "var(--nc-segmented-active-bg)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.08)",
                borderRadius: 8,
                pointerEvents: "none",
                willChange: "transform, width",
                zIndex: 0,
              }}
            />

            {(
              [
                { value: "feed" as Tab, label: "Feed", icon: MessagesSquare },
                { value: "messages" as Tab, label: "Messages", icon: MessageCircle },
              ]
            ).map(({ value, label, icon: Icon }, i) => {
              const isActive = activeTab === value;
              return (
                <button
                  key={value}
                  ref={(el) => { tabItemRefs.current[i] = el; }}
                  type="button"
                  data-fb-label={`Onglet « ${label} » · Switcher feed/messages`}
                  onClick={() => {
                    if (value === activeTab) return;
                    tabLastClickedRef.current = i;
                    moveTabTo(i, true);
                    // L'URL est la source de vérité : on navigue, le re-render
                    // de la route remonte CommunityPage avec le bon activeTab.
                    //
                    // startTransition : la navigation (montage/démontage de
                    // MessagesLayout ↔ feed) est marquée non-urgente → React
                    // n'interrompt plus l'animation de glisse de la pilule.
                    startTransition(() => {
                      router.push(value === "feed" ? "/communaute/feed" : "/communaute/messages");
                    });
                  }}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: isActive ? "var(--nc-segmented-active-bg)" : "transparent",
                    boxShadow: isActive
                      ? "0 1px 4px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.08)"
                      : "none",
                    color: isActive ? "var(--nc-segmented-active-text)" : "var(--color-text-muted)",
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    cursor: "pointer",
                    position: "relative",
                    zIndex: 1,
                    transition: "background 200ms var(--nc-ease), box-shadow 200ms var(--nc-ease), color 200ms ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                  {label}
                  {/* Compteur non-lus (Messages) : alimenté par les conversations
                      en Suspense → n'empêche jamais le cadre de s'afficher. */}
                  {value === "messages" && (
                    <Suspense fallback={null}>
                      <UnreadBadge conversationsPromise={conversationsPromise} />
                    </Suspense>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content — SEULE partie data-dépendante, en Suspense */}
        {activeTab === "feed" ? (
          <>
            {/* Tag filters + new post — sticky header (cadre, pas de data) */}
            <div className="shrink-0" style={{ padding: "16px 16px 12px" }}>
              <FeedTagFilters
                active={activeTag}
                onChange={setActiveTag}
                onNewPost={() => setShowComposer(true)}
                isAdmin={currentUser.role === "admin"}
              />
            </div>

            <Suspense fallback={<FeedListFallback />}>
              <FeedList
                postsPromise={postsPromise}
                optimisticPosts={optimisticPosts}
                activeTag={activeTag}
                currentUser={currentUser}
                devRole={role}
                feedState={feedState}
                onRetry={() => setFeedState("full")}
              />
            </Suspense>
          </>
        ) : (
          <Suspense fallback={<MessagesFallback />}>
            <MessagesContent
              conversationsPromise={conversationsPromise}
              currentUser={currentUser}
              devRole={role}
              conversationUsername={conversationUsername}
            />
          </Suspense>
        )}
      </div>

      {/* FAB mobile — accès rapide à l'éditeur de post, sous le pouce,
          au-dessus de la BottomNav. Masqué sur desktop (bouton inline). */}
      {activeTab === "feed" && (
        <button
          type="button"
          onClick={() => setShowComposer(true)}
          className="nc-feed-fab md:hidden"
          data-fb-label="Bouton Nouveau post · Feed"
          aria-label="Nouveau post"
        >
          <SquarePen size={22} strokeWidth={2.25} />
        </button>
      )}

      {showComposer && (
        <PostComposerModal
          currentUser={currentUser}
          onClose={() => setShowComposer(false)}
          onPublish={handlePublish}
          publishing={publishing}
        />
      )}

      <DevRoleToggle
        role={role}
        onRoleChange={setRole}
        feedState={feedState}
        onFeedStateChange={setFeedState}
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Compteur de messages non-lus — `use()` la promesse des conversations. Rendu
// dans un <Suspense fallback={null}> : le switcher s'affiche immédiatement, le
// badge n'apparaît qu'une fois les conversations chargées.
// ────────────────────────────────────────────────────────────────────────────
function UnreadBadge({
  conversationsPromise,
}: {
  conversationsPromise: Promise<Conversation[]>;
}) {
  const conversations = use(conversationsPromise);
  const unread = conversations.reduce((s, c) => s + c.unreadCount, 0);
  if (unread <= 0) return null;
  return (
    <span
      style={{
        minWidth: 16,
        height: 16,
        background: "var(--color-brand)",
        color: "#fff",
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 4px",
      }}
    >
      {unread}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Liste du feed — `use()` la promesse des posts, fusionne avec les optimistic,
// filtre/trie, et porte la zone scrollable + la redirection wheel desktop.
// (Logique inchangée, simplement déplacée hors du cadre pour être mise en
// Suspense sans bloquer l'affichage du switcher / des filtres.)
// ────────────────────────────────────────────────────────────────────────────
function FeedList({
  postsPromise,
  optimisticPosts,
  activeTag,
  currentUser,
  devRole,
  feedState,
  onRetry,
}: {
  postsPromise: Promise<Post[]>;
  optimisticPosts: Post[];
  activeTag: TagFilter;
  currentUser: User;
  devRole: DevRole;
  feedState: DevFeedState;
  onRetry: () => void;
}) {
  const initialPosts = use(postsPromise);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Desktop only: redirect wheel events fired over the page (rose halo zone,
  // header, etc.) into the inner scroll container so the feed scrolls même
  // quand le curseur est hors de la carte blanche.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const pageEl = scroller.closest(".nc-page-halo");
    if (!pageEl) return;

    function onWheel(e: Event) {
      const el = scrollRef.current;
      if (!el) return;
      const we = e as WheelEvent;
      if (window.matchMedia("(max-width: 767px)").matches) return;
      if (we.deltaY === 0) return;
      if (el.contains(we.target as Node)) return;
      el.scrollTop += we.deltaY;
      we.preventDefault();
    }

    pageEl.addEventListener("wheel", onWheel, { passive: false });
    return () => pageEl.removeEventListener("wheel", onWheel);
  }, []);

  // Merge optimistic + initialPosts, dédoublonne par id, filtre par tag,
  // trie (pinned d'abord puis date desc).
  const allPosts = useMemo(() => {
    const seen = new Set<string>();
    const merged: Post[] = [];
    for (const p of [...optimisticPosts, ...initialPosts]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }
    const filtered = activeTag === "all"
      ? merged
      : merged.filter((p) => p.tag === activeTag);
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [optimisticPosts, initialPosts, activeTag]);

  const showSkeleton = feedState === "loading";
  const showError = feedState === "error";

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      data-fb-label="Liste · Feed"
      style={{ padding: "0 16px 16px" }}
    >
      {showSkeleton ? (
        <FeedSkeletonState />
      ) : showError ? (
        <FeedErrorState onRetry={onRetry} />
      ) : (
        <FeedPostList
          posts={feedState === "empty" ? [] : allPosts}
          currentUser={currentUser}
          devRole={devRole}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Conteneur messagerie — `use()` la promesse des conversations puis monte
// MessagesLayout. conversationUsername reste mémoïsé côté parent (anti-freeze
// #156), passé tel quel.
// ────────────────────────────────────────────────────────────────────────────
function MessagesContent({
  conversationsPromise,
  currentUser,
  devRole,
  conversationUsername,
}: {
  conversationsPromise: Promise<Conversation[]>;
  currentUser: User;
  devRole: DevRole;
  conversationUsername: string | null;
}) {
  const initialConversations = use(conversationsPromise);
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <MessagesLayout
        currentUser={currentUser}
        devRole={devRole}
        initialConversations={initialConversations}
        conversationUsername={conversationUsername}
        embedded
      />
    </div>
  );
}

// ── Fallbacks Suspense — occupent la zone de contenu (flex-1) le temps que les
//    données streament. Le cadre (switcher/filtres) reste, lui, déjà affiché.
const skPulse: React.CSSProperties = {
  animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
  background: "var(--color-surface-raised)",
  borderRadius: "var(--nc-radius-xs)",
};

function FeedListFallback() {
  return (
    <div
      className="flex-1 min-h-0 overflow-hidden"
      style={{ padding: "0 16px 16px" }}
      aria-hidden
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            style={{
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 16,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ ...skPulse, width: 36, height: 36, borderRadius: "50%", flexShrink: 0, animationDelay: `${i * 60}ms` }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                <div style={{ ...skPulse, height: 13, width: "35%", animationDelay: `${i * 60 + 30}ms` }} />
                <div style={{ ...skPulse, height: 11, width: "20%", animationDelay: `${i * 60 + 50}ms` }} />
              </div>
            </div>
            <div style={{ ...skPulse, height: 14, width: "90%", animationDelay: `${i * 60 + 60}ms` }} />
            <div style={{ ...skPulse, height: 14, width: "70%", animationDelay: `${i * 60 + 80}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesFallback() {
  return (
    <div
      className="flex-1 min-h-0 overflow-hidden"
      style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}
      aria-hidden
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px" }}>
          <div style={{ ...skPulse, width: 40, height: 40, borderRadius: "50%", flexShrink: 0, animationDelay: `${i * 60}ms` }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <div style={{ ...skPulse, height: 13, width: "30%", animationDelay: `${i * 60 + 30}ms` }} />
            <div style={{ ...skPulse, height: 11, width: "55%", animationDelay: `${i * 60 + 50}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
