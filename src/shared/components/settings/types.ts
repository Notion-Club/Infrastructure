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
  // Facturation (OPS-129) — adresse INDIVIDUELLE + type + lien entreprise.
  billing_type: "individual" | "company" | null;
  billing_company_id: string | null;
  billing_name: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  billing_country: string | null;
};

// Fiche entreprise embarquée (relation profiles.billing_company_id → companies).
// Les champs société (SIRET/TVA) vivent ici, jamais sur le contact.
export type CompanyEmbed = {
  name: string;
  siret: string | null;
  vat_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
};

// Ce que charge SettingsClient : profil + fiche entreprise liée (ou null).
export type ProfileWithBilling = ProfileRow & {
  company: CompanyEmbed | null;
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
