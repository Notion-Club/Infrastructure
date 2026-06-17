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
