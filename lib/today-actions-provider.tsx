import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAccount } from "@/hooks/use-account";
import { getAccountStorageKey } from "@/lib/cloud-storage";
import { type TodayActionState, upsertTodayAction } from "@/lib/today-actions";
import { trpc } from "@/lib/trpc";

const STORAGE_KEY = "abu-mishal:today-actions:v1";

type TodayActionsContextValue = {
  actions: TodayActionState[];
  isLoading: boolean;
  snooze: (itemId: string, transactionId: string, until: string) => Promise<void>;
  dismiss: (itemId: string, transactionId: string) => Promise<void>;
  restore: (itemId: string) => Promise<void>;
};

const TodayActionsContext = createContext<TodayActionsContextValue | undefined>(undefined);

export function TodayActionsProvider({ children }: PropsWithChildren) {
  const account = useAccount();
  const [actions, setActions] = useState<TodayActionState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const storageKey = getAccountStorageKey(STORAGE_KEY, account.isAuthenticated ? account.user?.id : undefined);
  const cloudRecord = trpc.cloud.get.useQuery({ recordType: "today-actions" }, { enabled: account.isAuthenticated, retry: 1 });
  const cloudPut = trpc.cloud.put.useMutation();
  const cloudUtils = trpc.useUtils();

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setActions([]);
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (!stored) return;
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) setActions(parsed as TodayActionState[]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [storageKey]);

  useEffect(() => {
    if (!account.isAuthenticated || isLoading || cloudRecord.isLoading) return;
    if (Array.isArray(cloudRecord.data?.payload)) {
      setActions(cloudRecord.data.payload as TodayActionState[]);
      return;
    }
    if (!cloudRecord.data && actions.length) {
      void cloudPut.mutateAsync({ recordType: "today-actions", payload: actions })
        .then(() => cloudUtils.cloud.get.invalidate({ recordType: "today-actions" }))
        .catch(() => undefined);
    }
  }, [account.isAuthenticated, actions, cloudPut, cloudRecord.data, cloudRecord.isLoading, cloudUtils.cloud.get, isLoading]);

  const persist = useCallback(async (next: TodayActionState[]) => {
    setActions(next);
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    if (!account.isAuthenticated) return;
    try {
      await cloudPut.mutateAsync({ recordType: "today-actions", payload: next });
      await cloudUtils.cloud.get.invalidate({ recordType: "today-actions" });
    } catch {
      // تبقى الحالة محلياً وتتم مزامنتها عند المحاولة التالية من الحساب نفسه.
    }
  }, [account.isAuthenticated, cloudPut, cloudUtils.cloud.get, storageKey]);

  const snooze = useCallback(async (itemId: string, transactionId: string, snoozedUntil: string) => {
    await persist(upsertTodayAction(actions, { itemId, transactionId, snoozedUntil, updatedAt: new Date().toISOString() }));
  }, [actions, persist]);

  const dismiss = useCallback(async (itemId: string, transactionId: string) => {
    await persist(upsertTodayAction(actions, { itemId, transactionId, dismissedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
  }, [actions, persist]);

  const restore = useCallback(async (itemId: string) => {
    const existing = actions.find((item) => item.itemId === itemId);
    if (!existing) return;
    await persist(upsertTodayAction(actions, { itemId: existing.itemId, transactionId: existing.transactionId, updatedAt: new Date().toISOString() }));
  }, [actions, persist]);

  const value = useMemo(() => ({ actions, isLoading: isLoading || (account.isAuthenticated && cloudRecord.isLoading), snooze, dismiss, restore }), [account.isAuthenticated, actions, cloudRecord.isLoading, dismiss, isLoading, restore, snooze]);
  return <TodayActionsContext.Provider value={value}>{children}</TodayActionsContext.Provider>;
}

export function useTodayActions() {
  const context = useContext(TodayActionsContext);
  if (!context) throw new Error("useTodayActions must be used inside TodayActionsProvider");
  return context;
}
