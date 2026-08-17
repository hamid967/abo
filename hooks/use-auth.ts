import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { authenticateBiometric, getBiometricAvailability, getBiometricLockTimeout, isBiometricEnabled, type BiometricAvailability } from "@/lib/biometric-auth";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricUser, setBiometricUser] = useState<Auth.User | null>(null);
  const [biometricAvailability, setBiometricAvailability] = useState<BiometricAvailability>({ available: false, kind: "none", label: "المصادقة البيومترية" });
  const currentUserRef = useRef<Auth.User | null>(null);
  const backgroundAtRef = useRef<number | null>(null);

  const applyNativeUser = useCallback(async (cachedUser: Auth.User | null) => {
    if (!cachedUser) {
      setUser(null);
      setBiometricUser(null);
      setBiometricLocked(false);
      return;
    }
    const [enabled, availability] = await Promise.all([isBiometricEnabled(), getBiometricAvailability()]);
    setBiometricAvailability(availability);
    if (enabled && availability.available) {
      setBiometricUser(cachedUser);
      setBiometricLocked(true);
      setUser(null);
    } else {
      setBiometricUser(null);
      setBiometricLocked(false);
      setUser(cachedUser);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (Platform.OS === "web") {
        const apiUser = await Api.getMe();
        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            openId: apiUser.openId,
            name: apiUser.name,
            email: apiUser.email,
            loginMethod: apiUser.loginMethod,
            lastSignedIn: new Date(apiUser.lastSignedIn),
          };
          setUser(userInfo);
          await Auth.setUserInfo(userInfo);
        } else {
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }

      const sessionToken = await Auth.getSessionToken();
      if (!sessionToken) {
        await applyNativeUser(null);
        return;
      }

      const cachedUser = await Auth.getUserInfo();
      await applyNativeUser(cachedUser);
    } catch (err) {
      const authError = err instanceof Error ? err : new Error("Failed to fetch user");
      console.warn("[useAuth] Unable to refresh the local authentication state");
      setError(authError);
      setUser(null);
      setBiometricUser(null);
      setBiometricLocked(false);
    } finally {
      setLoading(false);
    }
  }, [applyNativeUser]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!biometricUser) return { success: false, cancelled: false, message: "لا توجد جلسة معلقة لفتحها." };
    const result = await authenticateBiometric(biometricAvailability.label);
    if (result.success) {
      setUser(biometricUser);
      setBiometricUser(null);
      setBiometricLocked(false);
    }
    return result;
  }, [biometricAvailability.label, biometricUser]);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch {
      console.warn("[Auth] Logout request was unavailable; the local session will still be cleared");
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setBiometricUser(null);
      setBiometricLocked(false);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    currentUserRef.current = user;
  }, [user]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        backgroundAtRef.current = Date.now();
        return;
      }
      if (nextState !== "active" || backgroundAtRef.current === null) return;
      const backgroundAt = backgroundAtRef.current;
      backgroundAtRef.current = null;
      void Promise.all([isBiometricEnabled(), getBiometricAvailability(), getBiometricLockTimeout()]).then(([enabled, availability, timeout]) => {
        const activeUser = currentUserRef.current;
        if (!enabled || !availability.available || !activeUser) return;
        if (timeout === 0 || Date.now() - backgroundAt >= timeout) {
          setBiometricAvailability(availability);
          setBiometricUser(activeUser);
          setUser(null);
          setBiometricLocked(true);
        }
      });
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!autoFetch) {
      setLoading(false);
      return;
    }
    if (Platform.OS === "web") {
      void fetchUser();
      return;
    }
    void Auth.getUserInfo().then(async (cachedUser) => {
      if (cachedUser) {
        await applyNativeUser(cachedUser);
        setLoading(false);
      } else {
        await fetchUser();
      }
    });
  }, [applyNativeUser, autoFetch, fetchUser]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
    biometricLocked,
    biometricAvailability,
    unlockWithBiometrics,
  };
}
