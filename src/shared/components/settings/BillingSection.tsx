"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import {
  updateBillingAction,
  updateProfileAction,
  SIRET_LENGTH,
} from "@/modules/settings";
import { SettingsCard } from "./SettingsCard";
import { CountrySelect } from "./CountrySelect";
import { PaymentsModal } from "./PaymentsModal";
import { InvoicePreview } from "./InvoicePreview";
import type { CompanyEmbed, ProfileRow } from "./types";

// ============================================================================
// BillingSection (OPS-129) — informations de facturation.
//
// Particulier : nom + adresse stockés sur le profil. Entreprise : raison
// sociale / SIRET / TVA + adresse stockés dans la table `companies` (jamais
// sur le contact), reliés via profiles.billing_company_id. L'enregistrement
// est atomique côté serveur (RPC save_billing_details).
// ============================================================================

type BillingSectionProps = {
  profile: ProfileRow;
  company: CompanyEmbed | null;
  isMocked: boolean;
};

function digits(v: string): string {
  return v.replace(/\D/g, "");
}

// Met en forme le SIRET selon le placeholder « 123 456 789 00012 » :
// groupes de 3-3-3-5 chiffres séparés par des espaces, plafonné à 14 chiffres.
// La saisie et le stockage restent normalisés (validation + RPC strippent les
// non-chiffres), c'est purement l'affichage du champ qui est espacé.
function formatSiret(v: string): string {
  const d = digits(v).slice(0, SIRET_LENGTH);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 14)]
    .filter(Boolean)
    .join(" ");
}

