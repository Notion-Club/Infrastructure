import { Suspense } from "react";
import { LoginForm } from "@/modules/auth";

export const metadata = {
  title: "Connexion — Notion Club",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
        <p className="text-sm text-muted-foreground">
          Connecte-toi pour accéder à la plateforme.
        </p>
      </div>
      {/* useSearchParams() impose un Suspense boundary en App Router. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
