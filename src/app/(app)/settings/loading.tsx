import { SettingsSkeleton } from "@/shared/components/settings/SettingsSkeleton";

// Loading dédié à /settings — remplace le fallback générique (app)/loading.tsx
// par un skeleton qui épouse exactement le gabarit de la page (conteneur 680px,
// ProfileRecapCard + cartes de section). Plus de molette de chargement.
export default function SettingsLoading() {
  return (
    <div className="nc-page-halo" style={{ minHeight: "100lvh" }}>
      <main style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{ maxWidth: 680, margin: "0 auto" }}
          className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-12"
        >
          <SettingsSkeleton />
        </div>
      </main>
    </div>
  );
}