export function BillingSection({ profile, company, isMocked }: BillingSectionProps) {
  const initial = useMemo(() => {
    const isCompany = profile.billing_type === "company";
    return {
      isCompany,
      firstName: profile.first_name ?? "",
      lastName: profile.last_name ?? "",
      companyName: company?.name ?? "",
      siret: formatSiret(company?.siret ?? ""),
      vat: company?.vat_number ?? "",
      line1: (isCompany ? company?.address_line1 : profile.billing_address_line1) ?? "",
      line2: (isCompany ? company?.address_line2 : profile.billing_address_line2) ?? "",
      postalCode: (isCompany ? company?.postal_code : profile.billing_postal_code) ?? "",
      city: (isCompany ? company?.city : profile.billing_city) ?? "",
      country: (isCompany ? company?.country : profile.billing_country) ?? "FR",
    };
  }, [profile, company]);

  const [isCompany, setIsCompany] = useState(initial.isCompany);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [siret, setSiret] = useState(initial.siret);
  const [vat, setVat] = useState(initial.vat);
  const [line1, setLine1] = useState(initial.line1);
  const [line2, setLine2] = useState(initial.line2);
  const [postalCode, setPostalCode] = useState(initial.postalCode);
  const [city, setCity] = useState(initial.city);
  const [country, setCountry] = useState(initial.country);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);

  const errors = useMemo(() => {
    const e: Partial<Record<"companyName" | "siret" | "vat", string>> = {};
    if (isCompany) {
      if (companyName.trim().length === 0) e.companyName = "Raison sociale requise.";
      const s = digits(siret);
      if (s.length > 0 && s.length !== SIRET_LENGTH)
        e.siret = `Le SIRET doit contenir ${SIRET_LENGTH} chiffres.`;
      const v = vat.trim().toUpperCase();
      if (v.length > 0 && !/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(v))
        e.vat = "Numéro de TVA invalide (ex. FR12345678901).";
    }
    return e;
  }, [isCompany, companyName, siret, vat]);
  const hasErrors = Object.keys(errors).length > 0;
  const visibleErrors = {
    companyName: touched.companyName ? errors.companyName : undefined,
    siret: touched.siret ? errors.siret : undefined,
    vat: touched.vat ? errors.vat : undefined,
  };

  const hasChanges = useMemo(() => {
    if (isCompany !== initial.isCompany) return true;
    if (line1 !== initial.line1 || line2 !== initial.line2) return true;
    if (postalCode !== initial.postalCode || city !== initial.city) return true;
    if (country !== initial.country) return true;
    if (isCompany) {
      return (
        companyName !== initial.companyName ||
        siret !== initial.siret ||
        vat !== initial.vat
      );
    }
    // Particulier : le prénom/nom (synchronisés avec le profil) sont éditables
    // ici → ils déclenchent un changement. Adresse/pays déjà couverts plus haut.
    return (
      firstName !== initial.firstName || lastName !== initial.lastName
    );
  }, [
    isCompany,
    firstName,
    lastName,
    companyName,
    siret,
    vat,
    line1,
    line2,
    postalCode,
    city,
    country,
    initial,
  ]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasChanges || saving) return;
    if (hasErrors) {
      setTouched({ companyName: true, siret: true, vat: true });
      return;
    }
    setSaving(true);
    try {
      if (isMocked) {
        toast.success("Informations de facturation enregistrées (démo)");
        return;
      }

      // Particulier : prénom + nom sont les champs du PROFIL (synchronisation
      // vice-versa). On les enregistre via updateProfileAction si modifiés ;
      // ça met aussi à jour profiles.billing_name côté serveur.
      const fullName = [firstName, lastName]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" ")
        .trim();
      const namesChanged =
        !isCompany &&
        (firstName !== initial.firstName || lastName !== initial.lastName);
      if (namesChanged) {
        const nameResult = await updateProfileAction({
          first_name: firstName,
          last_name: lastName,
        });
        if (!nameResult.ok) {
          toast.error(nameResult.message);
          return;
        }
      }

      const result = await updateBillingAction({
        billing_type: isCompany ? "company" : "individual",
        billing_name: isCompany ? null : fullName || null,
        address_line1: line1,
        address_line2: line2,
        postal_code: postalCode,
        city,
        country,
        company_name: isCompany ? companyName : null,
        siret: isCompany ? siret : null,
        vat_number: isCompany ? vat : null,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Informations de facturation enregistrées");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard
      title="Informations de facturation"
      icon="/icons-notion/receipt_lightgray.svg"
      description="Ce sont ces informations qu'on utilise pour émettre tes factures"
      fbLabel="Section facturation · Réglages"
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <BillingCheckbox
          checked={isCompany}
          onChange={setIsCompany}
          label="Je facture en tant qu'entreprise"
        />

        {/* Bloc société — animé (entreprise uniquement) */}
        <Collapse open={isCompany}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 2 }}>
            <Field
              id="company-name"
              label="Raison sociale"
              value={companyName}
              onChange={setCompanyName}
              onBlur={() => setTouched((p) => ({ ...p, companyName: true }))}
              error={visibleErrors.companyName}
              placeholder="Ma Société SAS"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                id="siret"
                label="SIRET"
                value={siret}
                onChange={(v) => setSiret(formatSiret(v))}
                onBlur={() => setTouched((p) => ({ ...p, siret: true }))}
                error={visibleErrors.siret}
                placeholder="123 456 789 00012"
                inputMode="numeric"
              />
              <Field
                id="vat"
                label="N° TVA intracommunautaire"
                value={vat}
                onChange={setVat}
                onBlur={() => setTouched((p) => ({ ...p, vat: true }))}
                error={visibleErrors.vat}
                placeholder="FR12345678901"
              />
            </div>
          </div>
        </Collapse>

        {/* Nom de facturation — particulier uniquement. Prénom + nom sont les
            mêmes champs que dans le profil : éditables ici comme là-bas, la
            synchronisation se fait dans les deux sens (mêmes colonnes profil). */}
        <Collapse open={!isCompany}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
            >
              <Field
                id="billing-first-name"
                label="Prénom"
                value={firstName}
                onChange={setFirstName}
                placeholder="Prénom"
              />
              <Field
                id="billing-last-name"
                label="Nom"
                value={lastName}
                onChange={setLastName}
                placeholder="Nom"
              />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--color-text-muted)",
                lineHeight: 1.4,
              }}
            >
              Synchronisé avec ton profil — modifiable ici comme dans ton profil.
            </p>
          </div>
        </Collapse>

        {/* Adresse de facturation (toujours) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field
            id="billing-line1"
            label="Adresse"
            value={line1}
            onChange={setLine1}
            placeholder="12 rue de la République"
          />
          <Field
            id="billing-line2"
            label="Complément d'adresse"
            value={line2}
            onChange={setLine2}
            placeholder="Bâtiment, étage… (optionnel)"
            optional
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              id="billing-postal"
              label="Code postal"
              value={postalCode}
              onChange={setPostalCode}
              placeholder="75001"
            />
            <Field
              id="billing-city"
              label="Ville"
              value={city}
              onChange={setCity}
              placeholder="Paris"
            />
          </div>
          <CountrySelect
            id="billing-country"
            label="Pays"
            value={country}
            onChange={setCountry}
            fbLabel="Champ Pays · Section facturation"
          />
        </div>

        {hasChanges && (
          <div
            className="nc-mode-in"
            style={{ display: "flex", justifyContent: "flex-end" }}
          >
            <button
              type="submit"
              disabled={saving}
              data-fb-label="Bouton Enregistrer · Section facturation"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 9999,
                border: "none",
                background: "var(--color-brand)",
                color: "white",
                fontWeight: 600,
                fontSize: 14,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
                transition: "opacity 150ms ease",
                boxShadow: "0 6px 18px -8px rgba(224,98,90,0.55)",
              }}
            >
              {saving && <LoaderCircle size={14} className="animate-spin" />}
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          </div>
        )}
      </form>

      {/* Accès aux paiements — encadré-bouton design (DS) sous les champs de
          facturation. Ouvre la modale qui charge les paiements (API Notion). */}
      <button
        type="button"
        onClick={() => setPaymentsOpen(true)}
        data-fb-label="Bouton Voir mes paiements · Section facturation"
        className="nc-payments-cta"
      >
        <span className="nc-payments-cta__text">
          <span className="nc-payments-cta__title">
            Voir mes paiements
            <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>
              →
            </span>
          </span>
          <span className="nc-payments-cta__sub">
            Factures, reçus et historique de tes règlements.
          </span>
        </span>
        {/* Aperçu de facture (skeleton) — desktop uniquement. */}
        <span className="nc-payments-cta__preview">
          <InvoicePreview />
        </span>
      </button>

      <PaymentsModal open={paymentsOpen} onClose={() => setPaymentsOpen(false)} />
    </SettingsCard>
  );
}

