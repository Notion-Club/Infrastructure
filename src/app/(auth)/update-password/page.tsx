import { Suspense } from "react";
import Image from "next/image";

import { UpdatePasswordForm } from "@/modules/auth";

export const metadata = {
  title: "Nouveau mot de passe · Notion Club",
};

const LOGO_SRC =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777034233/Notion_Club_-_Black_-_Sans_BG_hcvk9k.png";

export default function UpdatePasswordPage() {
  return (
    <main className="nc-page-halo relative flex min-h-[100lvh] flex-col">
      <div className="relative z-[1] mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center gap-10 px-4 py-16">
        <header className="flex flex-col items-center gap-8">
          <Image
            src={LOGO_SRC}
            alt="Notion Club"
            width={140}
            height={48}
            priority
            className="h-12 w-auto"
            data-fb-label="Logo Notion Club · En-tête auth"
          />
        </header>

        {/* UpdatePasswordForm utilise useSearchParams pour lire ?code=… —
            Next.js 16 exige une Suspense boundary pour permettre le prerender
            statique. */}
        <Suspense fallback={null}>
          <UpdatePasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
