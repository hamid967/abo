import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

export type AppRole = "customer" | "employee" | "supervisor";
const ROLE_KEY = "abu-mishal-preview-role:v1";
const RoleContext = createContext<{ role: AppRole; setRole: (role: AppRole) => Promise<void>; isLoading: boolean } | undefined>(undefined);

export function RoleProvider({ children }: PropsWithChildren) {
  const [role, setCurrentRole] = useState<AppRole>("customer");
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => { void (async () => { try { const stored = await AsyncStorage.getItem(ROLE_KEY); if (stored === "customer" || stored === "employee" || stored === "supervisor") setCurrentRole(stored); } finally { setIsLoading(false); } })(); }, []);
  const setRole = async (nextRole: AppRole) => { setCurrentRole(nextRole); await AsyncStorage.setItem(ROLE_KEY, nextRole); };
  const value = useMemo(() => ({ role, setRole, isLoading }), [isLoading, role]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useAppRole() { const context = useContext(RoleContext); if (!context) throw new Error("useAppRole must be used within RoleProvider"); return context; }
