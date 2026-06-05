"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  CalendarCheck,
  TrendingUp,
  CalendarPlus,
  CalendarX,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

import { DevStateSwitcher } from "@/shared/components/coaching/DevStateSwitcher";
import { CoachingHeader } from "@/shared/components/coaching/CoachingHeader";
import { CoachingCTACard } from "@/shared/components/coaching/CoachingCTACard";
import { UpcomingCallsSection } from "@/shared/components/coaching/UpcomingCallsSection";
import { PastCallsSection } from "@/shared/components/coaching/PastCallsSection";
import { FreeTeaserPanel } from "@/shared/components/coaching/FreeTeaserPanel";
import { FilloutModal } from "@/shared/components/coaching/FilloutModal";
import {
  type UserState,
  type MockCall,
  MOCK_UPCOMING_CALLS,
  MOCK_PAST_CALLS,
  MOCK_EXPIRED_PAST_CALLS,
} from "@/shared/lib/mock/coaching";
import { FILLOUT_URLS } from "@/shared/lib/mock/fillout";
import { ensureNotionMemberPage } from "@/modules/coaching/server/ensureNotionMemberPage";

const STORAGE_KEY = "nc_coaching_dev_state";

// ─── Header config ───────────────────────────────────────────────────────────

interface HeaderConfig {
  title: string;
  subtitle: string;
  includedPill?: string;
  nextCallPill?: string;
}

function getHeaderConfig(state: UserState): HeaderConfig {
  switch (state) {
    case "free":
      return {
        title: "Tes appels de coaching",
        subtitle:
          "Le coaching individuel est réservé aux membres de l'Accompagnement. Tu peux d'abord échanger avec moi sur ton projet pour voir si c'est fait pour toi.",
      };
    case "formation_0_calls":
      return {
        title: "Ton coaching inclus",
        subtitle:
          "Ton offre Formation inclut un appel de coaching avec Théo ou Noah. C'est l'occasion de débloquer le point qui te fait le plus perdre du temps en ce moment.",
        includedPill: "1 coaching inclus dans ton offre",
      };
    case "formation_1_call":
      return {
        title: "Tu as utilisé ton coaching inclus",
        subtitle:
          "Ton appel avec Théo est passé. Si tu veux aller plus loin et accéder à des coachings réguliers pour construire ton activité de consultant Notion, on peut en parler ensemble.",
      };
    case "accompagnement_eligible":
      return {
        title: "Tous tes appels",
        subtitle:
          "Tu as réservé 12 coachings au total, 1 sont réservables cette semaine.",
        nextCallPill: "Ton prochain coaching est dans 3 jours avec Théo",
      };
    case "accompagnement_not_eligible":
      return {
        title: "Tous tes appels",
        subtitle:
          "Tu as réservé 14 coachings au total, tu pourras planifier de nouveaux coachings à partir de la semaine prochaine.",
        nextCallPill: "Ton prochain coaching est dans 1 jour avec Noah",
      };
    case "accompagnement_expired":
      return {
        title: "Ton accompagnement est terminé",
        subtitle:
          "Tu as terminé tes 120 jours d'accompagnement. Tu peux toujours consulter tes résumés de coachings passés ci-dessous. Si tu veux continuer à être accompagné pour structurer ton activité, on peut en parler.",
      };
  }
}

// ─── CTA card config ─────────────────────────────────────────────────────────

interface CTAConfig {
  icon: LucideIcon;
  iconOpacity?: number;
  secondaryText: string;
  buttonText: string;
  disabled?: boolean;
  disabledTooltip?: string;
  onButtonClick?: () => void;
}

