"use client";

import { useState } from "react";
import { AuthCard, type AuthCardState } from "./AuthCard";
import { cn } from "@/shared/lib/utils";

const STATES: { value: AuthCardState; label: string }[] = [
  { value: "login-empty", label: "Login — empty" },
  { value: "login-error", label: "Login — error" },
  { value: "signup-empty", label: "Signup — empty" },
  { value: "signup-loading", label: "Signup — loading" },
];

export function AuthMockup({
  initialState = "login-empty",
  showDevPanel = false,
}: {
  initialState?: AuthCardState;
  showDevPanel?: boolean;
}) {
  const [state, setState] = useState<AuthCardState>(initialState);

  return (
    <>
      <AuthCard state={state} onStateChange={setState} />
      {showDevPanel && <DevStateSwitcher current={state} onChange={setState} />}
    </>
  );
}

function DevStateSwitcher({
  current,
  onChange,
}: {
  current: AuthCardState;
  onChange: (state: AuthCardState) => void;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-black/10 bg-black/85 p-1 text-[12px] font-medium text-white shadow-2xl backdrop-blur">
      <span className="px-2 text-white/60">state</span>
      {STATES.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          className={cn(
            "rounded-full px-3 py-1.5 transition-colors",
            current === s.value
              ? "bg-white text-black"
              : "text-white/70 hover:bg-white/10 hover:text-white",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
