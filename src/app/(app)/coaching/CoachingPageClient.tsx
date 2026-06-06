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
  type CallCardData,
} from "@/shared/lib/mock/coaching";
import { FILLOUT_URLS } from "@/shared/lib/mock/fillout";
import { ensureNotionMemberPage } from "@/modules/coaching/server/ensureNotionMemberPage";
import { type NextCallPillData } from "@/shared/components/coaching/NextCallPill";
import { type CoachingEligibility } from "@/modules/coaching/server/eligibility";

// Forme utilisée à la fois par les mocks (DevStateSwitcher) et les vraies
// données Notion. CallCardData a `host: string` (élargi vs MockCall qui
// contraignait à "Théo" | "Noah") + champs optionnels notion_page_id /
// fathom_url qui activent le bouton transcription côté CallCard.
type CallLike = CallCardData;

interface RealCallsPayload {
  upcoming: CallLike[];
  past: CallLike[];
}

interface CoachingPageClientProps {
  realCalls: RealCallsPayload;
  // Prochain appel à venir lu depuis Notion (status non renseigné + date ≥ now).
  // `null` quand il n'y a pas d'appel planifié — la pill du header est masquée.
  nextCall: NextCallPillData | null;
  // Éligibilité hebdo + message contextuel — lus depuis les formules Notion
  // "Éligible au Call" et "Alerte Calls". `null` si pas de page Membre Notion
  // matchée → l'UI retombe sur le comportement statique des mocks.
  eligibility: CoachingEligibility | null;
}

const STORAGE_KEY = "nc_coaching_dev_state";

// Les états dev qui doivent afficher les vraies données plutôt que les mocks.
// Tous les états où l'user a des coachings (passés ou à venir) — la même
// source de vérité Notion peuple les sections. Seuls `free` et
// `formation_0_calls` restent en mocks (états où la liste est par définition
// vide, et où Théo veut tester le rendu "aucun appel").
const REAL_DATA_STATES: ReadonlySet<UserState> = new Set([
  "formation_1_call",
  "accompagnement_eligible",
  "accompagnement_not_eligible",
  "accompagnement_expired",
] as UserState[]);

// ─── Header config ───────────────────────────────────────────────────────────

interface HeaderConfig {
  title: string;
  subtitle: string;
  includedPill?: string;
  // Mock legacy — utilisé pour les états dev sans data live (DevStateSwitcher).
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
  upcomingCalls: CallLike[];
  pastCalls: CallLike[];
  pastBannerText?: string;
}

function getRightColumnConfig(
  state: UserState,
  realCalls: RealCallsPayload,
): RightColumnConfig {
  // États où les vraies données Notion du user sont affichées. Le banner et
  // la visibilité de la section upcoming dépendent du state — l'état dérive
  // du contexte business (formation finie, accompagnement actif, expiré),
  // pas du contenu réel des calls.
  if (REAL_DATA_STATES.has(state)) {
    switch (state) {
      case "formation_1_call":
        return {
          showUpcoming: false, // formation : 1 seul call inclus, jamais d'upcoming après
          upcomingCalls: [],
          pastCalls: realCalls.past,
          pastBannerText: "Tu as utilisé ton coaching inclus.",
        };
      case "accompagnement_expired":
        return {
          showUpcoming: false, // accompagnement terminé, plus de futurs calls
          upcomingCalls: [],
          pastCalls: realCalls.past,
          pastBannerText: "Accompagnement terminé.",
        };
      // accompagnement_eligible / not_eligible : section upcoming visible
      default:
        return {
          showUpcoming: true,
          upcomingCalls: realCalls.upcoming,
          pastCalls: realCalls.past,
        };
    }
  }

  switch (state) {
    case "free":
      return { showUpcoming: false, upcomingCalls: [], pastCalls: [] };
    case "formation_0_calls":
      return {
        showUpcoming: true,
        upcomingCalls: [],
        pastCalls: [],
      };
    default:
      return { showUpcoming: false, upcomingCalls: [], pastCalls: [] };
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

export default function CoachingPageClient({
  realCalls,
  nextCall,
  eligibility,
}: CoachingPageClientProps) {
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
  const ctaConfigBase = getCTAConfig(userState, openModal, preparing);
  const rightConfig = getRightColumnConfig(userState, realCalls);

  // Override CTA avec la formule Notion "Éligible au Call" pour les états
  // formation_0_calls / accompagnement_eligible / accompagnement_not_eligible.
  //
  // Quand eligibility est dispo et que la formule Notion dit "pas éligible",
  // on grise le bouton et on remplace le label par "Quota hebdo atteint".
  // Le message "Alerte Calls" (week-end / fin de suivi / quota restant) est
  // affiché en tooltip — c'est Théo qui le rédige côté Notion, on ne fait que
  // l'afficher.
  //
  // États où on N'override PAS :
  //  - free / formation_1_call / accompagnement_expired : CTA orienté commerce
  //    (réserver découverte, passer à l'Accompagnement, renouveler), pas
  //    soumis au quota hebdo.
  const isBookingState =
    userState === "formation_0_calls" ||
    userState === "accompagnement_eligible" ||
    userState === "accompagnement_not_eligible";

  const ctaConfig =
    isBookingState && eligibility
      ? {
          ...ctaConfigBase,
          // Si pas éligible → grisé. Sinon on garde le state du base (qui peut
          // être disabled pendant preparing).
          disabled: !eligibility.isEligible || ctaConfigBase.disabled,
          iconOpacity: !eligibility.isEligible ? 0.5 : ctaConfigBase.iconOpacity,
          icon: !eligibility.isEligible ? CalendarX : ctaConfigBase.icon,
          buttonText: !eligibility.isEligible
            ? "Quota hebdo atteint"
            : ctaConfigBase.buttonText,
          secondaryText: !eligibility.isEligible
            ? "Tu as atteint ta limite hebdomadaire"
            : ctaConfigBase.secondaryText,
          disabledTooltip: !eligibility.isEligible
            ? eligibility.alertMessage ||
              "Tu peux réserver à nouveau lundi prochain.\nTu peux planifier sans limite le weekend."
            : undefined,
        }
      : ctaConfigBase;

  // Pill prochain coaching :
  //  - États accompagnement avec data Notion → vrai objet (modale détail live).
  //  - Autres états (free / formation / mocks DevStateSwitcher) → libellé mock.
  //
  // Quand l'user est sur un état accompagnement mais que Notion n'a rien à
  // venir, on laisse la pill mock (DevStateSwitcher) pour ne pas casser le
  // démo de Théo sur ces états — sinon l'aperçu visuel disparaît pendant les
  // tests UI.
  const headerNextCall: NextCallPillData | undefined =
    (userState === "accompagnement_eligible" ||
      userState === "accompagnement_not_eligible") &&
    nextCall
      ? nextCall
      : undefined;
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
              <CoachingHeader {...headerConfig} nextCall={headerNextCall} />
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
