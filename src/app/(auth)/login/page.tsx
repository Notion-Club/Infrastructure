import { AuthMockup, BrandingPanel, BrandPill } from "@/modules/auth";

export const metadata = {
  title: "Connexion — Notion Club",
};

export default function LoginPage() {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <main className="nc-page-halo relative flex min-h-[100dvh] flex-col">
      <header className="absolute top-6 left-6 z-10 md:top-8 md:left-8">
        <BrandPill />
      </header>

      <div className="relative z-[1] mx-auto grid w-full max-w-[1280px] flex-1 grid-cols-1 items-center gap-12 px-4 py-24 md:grid-cols-2 md:gap-16 md:px-10 md:py-16">
        <section className="flex w-full justify-center md:justify-end">
          <AuthMockup initialState="login-empty" showDevPanel={isDev} />
        </section>

        <BrandingPanel />
      </div>
    </main>
  );
}
