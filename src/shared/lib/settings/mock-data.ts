import type {
  AuthUserShape,
  ProfileRow,
  UserOffer,
} from "@/shared/components/settings/types";

export const MOCK_PROFILE: ProfileRow = {
  id: "mock-user-1",
  avatar_url: null,
  avatar_color: null,
  display_name: "Théo Martin",
  first_name: "Théo",
  last_name: "Martin",
  username: "theo-martin",
  bio: null,
  phone: "+33 6 12 34 56 78",
  communication_email: null,
  notion_email: "theo.notion@notionclub.fr",
};

export const MOCK_AUTH_USER: AuthUserShape = {
  id: "mock-user-1",
  email: "theo@notionclub.fr",
  identities: [{ provider: "email", identity_data: { email: "theo@notionclub.fr" } }],
};

export const MOCK_USER_OFFER: UserOffer = "coaching";

export type SubscriptionStatus = "active" | "expired" | "pending";

export type SubscriptionData = {
  planName: string;
  status: SubscriptionStatus;
  priceLabel: string;
  renewalDateLabel: string;
};

export type PaymentHistoryItem = {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: "paid" | "refunded";
};

export type PaymentMethod = {
  brand: "Visa" | "Mastercard";
  last4: string;
  expiry: string;
};

export const MOCK_SUBSCRIPTION: SubscriptionData = {
  planName: "Notion Club Pro",
  status: "active",
  priceLabel: "97 € / mois",
  renewalDateLabel: "18 juin 2026",
};

export const MOCK_PAYMENT_HISTORY: PaymentHistoryItem[] = [
  {
    id: "inv_2026_05",
    date: "18 mai 2026",
    description: "Notion Club Pro — Mai 2026",
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
  {
    id: "inv_2026_03",
    date: "18 mars 2026",
    description: "Notion Club Pro — Mars 2026",
    amount: "97,00 €",
    status: "paid",
  },
];

export const MOCK_PAYMENT_METHOD: PaymentMethod = {
  brand: "Visa",
  last4: "4242",
  expiry: "08/28",
};
