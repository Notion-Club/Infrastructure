"use client";

import { useMemo } from "react";
import { MOCK_USERS } from "../mocks/users.mock";
import type { User } from "../types/user.types";
import type { DevRole } from "./useDevRoleToggle";

const ROLE_TO_ID: Record<DevRole, string> = {
  free: "self-free",
  paid: "self-paid",
  admin: "self-admin",
};

export function useCurrentUser(role: DevRole): User {
  return useMemo(() => {
    const id = ROLE_TO_ID[role];
    return MOCK_USERS.find((u) => u.id === id)!;
  }, [role]);
}