function getCTAConfig(
  state: UserState,
  openModal: (url: string) => void,
  preparing: boolean,
): CTAConfig {
  // Texte affiché pendant que ensureNotionMemberPage tourne (~200-500ms en
  // moyenne — peut monter à 1-2s au tout premier clic d'un ancien membre
  // Notion qu'on doit matcher par email et tagger l'UUID).
  const prepLabel = "Préparation…";

  switch (state) {
    case "free":
      return {
        icon: Sparkles,
        secondaryText: "Discutons de ton projet",
        buttonText: preparing ? prepLabel : "Réserver un appel découverte",
        disabled: preparing,
        onButtonClick: () => openModal(FILLOUT_URLS.sales),
      };
    case "formation_0_calls":
      return {
        icon: CalendarCheck,
        secondaryText: "Bloque ton créneau",
        buttonText: preparing ? prepLabel : "Réserver mon coaching",
        disabled: preparing,
        onButtonClick: () => openModal(FILLOUT_URLS.coaching),
      };
    case "formation_1_call":
      return {
        icon: TrendingUp,
        secondaryText: "Passe au niveau supérieur",
        buttonText: preparing ? prepLabel : "Passer à l'Accompagnement",
        disabled: preparing,
        onButtonClick: () => openModal(FILLOUT_URLS.sales),
      };
    case "accompagnement_eligible":
      return {
        icon: CalendarPlus,
        secondaryText: "Avance sur ton projet",
        buttonText: preparing ? prepLabel : "Réserver un coaching",
        disabled: preparing,
        onButtonClick: () => openModal(FILLOUT_URLS.coaching),
      };
    case "accompagnement_not_eligible":
      return {
        icon: CalendarX,
        iconOpacity: 0.5,
        secondaryText: "Tu as atteint ta limite hebdomadaire",
        buttonText: "Quota hebdo atteint",
        disabled: true,
        disabledTooltip:
          "Tu peux réserver à nouveau lundi prochain.\nTu peux planifier sans limite le weekend.",
      };
    case "accompagnement_expired":
      return {
        icon: RefreshCw,
        secondaryText: "Renouvelle ton accompagnement",
        buttonText: preparing ? prepLabel : "Renouveler mon accompagnement",
        disabled: preparing,
        onButtonClick: () => openModal(FILLOUT_URLS.sales),
      };
  }
}

// ─── Right column config ──────────────────────────────────────────────────────

interface RightColumnConfig {
  showUpcoming: boolean;
  upcomingCalls: MockCall[];
  pastCalls: MockCall[];
  pastBannerText?: string;
}

