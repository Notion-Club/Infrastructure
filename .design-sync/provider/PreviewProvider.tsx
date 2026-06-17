"use client";
// Global wrapper for every preview card (wired via cfg.provider). Supplies the
// Next App Router context (so useRouter/usePathname/next-link/next-image don't
// throw outside a Next runtime) and a mock ProfileIdentity (so the connected
// nav components — Topbar, MobileTopActions, BottomNav — render with a user).
import React from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  PathnameContext,
  SearchParamsContext,
  PathParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { ProfileIdentityProvider } from "@/shared/components/identity/ProfileIdentityProvider";
import { ThemeProvider } from "@/shared/components/theme/ThemeProvider";

const noop = () => {};
const router: any = {
  push: noop, replace: noop, back: noop, forward: noop, refresh: noop,
  prefetch: () => Promise.resolve(),
};
const identity: any = {
  id: "preview-user",
  firstName: "Théo",
  lastName: "Martin",
  displayName: "Théo Martin",
  username: "theo",
  email: "theo@notionclub.fr",
  avatarUrl: null,
  avatarColor: "#e0625a",
  role: "member",
  offer: "paid",
};

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterContext.Provider value={router}>
      <PathnameContext.Provider value="/dashboard">
        <SearchParamsContext.Provider value={new URLSearchParams() as any}>
          <PathParamsContext.Provider value={{}}>
            <ProfileIdentityProvider initialIdentity={identity}>
              <ThemeProvider>{children}</ThemeProvider>
            </ProfileIdentityProvider>
          </PathParamsContext.Provider>
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  );
}
