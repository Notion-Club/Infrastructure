import { SignupForm } from "@/modules/auth";

export const metadata = {
  title: "Inscription — Notion Club",
};

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Crée ton compte</h1>
        <p className="text-sm text-muted-foreground">
          Rejoins le Challenge Gratuit — accès immédiat.
        </p>
      </div>
      <SignupForm />
    </main>
  );
}
