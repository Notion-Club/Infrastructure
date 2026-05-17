import Image from "next/image";
import { AuthMockup } from "@/modules/auth";

export const metadata = {
  title: "Inscription — Notion Club",
};

const LOGO_SRC =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777034233/Notion_Club_-_Black_-_Sans_BG_hcvk9k.png";

export default function SignupPage() {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <main className="nc-page-halo relative flex min-h-[100dvh] flex-col">
      <div className="relative z-[1] mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center gap-10 px-4 py-16">
        <header className="flex flex-col items-center gap-8">
          <Image
            src={LOGO_SRC}
            alt="Notion Club"
            width={140}
            height={48}
            priority
            className="h-12 w-auto"
          />
          <h1 className="text-center text-[clamp(24px,3vw,32px)] font-bold leading-tight tracking-[-0.02em] text-[var(--color-text-primary)]">
            Accède aux programmes du Notion Club
          </h1>
        </header>

        <AuthMockup initialState="signup-empty" showDevPanel={isDev} />
      </div>
    </main>
  );
}
