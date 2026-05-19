"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { signupSchema } from "@/modules/auth/lib/validation";
import { signUpAction } from "@/modules/auth/server/actions";

export function SignupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  }>({});

  function onSubmit(formData: FormData) {
    const raw = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
    };

    const parsed = signupSchema.safeParse(raw);
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
      const result = await signUpAction(parsed.data);
      if (!result.ok) {
        toast.error(result.message);
        if (result.code === "already_exists") {
          // Le toast contient déjà le message + redirect manuel possible.
        }
        return;
      }
      router.push("/dashboard");
    });
  }

  return (
    <form
      action={onSubmit}
      className="flex w-full max-w-sm flex-col gap-4"
      noValidate
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            required
            autoComplete="given-name"
            disabled={isPending}
          />
          {fieldErrors.firstName && (
            <p className="text-xs text-destructive">{fieldErrors.firstName}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName">Nom</Label>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            required
            autoComplete="family-name"
            disabled={isPending}
          />
          {fieldErrors.lastName && (
            <p className="text-xs text-destructive">{fieldErrors.lastName}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={isPending}
        />
        {fieldErrors.email && (
          <p className="text-xs text-destructive">{fieldErrors.email}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={isPending}
        />
        {fieldErrors.password && (
          <p className="text-xs text-destructive">{fieldErrors.password}</p>
        )}
        <p className="text-xs text-muted-foreground">
          8 caractères minimum.
        </p>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Création..." : "Créer mon compte"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
