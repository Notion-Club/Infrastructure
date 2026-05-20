export type ProfileRow = {
  id: string;
  avatar_url: string | null;
  avatar_color: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  bio: string | null;
  phone: string | null;
  communication_email: string | null;
  notion_email: string | null;
};

export type AuthIdentity = {
  provider: string;
  identity_data?: Record<string, unknown> | null;
  identity_id?: string;
  id?: string;
};

export type AuthUserShape = {
  id: string;
  email: string;
  identities: AuthIdentity[] | null;
};

export type UserOffer = "free" | "formation" | "coaching";
