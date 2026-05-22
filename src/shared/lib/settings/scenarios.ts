import type {
  PaymentHistoryItem,
  PaymentMethod,
  SubscriptionData,
} from "./mock-data";
import {
  MOCK_PAYMENT_HISTORY,
  MOCK_PAYMENT_METHOD,
  MOCK_SUBSCRIPTION,
} from "./mock-data";

export type ScenarioId =
  | "default"
  | "expired"
  | "pending"
  | "never_paid"
  | "failed_payments"
  | "upcoming_payment";

export type Scenario = {
  id: ScenarioId;
  label: string;
  description: string;
  subscription: SubscriptionData;
  history: PaymentHistoryItem[];
  paymentMethod: PaymentMethod | null;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "default",
    label: "Abonnement actif",
    description: "Cas nominal : abonnement payé et renouvelable.",
    subscription: MOCK_SUBSCRIPTION,
    history: MOCK_PAYMENT_HISTORY,
    paymentMethod: MOCK_PAYMENT_METHOD,
  },
  {
    id: "expired",
    label: "Abonnement expiré",
    description:
      "L'abonnement a expiré — le paiement n'a pas pu être renouvelé.",
    subscription: {
      ...MOCK_SUBSCRIPTION,
      status: "expired",
      renewalDateLabel: "12 mars 2026",
    },
    history: [
      {
        id: "inv_2026_03",
        date: "12 mars 2026",
        description: "Notion Club Pro — Mars 2026",
        amount: "97,00 €",
        status: "paid",
      },
    ],
    paymentMethod: MOCK_PAYMENT_METHOD,
  },
  {
    id: "pending",
    label: "Abonnement en attente",
    description: "Paiement initié, en attente de confirmation bancaire.",
    subscription: {
      planName: "Notion Club Pro",
      status: "pending",
      priceLabel: "97 € / mois",
      renewalDateLabel: "Souscription en cours",
    },
    history: [
      {
        id: "inv_pending",
        date: "Aujourd'hui",
        description: "Notion Club Pro — Mai 2026",
        amount: "97,00 €",
        status: "paid",
      },
    ],
    paymentMethod: MOCK_PAYMENT_METHOD,
  },
  {
    id: "never_paid",
    label: "Aucun paiement",
    description: "L'utilisateur n'a jamais souscrit — pas d'historique.",
    subscription: {
      planName: "Notion Club — Offre découverte",
      status: "pending",
      priceLabel: "Gratuit",
      renewalDateLabel: "Aucune souscription active",
    },
    history: [],
    paymentMethod: null,
  },
  {
    id: "failed_payments",
    label: "Paiements échoués",
    description: "Le dernier paiement a échoué — relance en cours.",
    subscription: {
      ...MOCK_SUBSCRIPTION,
      status: "expired",
      renewalDateLabel: "18 mai 2026",
    },
    history: [
      {
        id: "inv_2026_05_failed",
        date: "18 mai 2026",
        description: "Notion Club Pro — Mai 2026 (échec)",
        amount: "97,00 €",
        status: "refunded",
      },
      {
        id: "inv_2026_04",
        date: "18 avril 2026",
        description: "Notion Club Pro — Avril 2026",
        amount: "97,00 €",
        status: "paid",
      },
      {
        id: "inv_2026_03",
        date: "18 mars 2026",
        description: "Notion Club Pro — Mars 2026",
        amount: "97,00 €",
        status: "paid",
      },
    ],
    paymentMethod: MOCK_PAYMENT_METHOD,
  },
  {
    id: "upcoming_payment",
    label: "Paiement à venir",
    description: "Le prochain paiement est planifié dans quelques jours.",
    subscription: {
      ...MOCK_SUBSCRIPTION,
      status: "active",
      renewalDateLabel: "23 mai 2026",
    },
    history: [
      {
        id: "inv_upcoming",
        date: "23 mai 2026",
        description: "Notion Club Pro — Mai 2026 (à venir)",
        amount: "97,00 €",
        status: "paid",
      },
      {
        id: "inv_2026_04",
        date: "18 avril 2026",
        description: "Notion Club Pro — Avril 2026",
        amount: "97,00 €",
        status: "paid",
      },
    ],
    paymentMethod: MOCK_PAYMENT_METHOD,
  },
];

export function findScenario(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;
}
