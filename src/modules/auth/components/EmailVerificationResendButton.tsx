"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { resendVerificationEmailAction } from "@/modules/auth/server/actions";

// Bouton interne du <EmailNotVerifiedBanner /> — Client Component minimal,
// gère l'appel à la Server Action + le rate-limit côté UI (60s cooldown).
//
// Le compteur en secondes est stocké en state et décrémenté par un interval
// (Date.now() ne doit pas être appelé pendant le render — règle React 19
// `react-hooks/purity`).
export function EmailVerificationResendButton() {
  const [isPending, startTransition] = useTransition();
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const disabled = isPending || cooldownRemaining > 0;

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const id = setInterval(() => {
      setCooldownRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownRemaining]);

  function handleClick() {
    if (disabled) return;
    startTransition(async () => {
      const result = await resendVerificationEmailAction();
      if (result.ok) {
        toast.success("Email renvoyé. Vérifie ta boîte (et les spams).");
        setCooldownRemaining(60);
        return;
      }
      if (result.code === "rate_limited" && result.retryAfterSeconds) {
        setCooldownRemaining(result.retryAfterSeconds);
      }
      toast.error(result.message);
    });
  }

  const label =
    cooldownRemaining > 0
      ? `Renvoyer (${cooldownRemaining}s)`
      : isPending
        ? "Envoi…"
        : "Renvoyer l'email";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
    >
      {label}
    </button>
  );
}
