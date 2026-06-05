"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { signinSchema } from "@/modules/auth/lib/validation";
import { signInAction } from "@/modules/auth/server/actions";
import { GoogleSignInButton } from "@/modules/auth/components/GoogleSignInButton";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  // Affiche un toast si on revient sur /login depuis un callback OAuth en
  // erreur, ou après une suppression de compte réussie.
  useEffect(() => {
    if (searchParams.get("account_deleted") === "1") {
      toast.success(
        "Ton compte a été supprimé. Merci d'avoir fait partie du Notion Club.",
      );
      return;
    }
    const err = searchParams.get("error");
    if (!err) return;
    const messages: Record<string, string> = {
      oauth_denied: "Connexion Google annulée.",
      oauth_no_code: "Réponse OAuth incomplète. Réessaie.",
      oauth_exchange_failed: "Impossible de finaliser la connexion Google.",
      oauth_init_failed: "Impossible de démarrer la connexion Google.",
    };
    toast.error(messages[err] ?? "Erreur d'authentification.");
  }, [searchParams]);

  function onSubmit(formData: FormData) {
    const raw = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    const parsed = signinSchema.safeParse(raw);
    if (!parsed.success) {
      const errs: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof typeof fieldErrors;
        if (field && !errs[field]) errs[field] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = await signInAction(parsed.data);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.push("/dashboard");
    });
  }

  return (
    <div
      className="flex w-full max-w-sm flex-col gap-6"
      data-fb-label="Carte auth · Formulaire de connexion"
    >
      {/* Bouton SSO Google en HAUT (décision Brique 1) */}
      <GoogleSignInButton data-fb-label="Bouton Google · Formulaire de connexion" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">ou</span>
        </div>
      </div>

      <form
        action={onSubmit}
        className="flex flex-col gap-4"
        noValidate
        data-fb-label="Formulaire · Formulaire de connexion"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={isPending}
            data-fb-label="Champ Email · Formulaire de connexion"
          />
          {fieldErrors.email && (
            <p className="text-xs text-destructive">{fieldErrors.email}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            <Link
              href="/reset-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              data-fb-label="Lien Mot de passe oublié · Formulaire de connexion"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            disabled={isPending}
            data-fb-label="Champ Mot de passe · Formulaire de connexion"
          />
          {fieldErrors.password && (
            <p className="text-xs text-destructive">{fieldErrors.password}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isPending}
          data-fb-label="Bouton Se connecter · Formulaire de connexion"
        >
          {isPending ? "Connexion..." : "Se connecter"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link
          href="/signup"
          className="underline underline-offset-4"
          data-fb-label="Lien Créer un compte · Formulaire de connexion"
        >
          Inscris-toi
        </Link>
      </p>
    </div>
  );
}
