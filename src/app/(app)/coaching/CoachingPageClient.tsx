"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import { useRegisterDevTools } from "@/shared/components/dev/DevToolbox";
import { CoachingDevTools } from "@/shared/components/coaching/CoachingDevTools";
import {
  CoachingHeroBanner,
  type HeroButtonConfig,
} from "@/shared/components/coaching/CoachingHeroBanner";
import { CoachingHistory } from "@/shared/components/coaching/CoachingHistory";
import { EmptyCallsState } from "@/shared/components/coaching/EmptyCallsState";
import { UpcomingEmptyState } from "@/shared/components/coaching/UpcomingEmptyState";
import { FilloutModal } from "@/shared/components/coaching/FilloutModal";
import { type UserState, type CallCardData } from "@/shared/lib/mock/coaching";
import { FILLOUT_URLS } from "@/shared/lib/mock/fillout";
import { ensureNotionMemberPage } from "@/modules/coaching/server/ensureNotionMemberPage";
import { type NextCallPillData } from "@/shared/components/coaching/NextCallPill";
import { type CoachingEligibility } from "@/modules/coaching/server/eligibility";

// Forme utilisée à la fois par les mocks (DevStateSwitcher) et les vraies
// données Notion. CallCardData a `host: string` + champs optionnels Notion.
type CallLike = CallCardData;

interface RealCallsPayload {
  upcoming: CallLike[];
  past: CallLike[];
}

interface CoachingPageClientProps {
  realCalls: RealCallsPayload;
  nextCall: NextCallPillData | null;
  eligibility: CoachingEligibility | null;
}

const STORAGE_KEY = "nc_coaching_dev_state";

// Libellé du bouton pendant la préparation Fillout (ensureNotionMemberPage).
const LOADING_LABEL = "On charge…";

// États qui affichent les vraies données Notion plutôt que les mocks.
const REAL_DATA_STATES: ReadonlySet<UserState> = new Set([
  "formation_1_call",
  "accompagnement_eligible",
  "accompagnement_not_eligible",
  "accompagnement_expired",
] as UserState[]);

// ─── Hero (Slot 1) : copy statique par état ────────────────────────────────

interface HeroStatic {
  title: string;
  // Description statique. Les états dynamiques (accompagnement_*,
  // formation_1_call) la surchargent en live plus bas.
  description: string;
  accroche: string;
}

function getHeroStatic(state: UserState): HeroStatic {
  switch (state) {
    case "free":
      return {
        title: "Appels de coaching",
        description: "Les appels de coaching sont réservés aux membres",
        accroche: "1 coaching est offert",
      };
    case "formation_0_calls":
      return {
        title: "Le bouton d'urgence est disponible",
        description:
          "Ton offre inclut un appel de coaching offert avec Théo ou Nathan. Réserve le dès que tu as un point bloquant.",
        accroche: "Réserve ton appel d'urgence",
      };
    case "formation_1_call":
      return {
        title: "Le bouton d'urgence a été utilisé",
        description: "", // dynamique (date + host du call inclus)
        accroche: "Passe au niveau supérieur",
      };
    case "accompagnement_eligible":
      return {
        title: "Tous tes appels",
        description: "", // dynamique (total + réservables cette semaine)
        accroche: "On peut t'aider à avancer ?",
      };
    case "accompagnement_not_eligible":
      return {
        title: "Tous tes appels",
        description: "", // dynamique
        accroche: "Ta limite hebdomadaire est atteinte",
      };
    case "accompagnement_expired":
      return {
        title: "Ton accompagnement est terminé",
        description:
          "Les 120 jours d'accompagnement sont atteints, tu peux toujours consulter tes résumés des appels passés.",
        accroche: "Passe au niveau supérieur",
      };
  }
}

// ─── Hero (Slot 1) : bouton CTA par état ───────────────────────────────────

function getHeroButton(
  state: UserState,
  openModal: (url: string) => void,
  preparing: boolean,
): HeroButtonConfig {
  switch (state) {
    case "free":
      return {
        label: preparing ? LOADING_LABEL : "Réserver un coaching offert",
        disabled: preparing,
        onClick: () => openModal(FILLOUT_URLS.sales),
      };
    case "formation_0_calls":
      return {
        label: preparing ? LOADING_LABEL : "Voir les créneaux",
        disabled: preparing,
        onClick: () => openModal(FILLOUT_URLS.coaching),
      };
    case "formation_1_call":
      return {
        label: preparing ? LOADING_LABEL : "Rejoins l'accompagnement",
        disabled: preparing,
        onClick: () => openModal(FILLOUT_URLS.sales),
      };
    case "accompagnement_eligible":
      return {
        label: preparing ? LOADING_LABEL : "Réserve un appel.",
        disabled: preparing,
        onClick: () => openModal(FILLOUT_URLS.coaching),
      };
    case "accompagnement_not_eligible":
      return {
        label: "Calendrier indisponible",
        disabled: true,
        disabledTooltip:
          "Tu pourras réserver de nouveaux appels à partir de dimanche.",
      };
    case "accompagnement_expired":
      return {
        label: preparing ? LOADING_LABEL : "Réserver un appel avec Théo",
        disabled: preparing,
        onClick: () => openModal(FILLOUT_URLS.sales),
      };
  }
}

