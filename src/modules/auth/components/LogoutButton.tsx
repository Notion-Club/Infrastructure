"use client";

import { useTransition } from "react";
import { Button } from "@/shared/components/ui/button";
import { signOutAction } from "@/modules/auth/server/actions";

type Props = {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  label?: string;
};

export function LogoutButton({
  variant = "outline",
  size = "default",
  label = "Se déconnecter",
}: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        startTransition(async () => {
          await signOutAction();
        });
      }}
    >
      <Button
        type="submit"
        variant={variant}
        size={size}
        disabled={isPending}
        data-fb-label="Bouton Se déconnecter · Compte"
      >
        {isPending ? "Déconnexion..." : label}
      </Button>
    </form>
  );
}