function getRightColumnConfig(state: UserState): RightColumnConfig {
  switch (state) {
    case "free":
      return { showUpcoming: false, upcomingCalls: [], pastCalls: [] };
    case "formation_0_calls":
      return {
        showUpcoming: true,
        upcomingCalls: [],
        pastCalls: [],
      };
    case "formation_1_call":
      return {
        showUpcoming: true,
        upcomingCalls: [],
        pastCalls: MOCK_PAST_CALLS.slice(0, 1),
        pastBannerText: "Tu as utilisé ton coaching inclus le 12 mars 2026.",
      };
    case "accompagnement_eligible":
      return {
        showUpcoming: true,
        upcomingCalls: MOCK_UPCOMING_CALLS,
        pastCalls: MOCK_PAST_CALLS,
      };
    case "accompagnement_not_eligible":
      return {
        showUpcoming: true,
        upcomingCalls: MOCK_UPCOMING_CALLS,
        pastCalls: MOCK_PAST_CALLS,
      };
    case "accompagnement_expired":
      return {
        showUpcoming: false,
        upcomingCalls: [],
        pastCalls: MOCK_EXPIRED_PAST_CALLS,
        pastBannerText: "Accompagnement terminé le 18 février 2026",
      };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PrefillUserInfo {
  id: string | null;
  mail: string | null;
  prenom: string | null;
  nom: string | null;
}

const EMPTY_USER_INFO: PrefillUserInfo = {
  id: null,
  mail: null,
  prenom: null,
  nom: null,
};

export default function CoachingPage() {
  const [userState, setUserState] =
    useState<UserState>("accompagnement_eligible");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [userInfo, setUserInfo] = useState<PrefillUserInfo>(EMPTY_USER_INFO);

  // Restore persisted dev state
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as UserState | null;
    if (saved) setUserState(saved);
  }, []);

  function handleStateChange(state: UserState) {
    setUserState(state);
    localStorage.setItem(STORAGE_KEY, state);
  }

  async function openModal(url: string) {
    // Garde contre les doubles clics rapides.
    if (preparing) return;
    setPreparing(true);

    // Résout (ou crée / matche par email) la page Notion Membres de l'user
    // courant. Le param `id` envoyé à Fillout est l'UUID Supabase (clé
    // universelle) — Fillout filtre le RecordPicker sur la colonne
    // "UUID Supabase" de la DB Notion Membres pour pré-sélectionner l'user.
    // Tout en best-effort : si Notion KO, on ouvre quand même Fillout avec
    // l'UUID Supabase (Fillout fera le match plus tard quand Notion sera back).
    try {
      const result = await ensureNotionMemberPage();
      if (result.ok) {
        setUserInfo({
          id: result.supabaseUuid,
          mail: result.email,
          prenom: result.firstName,
          nom: result.lastName,
        });
      } else {
        // Pas authentifié ou profile introuvable — on ouvre Fillout vide.
        setUserInfo(EMPTY_USER_INFO);
      }
    } catch (err) {
      console.error("[coaching] ensureNotionMemberPage threw:", err);
      setUserInfo(EMPTY_USER_INFO);
    }

    setModalUrl(url);
    setModalOpen(true);
    setPreparing(false);
  }

  const headerConfig = getHeaderConfig(userState);
  const ctaConfig = getCTAConfig(userState, openModal, preparing);
  const rightConfig = getRightColumnConfig(userState);
  const isExpired = userState === "accompagnement_expired";
  const allCallsEmpty =
    rightConfig.upcomingCalls.length === 0 && rightConfig.pastCalls.length === 0;

  return (
    <>
      <div className="nc-page-halo" style={{ minHeight: "100dvh" }}>
        <main style={{ position: "relative", zIndex: 1 }}>
          {/* DEV ONLY — à retirer au branchement backend */}
          <div
            className="pt-[84px] md:pt-[88px]"
            style={{ position: "sticky", top: 0, zIndex: 39 }}
          >
            <DevStateSwitcher
              currentState={userState}
              onChange={handleStateChange}
            />
          </div>

          {/* Main content */}
          <div
            className="px-4 pt-6 pb-[100px] md:px-10 md:pt-8 md:pb-12"
            style={{ maxWidth: 1100, margin: "0 auto" }}
          >
            <div className="nc-mode-in">
              <CoachingHeader {...headerConfig} />
            </div>

            {/* Single-column layout */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 28 }}>
              {/* CTA card — horizontal full-width */}
              <CoachingCTACard {...ctaConfig} />

              {/* Calls sections */}
              {userState === "free" ? (
                <FreeTeaserPanel />
              ) : allCallsEmpty ? (
                <div
                  data-fb-label="Encadré aucun appel · Coaching"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 20,
                    padding: "48px 32px",
                    textAlign: "center",
                    boxShadow: "var(--nc-shadow-3)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/e2eb0709f7ba004d73ce96e041865c95deeaf80a/People/Eyes.webp"
                    alt=""
                    width={96}
                    height={96}
                    style={{ display: "block", margin: "0 auto 20px" }}
                  />
                  <p
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: "var(--color-text-secondary)",
                      margin: 0,
                      lineHeight: 1.45,
                    }}
                  >
                    On s&apos;est jamais appelé,<br />ça serait peut-être l&apos;occasion
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {rightConfig.showUpcoming && (
                    <UpcomingCallsSection
                      calls={rightConfig.upcomingCalls}
                      emptyMessage="Aucun coaching prévu pour le moment."
                    />
                  )}
                  <PastCallsSection
                    calls={rightConfig.pastCalls}
                    bannerText={rightConfig.pastBannerText}
                    archived={isExpired}
                  />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Fillout modal — outside nc-page-halo */}
      <FilloutModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        baseUrl={modalUrl}
        id={userInfo.id}
        mail={userInfo.mail}
        prenom={userInfo.prenom}
        nom={userInfo.nom}
      />
    </>
  );
}