// ─── Slot 2 : config historique (vraies données vs mocks) ──────────────────

interface HistoryConfig {
  showUpcoming: boolean;
  upcomingCalls: CallLike[];
  pastCalls: CallLike[];
  archived: boolean;
}

function getHistoryConfig(
  state: UserState,
  realCalls: RealCallsPayload,
): HistoryConfig {
  if (REAL_DATA_STATES.has(state)) {
    switch (state) {
      case "formation_1_call":
        return {
          showUpcoming: false, // 1 seul call inclus, jamais d'upcoming après
          upcomingCalls: [],
          pastCalls: realCalls.past,
          archived: false,
        };
      case "accompagnement_expired":
        return {
          showUpcoming: false, // accompagnement terminé
          upcomingCalls: [],
          pastCalls: realCalls.past,
          archived: true,
        };
      default:
        return {
          showUpcoming: true,
          upcomingCalls: realCalls.upcoming,
          pastCalls: realCalls.past,
          archived: false,
        };
    }
  }

  switch (state) {
    case "formation_0_calls":
      return {
        showUpcoming: true,
        upcomingCalls: [],
        pastCalls: [],
        archived: false,
      };
    default:
      return {
        showUpcoming: false,
        upcomingCalls: [],
        pastCalls: [],
        archived: false,
      };
  }
}

// ─── Helpers de description dynamique ──────────────────────────────────────

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

