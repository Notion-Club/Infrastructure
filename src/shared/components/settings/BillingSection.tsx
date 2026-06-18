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

import { updateBillingAction, SIRET_LENGTH } from "@/modules/settings";
import { COUNTRIES } from "@/shared/lib/settings/countries";
import { SettingsCard } from "./SettingsCard";
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

export function BillingSection({ profile, company, isMocked }: BillingSectionProps) {
  const defaultName = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const initial = useMemo(() => {
    const isCompany = profile.billing_type === "company";
    return {
      isCompany,
      billingName: profile.billing_name ?? "",
      companyName: company?.name ?? "",
      siret: company?.siret ?? "",
      vat: company?.vat_number ?? "",
      line1: (isCompany ? company?.address_line1 : profile.billing_address_line1) ?? "",
      line2: (isCompany ? company?.address_line2 : profile.billing_address_line2) ?? "",
      postalCode: (isCompany ? company?.postal_code : profile.billing_postal_code) ?? "",
      city: (isCompany ? company?.city : profile.billing_city) ?? "",
      country: (isCompany ? company?.country : profile.billing_country) ?? "FR",
    };
  }, [profile, company]);

  const [isCompany, setIsCompany] = useState(initial.isCompany);
  const [billingName, setBillingName] = useState(initial.billingName);
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
    return billingName !== initial.billingName;
  }, [
    isCompany,
    billingName,
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
      const result = await updateBillingAction({
        billing_type: isCompany ? "company" : "individual",
        billing_name: isCompany ? null : billingName,
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
      description="Utilisées pour l'émission de vos factures. Les informations société (SIRET, TVA) sont stockées séparément de votre profil."
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
                onChange={setSiret}
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

        {/* Nom de facturation — particulier uniquement */}
        <Collapse open={!isCompany}>
          <Field
            id="billing-name"
            label="Nom pour la facturation"
            value={billingName}
            onChange={setBillingName}
            placeholder={defaultName || "Prénom Nom"}
            hint="Laissez vide pour utiliser votre prénom et nom."
          />
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              htmlFor="billing-country"
              style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}
            >
              Pays
            </label>
            <select
              id="billing-country"
              data-fb-label="Champ Pays · Section facturation"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="nc-input"
              style={{ cursor: "pointer" }}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </div>
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
        aria-invalid={error ? true : undefined}
        className="nc-input"
        placeholder={placeholder}
        style={{ borderColor: error ? "var(--color-brand)" : undefined }}
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
