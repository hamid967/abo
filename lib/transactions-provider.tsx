import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  addStatusHistoryEntry,
  createTransaction,
  GovernmentTransaction,
  TransactionDraft,
  TransactionStatus,
} from "@/lib/transactions";
import { cancelTransactionReminder, scheduleTransactionReminder } from "@/lib/notification-service";

const STORAGE_KEY = "government-transactions:v1";

const legacyStatusMap: Record<string, TransactionStatus> = {
  new: "received",
  action_required: "awaiting_customer_documents",
};

function normalizeStoredTransaction(transaction: GovernmentTransaction): GovernmentTransaction {
  const status = legacyStatusMap[transaction.status] ?? transaction.status;
  const statusHistory = transaction.statusHistory?.length
    ? transaction.statusHistory
    : [{ id: `${transaction.id}-history-migrated`, status, createdAt: transaction.updatedAt, actorName: "النظام" }];
  return { ...transaction, status, statusHistory };
}

type TransactionContextValue = {
  transactions: GovernmentTransaction[];
  isLoading: boolean;
  addTransaction: (draft: TransactionDraft) => Promise<GovernmentTransaction>;
  updateTransaction: (id: string, patch: Partial<TransactionDraft>) => Promise<GovernmentTransaction | undefined>;
  updateStatus: (id: string, status: TransactionStatus, note?: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
};

const TransactionContext = createContext<TransactionContextValue | undefined>(undefined);

async function persistTransactions(transactions: GovernmentTransaction[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

export function TransactionProvider({ children }: PropsWithChildren) {
  const [transactions, setTransactions] = useState<GovernmentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function hydrateTransactions() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as GovernmentTransaction[];
          if (Array.isArray(parsed)) setTransactions(parsed.map(normalizeStoredTransaction));
        }
      } finally {
        setIsLoading(false);
      }
    }

    void hydrateTransactions();
  }, []);

  const addTransaction = useCallback(async (draft: TransactionDraft) => {
    const transaction = createTransaction(draft);
    const reminder = await scheduleTransactionReminder(transaction);
    const scheduledTransaction = { ...transaction, reminder };
    setTransactions((current) => [scheduledTransaction, ...current]);
    await persistTransactions([scheduledTransaction, ...transactions]);
    return scheduledTransaction;
  }, [transactions]);

  const updateTransaction = useCallback(async (id: string, patch: Partial<TransactionDraft>) => {
    const existing = transactions.find((transaction) => transaction.id === id);
    if (!existing) return undefined;
    await cancelTransactionReminder(existing.reminder);
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    const reminder = await scheduleTransactionReminder(updated);
    const scheduledTransaction = { ...updated, reminder };
    const next = transactions.map((transaction) => transaction.id === id ? scheduledTransaction : transaction);
    setTransactions(next);
    await persistTransactions(next);
    return scheduledTransaction;
  }, [transactions]);

  const updateStatus = useCallback(async (id: string, status: TransactionStatus, note?: string) => {
    const existing = transactions.find((transaction) => transaction.id === id);
    if (!existing) return;
    await cancelTransactionReminder(existing.reminder);
    const updated = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
      statusHistory: status === existing.status ? existing.statusHistory : addStatusHistoryEntry(existing, status, "فريق أبو مشعل", note),
    };
    const reminder = await scheduleTransactionReminder(updated);
    const next = transactions.map((transaction) => transaction.id === id ? { ...updated, reminder } : transaction);
    setTransactions(next);
    await persistTransactions(next);
  }, [transactions]);

  const deleteTransaction = useCallback(async (id: string) => {
    const existing = transactions.find((transaction) => transaction.id === id);
    await cancelTransactionReminder(existing?.reminder);
    const next = transactions.filter((transaction) => transaction.id !== id);
    setTransactions(next);
    await persistTransactions(next);
  }, [transactions]);

  const value = useMemo(
    () => ({ transactions, isLoading, addTransaction, updateTransaction, updateStatus, deleteTransaction }),
    [transactions, isLoading, addTransaction, updateTransaction, updateStatus, deleteTransaction],
  );

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (!context) throw new Error("useTransactions must be used inside TransactionProvider");
  return context;
}