// ─── Page ──────────────────────────────────────────────────────────────────

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

  const router = useRouter();
  // Incrémenté à la confirmation d'une réservation → bascule l'historique sur
  // l'onglet « à venir ».
  const [focusUpcomingNonce, setFocusUpcomingNonce] = useState(0);
  // Vrai pendant la fenêtre de synchro Fillout → Notion → skeleton shimmer.
  const [bookingPending, setBookingPending] = useState(false);
  // Vrai quand le pop-up courant est une replanification (confirmation par
  // redirection → fermeture auto sur navigation iframe).
  const [modalNavigateClose, setModalNavigateClose] = useState(false);
  const refreshTimersRef = useRef<number[]>([]);
  const pendingTimerRef = useRef<number | null>(null);

  // « Crawler » : à la confirmation, on rafraîchit la page (re-fetch Notion)
  // plusieurs fois espacées pour laisser le temps à Fillout de synchroniser le
  // changement (nouvel appel, date replanifiée, annulation).
  const runRefreshCrawler = useCallback(() => {
    router.refresh();
    refreshTimersRef.current.forEach((t) => window.clearTimeout(t));
    // Fenêtre large : la synchro Fillout → Notion peut prendre plusieurs
    // dizaines de secondes avant que la query ne reflète le changement.
    refreshTimersRef.current = [3000, 6000, 10000, 15000, 22000, 30000].map((d) =>
      window.setTimeout(() => router.refresh(), d),
    );
  }, [router]);

  const handleBookingConfirmed = useCallback(() => {
    setFocusUpcomingNonce((n) => n + 1);
    runRefreshCrawler();

    // Le skeleton d'attente n'a de sens que pour une vraie réservation : on
    // attend qu'une carte APPARAISSE. Une replanification / annulation
    // (`modalNavigateClose`) attend au contraire une mise à jour ou un RETRAIT
    // → pas de skeleton, sinon il masque l'état vide « Aucun appel n'est prévu »
    // pendant toute la fenêtre de synchro après une annulation.
    if (modalNavigateClose) return;
    setBookingPending(true);
    // Au-delà de la fenêtre, on arrête le skeleton (l'état vide reprend si rien
    // n'est arrivé). Le skeleton disparaît de toute façon dès qu'un appel
    // apparaît (la grille prend le dessus).
    if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = window.setTimeout(
      () => setBookingPending(false),
      33000,
    );
  }, [runRefreshCrawler, modalNavigateClose]);

  // Ouvre le pop-up de replanification / annulation avec l'URL Notion de
  // l'appel (lien Fillout / TidyCal) — même système de fermeture auto, plus la
  // fermeture sur navigation (la confirmation de replanif est une redirection).
  const openRescheduleModal = useCallback((url: string) => {
    setUserInfo(EMPTY_USER_INFO);
    setModalUrl(url);
    setModalNavigateClose(true);
    setModalOpen(true);
  }, []);

  // Filet de sécurité : à chaque fermeture du pop-up (auto ou manuelle), on
  // rafraîchit une fois — si la détection de soumission a échoué mais que
  // l'utilisateur a bien réservé puis fermé, l'appel apparaîtra quand même.
  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    router.refresh();
  }, [router]);

  useEffect(() => {
    return () => {
      refreshTimersRef.current.forEach((t) => window.clearTimeout(t));
      if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // setState via microtask : sort du corps synchrone de l'effect (eslint
    // react-hooks/set-state-in-effect) tout en restant immédiat à l'usage.
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const saved = localStorage.getItem(STORAGE_KEY) as UserState | null;
      if (saved) setUserState(saved);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStateChange = useCallback((state: UserState) => {
    setUserState(state);
    localStorage.setItem(STORAGE_KEY, state);
  }, []);

  // Enregistre le panneau d'outils dev (toggles des 6 états) dans la toolbox
  // de la barre de navigation. Mémoïsé pour ne pas ré-enregistrer à chaque
  // render. DEV ONLY — à retirer au branchement backend.
  const devPanel = useMemo(
    () => <CoachingDevTools current={userState} onChange={handleStateChange} />,
    [userState, handleStateChange],
  );
  useRegisterDevTools(devPanel);

  async function openModal(url: string) {
    if (preparing) return;
    setModalNavigateClose(false);
    setPreparing(true);
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

  const heroStatic = getHeroStatic(userState);
  const heroButtonBase = getHeroButton(userState, openModal, preparing);
  const historyConfig = getHistoryConfig(userState, realCalls);

  // Description dynamique des états accompagnement_* — total réel + réservables
  // cette semaine. Calcule en live, présentation uniquement.
  function computeAccompagnementDescription(): string {
    const allCalls = [...realCalls.upcoming, ...realCalls.past];
    const total = allCalls.length;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(now.getDate() + offsetToMonday);
    monday.setHours(0, 0, 0, 0);
    const sundayEnd = new Date(monday);
    sundayEnd.setDate(monday.getDate() + 6);
    sundayEnd.setHours(23, 59, 59, 999);

    const thisWeekCount = allCalls.filter((c) => {
      const t = new Date(c.date).getTime();
      return (
        !Number.isNaN(t) && t >= monday.getTime() && t <= sundayEnd.getTime()
      );
    }).length;

    const QUOTA = 2;
    const remaining = Math.max(0, QUOTA - thisWeekCount);

    if (userState === "accompagnement_not_eligible" || remaining === 0) {
      return `Tu as réservé ${total} appels au total, tu pourras planifier de nouveaux appels à partir de la semaine prochaine.`;
    }
    const reservablesPart =
      remaining === 1
        ? "1 est réservable cette semaine"
        : `${remaining} sont réservables cette semaine`;
    return `Tu as réservé ${total} appels au total, ${reservablesPart}.`;
  }

  // Description dynamique de formation_1_call — date + host du call inclus.
  function computeFormation1Description(): string {
    const lastPast = [...realCalls.past].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )[0];
    const datePart = lastPast ? formatDateShort(lastPast.date) : "";
    const hostPart = lastPast?.host ?? "Théo";
    const whenPart = datePart ? `a eu lieu le ${datePart}` : "a déjà eu lieu";
    return `L'appel inclus dans ton offre ${whenPart} avec ${hostPart}. Rejoins l'accompagnement pour accéder à des appels illimités avec les coachs.`;
  }

  // Résolution de la description finale (statique ou dynamique).
  let description = heroStatic.description;
  if (
    userState === "accompagnement_eligible" ||
    userState === "accompagnement_not_eligible"
  ) {
    description = computeAccompagnementDescription();
  } else if (userState === "formation_1_call") {
    description = computeFormation1Description();
  }

  // Override CTA via la formule Notion "Éligible au Call" pour les états de
  // réservation. Présentation pilotée par la donnée eligibility existante —
  // aucune logique de données réécrite.
  const isBookingState =
    userState === "formation_0_calls" ||
    userState === "accompagnement_eligible" ||
    userState === "accompagnement_not_eligible";

  // Formation uniquement + plafond d'offre atteint → upsell sales (et non un
  // grisage "quota hebdo" trompeur).
  const isFormationOnlyMaxed =
    isBookingState &&
    eligibility?.offer === "Formation uniquement" &&
    eligibility?.isEligible === false;

  let button: HeroButtonConfig = heroButtonBase;
  let accroche = heroStatic.accroche;

  if (isFormationOnlyMaxed) {
    button = {
      label: preparing ? LOADING_LABEL : "Rejoins l'accompagnement",
      disabled: preparing,
      onClick: () => openModal(FILLOUT_URLS.sales),
    };
    accroche = "Passe au niveau supérieur";
  } else if (isBookingState && eligibility && !eligibility.isEligible) {
    button = {
      label: "Calendrier indisponible",
      disabled: true,
      disabledTooltip:
        eligibility.alertMessage ||
        "Tu pourras réserver de nouveaux appels à partir de dimanche.",
    };
    accroche = "Ta limite hebdomadaire est atteinte";
  }

  // Pill prochain appel — états accompagnement avec data Notion live.
  const heroNextCall: NextCallPillData | undefined =
    (userState === "accompagnement_eligible" ||
      userState === "accompagnement_not_eligible") &&
    nextCall
      ? nextCall
      : undefined;

  // L'utilisateur peut réserver tant que le CTA de la bannière est actif.
  const canBook = !button.disabled;

  const allCallsEmpty =
    historyConfig.upcomingCalls.length === 0 &&
    historyConfig.pastCalls.length === 0;

  // Slot 2 :
  //  - free / formation_0_calls : liste vide par nature → état « Aucun appel à
  //    venir » (titre + skeleton, même design que le chargement transcription)
  //  - aucun appel du tout (accompagnement) → état vide « eyes »
  //  - sinon → historique (switcher passés / à venir)
  let slot2: React.ReactNode;
  if (userState === "free" || userState === "formation_0_calls") {
    slot2 = <UpcomingEmptyState eligible={canBook} />;
  } else if (allCallsEmpty) {
    slot2 = <EmptyCallsState />;
  } else {
    slot2 = (
      <CoachingHistory
        pastCalls={historyConfig.pastCalls}
        upcomingCalls={historyConfig.upcomingCalls}
        showUpcoming={historyConfig.showUpcoming}
        archived={historyConfig.archived}
        eligible={canBook}
        focusUpcomingNonce={focusUpcomingNonce}
        bookingPending={bookingPending}
        onReschedule={openRescheduleModal}
      />
    );
  }

  return (
    <>
      {/* Hauteur fixe sur desktop : l'encadré occupe l'espace dispo sous la
          topbar et le Slot 2 scrolle en interne (la taille de l'encadré ne
          grandit pas avec le nombre d'appels). Sur mobile : flux naturel. */}
      <div
        className="nc-page-halo md:flex md:flex-col"
        style={{ minHeight: "100dvh" }}
      >
        <main
          className="md:flex md:flex-1 md:min-h-0"
          style={{ position: "relative", zIndex: 1 }}
        >
          {/* Contenu principal */}
          <div
            className="px-4 pt-[64px] pb-[88px] md:px-10 md:pt-[104px] md:pb-8 w-full md:flex md:flex-col md:min-h-0"
            style={{ maxWidth: 1000, margin: "0 auto" }}
          >
            {/* Encadré global unique — Slot 1 (bannière) + Slot 2 (historique) */}
            <div
              className="nc-mode-in md:flex md:flex-col md:flex-1 md:min-h-0"
              data-fb-label="Encadré global · Coaching"
              style={{
                background: "var(--color-surface-card)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 20,
                boxShadow: "var(--nc-shadow-3)",
                padding: 14,
              }}
            >
              {/* Slot 1 — Bannière HERO (hauteur fixe) */}
              <div style={{ flexShrink: 0 }}>
                <CoachingHeroBanner
                  title={heroStatic.title}
                  description={description}
                  accroche={accroche}
                  button={button}
                  nextCall={heroNextCall}
                />
              </div>

              {/* Slot 2 — Historique / teaser / état vide (scroll interne) */}
              <div
                className="md:flex-1 md:min-h-0 md:overflow-y-auto"
                style={{ padding: "20px 10px 8px" }}
              >
                {slot2}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Fillout modal — hors de nc-page-halo */}
      <FilloutModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSubmitted={handleBookingConfirmed}
        autoCloseOnNavigate={modalNavigateClose}
        baseUrl={modalUrl}
        id={userInfo.id}
        mail={userInfo.mail}
        prenom={userInfo.prenom}
        nom={userInfo.nom}
      />
    </>
  );
}
