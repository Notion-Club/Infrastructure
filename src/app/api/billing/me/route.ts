// Billing API — GET renvoie les informations de facturation NORMALISÉES de
// l'utilisateur courant (OPS-129). C'est le contrat consommé par la génération
// de factures (#120) : un seul payload, que le membre facture en tant que
// particulier ou entreprise.
//
//   - Particulier : nom (billing_name ?? "prénom nom") + adresse du profil.
//   - Entreprise  : raison sociale + SIRET + TVA + adresse de la fiche société
//                   (table companies, jamais sur le contact).
//
// Lecture seule, RLS appliquée (anon key + JWT user). Aucun identifiant interne
// (id Notion / Supabase) n'est exposé.

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

const CORS = { "Content-Type": "application/json" };

type ProfileBillingRow = {
  first_name: string | null;
  last_name: string | null;
  communication_email: string | null;
  billing_type: "individual" | "company" | null;
  billing_name: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  billing_country: string | null;
  company:
    | {
        name: string;
        siret: string | null;
        vat_number: string | null;
        address_line1: string | null;
        address_line2: string | null;
        postal_code: string | null;
        city: string | null;
        country: string | null;
      }
    | Array<{
        name: string;
        siret: string | null;
        vat_number: string | null;
        address_line1: string | null;
        address_line2: string | null;
        postal_code: string | null;
        city: string | null;
        country: string | null;
      }>
    | null;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: CORS },
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "first_name, last_name, communication_email, billing_type, billing_name, billing_address_line1, billing_address_line2, billing_postal_code, billing_city, billing_country, company:billing_company_id ( name, siret, vat_number, address_line1, address_line2, postal_code, city, country )",
    )
    .eq("id", user.id)
    .maybeSingle<ProfileBillingRow>();

  if (error) {
    console.error("[billing/me] query error:", error.message);
    return NextResponse.json(
      { error: "Erreur interne" },
      { status: 500, headers: CORS },
    );
  }

  const fullName = [data?.first_name, data?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const email = data?.communication_email ?? user.email ?? "";

  const embedded = data?.company ?? null;
  const company = Array.isArray(embedded) ? (embedded[0] ?? null) : embedded;
  const isCompany = data?.billing_type === "company" && company != null;

  if (isCompany && company) {
    return NextResponse.json(
      {
        billingType: "company",
        name: company.name,
        email,
        address: {
          line1: company.address_line1 ?? "",
          line2: company.address_line2 ?? "",
          postalCode: company.postal_code ?? "",
          city: company.city ?? "",
          country: company.country ?? "FR",
        },
        company: {
          name: company.name,
          siret: company.siret ?? null,
          vatNumber: company.vat_number ?? null,
        },
      },
      { headers: CORS },
    );
  }

  return NextResponse.json(
    {
      billingType: "individual",
      name: data?.billing_name ?? fullName,
      email,
      address: {
        line1: data?.billing_address_line1 ?? "",
        line2: data?.billing_address_line2 ?? "",
        postalCode: data?.billing_postal_code ?? "",
        city: data?.billing_city ?? "",
        country: data?.billing_country ?? "FR",
      },
      company: null,
    },
    { headers: CORS },
  );
}
