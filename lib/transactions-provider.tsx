import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAccount } from "@/hooks/use-account";
import { cancelTransactionReminder, scheduleTransactionReminder } from "@/lib/notification-service";
import { trpc } from "@/lib/trpc";
import { getAccountStorageKey } from "@/lib/cloud-storage";
import {
  addStatusHistoryEntry,
  createTransaction,
  GovernmentTransaction,
  TransactionDraft,
  TransactionStatus,
} from "@/lib/transactions";

const STORAGE_KEY = "government-transactions:v1";
const legacyStatusMap: Record<string, TransactionStatus> = { new: "received", action_required: "awaiting_customer_documents" };

function normalizeStoredTransaction(transaction: GovernmentTransaction): GovernmentTransaction {
  const status = legacyStatusMap[transaction.status] ?? transaction.status;
  const statusHistory = transaction.statusHistory?.length ? transaction.statusHistory : [{ id: `${transaction.id}-history-migrated`, status, createdAt: transaction.updatedAt, actorName: "النظام" }];
  return { ...transaction, status, statusHistory };
}

type TransactionContextValue = { transactions: GovernmentTransaction[]; isLoading: boolean; addTransaction: (draft: TransactionDraft) => Promise<GovernmentTransaction>; updateTransaction: (id: string, patch: Partial<TransactionDraft>) => Promise<GovernmentTransaction | undefined>; updateStatus: (id: string, status: TransactionStatus, note?: string) => Promise<void>; deleteTransaction: (id: string) => Promise<void>; };
const TransactionContext = createContext<TransactionContextValue | undefined>(undefined);
const persistTransactions = async (storageKey: string, transactions: GovernmentTransaction[]) => AsyncStorage.setItem(storageKey, JSON.stringify(transactions));

export function TransactionProvider({ children }: PropsWithChildren) {
  const account = useAccount();
  const cloudRecord = trpc.cloud.get.useQuery({ recordType: "transactions" }, { enabled: account.isAuthenticated, retry: 1 });
  const cloudPut = trpc.cloud.put.useMutation();
  const cloudUtils = trpc.useUtils();
  const [transactions, setTransactions] = useState<GovernmentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const storageKey = getAccountStorageKey(STORAGE_KEY, account.isAuthenticated ? account.user?.id : undefined);

  useEffect(() => { void (async () => { setIsLoading(true); setTransactions([]); try { const stored = await AsyncStorage.getItem(storageKey); if (stored) { const parsed = JSON.parse(stored) as GovernmentTransaction[]; if (Array.isArray(parsed)) setTransactions(parsed.map(normalizeStoredTransaction)); } } finally { setIsLoading(false); } })(); }, [storageKey]);

  useEffect(() => {
    if (!account.isAuthenticated || isLoading || cloudRecord.isLoading) return;
    if (Array.isArray(cloudRecord.data?.payload)) {
      setTransactions(cloudRecord.data.payload.map((item) => normalizeStoredTransaction(item as GovernmentTransaction)));
      return;
    }
    if (!cloudRecord.data && transactions.length) void cloudPut.mutateAsync({ recordType: "transactions", payload: transactions }).then(() => cloudUtils.cloud.get.invalidate({ recordType: "transactions" })).catch(() => undefined);
  }, [account.isAuthenticated, cloudPut, cloudRecord.data, cloudRecord.isLoading, cloudUtils.cloud.get, isLoading, transactions]);

  const persist = useCallback(async (next: GovernmentTransaction[]) => {
    await persistTransactions(storageKey, next);
    if (account.isAuthenticated) {
      try {
        await cloudPut.mutateAsync({ recordType: "transactions", payload: next });
        await cloudUtils.cloud.get.invalidate({ recordType: "transactions" });
      } catch {
        // يحتفظ التطبيق بالنسخة المحلية ويعيد المحاولة عند المزامنة التالية.
      }
    }
  }, [account.isAuthenticated, cloudPut, cloudUtils.cloud.get, storageKey]);

  const addTransaction = useCallback(async (draft: TransactionDraft) => {
    const transaction = createTransaction(draft);
    const reminder = await scheduleTransactionReminder(transaction);
    const scheduledTransaction = { ...transaction, reminder };
    const next = [scheduledTransaction, ...transactions];
    setTransactions(next);
    await persist(next);
    return scheduledTransaction;
  }, [persist, transactions]);

  const updateTransaction = useCallback(async (id: string, patch: Partial<TransactionDraft>) => {
    const existing = transactions.find((transaction) => transaction.id === id);
    if (!existing) return undefined;
    await cancelTransactionReminder(existing.reminder);
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    const reminder = await scheduleTransactionReminder(updated);
    const scheduledTransaction = { ...updated, reminder };
    const next = transactions.map((transaction) => transaction.id === id ? scheduledTransaction : transaction);
    setTransactions(next);
    await persist(next);
    return scheduledTransaction;
  }, [persist, transactions]);

  const updateStatus = useCallback(async (id: string, status: TransactionStatus, note?: string) => {
    const existing = transactions.find((transaction) => transaction.id === id);
    if (!existing) return;
    await cancelTransactionReminder(existing.reminder);
    const updated = { ...existing, status, updatedAt: new Date().toISOString(), statusHistory: status === existing.status ? existing.statusHistory : addStatusHistoryEntry(existing, status, "فريق أبو مشعل", note) };
    const reminder = await scheduleTransactionReminder(updated);
    const next = transactions.map((transaction) => transaction.id === id ? { ...updated, reminder } : transaction);
    setTransactions(next);
    await persist(next);
  }, [persist, transactions]);

  const deleteTransaction = useCallback(async (id: string) => {
    const existing = transactions.find((transaction) => transaction.id === id);
    await cancelTransactionReminder(existing?.reminder);
    const next = transactions.filter((transaction) => transaction.id !== id);
    setTransactions(next);
    await persist(next);
  }, [persist, transactions]);

  const value = useMemo(() => ({ transactions, isLoading: isLoading || (account.isAuthenticated && cloudRecord.isLoading), addTransaction, updateTransaction, updateStatus, deleteTransaction }), [account.isAuthenticated, addTransaction, cloudRecord.isLoading, deleteTransaction, isLoading, transactions, updateStatus, updateTransaction]);
  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactions() { const context = useContext(TransactionContext); if (!context) throw new Error("useTransactions must be used inside TransactionProvider"); return context; }
