import { createContext, createElement, PropsWithChildren, useContext, useMemo } from "react";

import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export type AccountRole = "customer" | "employee" | "supervisor" | "admin" | "super_admin";
type AccountContextValue = ReturnType<typeof buildAccountValue>;
const AccountContext = createContext<AccountContextValue | undefined>(undefined);

function buildAccountValue(auth: ReturnType<typeof useAuth>, accountData: { role?: string } | null | undefined, accountLoading: boolean) {
  const rawRole = accountData?.role;
  const role: AccountRole = rawRole === "employee" || rawRole === "supervisor" || rawRole === "admin" || rawRole === "super_admin" ? rawRole : "customer";
  return { ...auth, role, account: accountData, isAccountLoading: auth.loading || (auth.isAuthenticated && accountLoading) };
}

export function AccountProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const accountQuery = trpc.auth.me.useQuery(undefined, { enabled: auth.isAuthenticated, retry: false });
  const value = useMemo(() => buildAccountValue(auth, accountQuery.data, accountQuery.isLoading), [accountQuery.data, accountQuery.isLoading, auth]);
  return createElement(AccountContext.Provider, { value }, children);
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used within AccountProvider");
  return context;
}