// ── Champ texte réutilisable (aligné nc-input + label + erreur/hint) ──
function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  hint,
  optional,
  inputMode,
  readOnly,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  hint?: string;
  optional?: boolean;
  inputMode?: "numeric" | "text";
  readOnly?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={id}
        style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}
      >
        {label}
        {optional && (
          <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>
            {" "}
            (optionnel)
          </span>
        )}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        inputMode={inputMode}
        data-fb-label={`Champ ${label} · Section facturation`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        className="nc-input"
        placeholder={placeholder}
        style={{
          borderColor: error ? "var(--color-brand)" : undefined,
          ...(readOnly
            ? { color: "var(--color-text-muted)", cursor: "default" }
            : {}),
        }}
      />
      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-brand)",
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          {error}
        </p>
      )}
      {hint && !error && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Conteneur à hauteur animée (même pattern qu'EmailField) ──
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!innerRef.current) return;
    const el = innerRef.current;
    const update = () => setHeight(el.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      style={{
        overflow: "hidden",
        transition: "max-height 220ms ease, opacity 180ms ease",
        maxHeight: open ? height + 8 : 0,
        opacity: open ? 1 : 0,
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

function BillingCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label
      data-fb-label="Interrupteur Facturation entreprise · Section facturation"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        fontSize: 13,
        color: "var(--color-text-primary)",
        lineHeight: 1.4,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 6,
          border: checked
            ? "1.5px solid var(--color-brand)"
            : "1.5px solid var(--color-border-default)",
          background: checked ? "var(--color-brand)" : "var(--color-surface-card)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          transition: "all 150ms ease",
          flexShrink: 0,
        }}
      >
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
      />
      <span>{label}</span>
    </label>
  );
}
