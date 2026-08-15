import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  createTransaction,
  GovernmentTransaction,
  TransactionDraft,
  TransactionStatus,
} from "@/lib/transactions";

const STORAGE_KEY = "government-transactions:v1";

type TransactionContextValue = {
  transactions: GovernmentTransaction[];
  isLoading: boolean;
  addTransaction: (draft: TransactionDraft) => GovernmentTransaction;
  updateTransaction: (id: string, patch: Partial<TransactionDraft>) => void;
  updateStatus: (id: string, status: TransactionStatus) => void;
  deleteTransaction: (id: string) => void;
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
          if (Array.isArray(parsed)) setTransactions(parsed);
        }
      } finally {
        setIsLoading(false);
      }
    }

    void hydrateTransactions();
  }, []);

  const addTransaction = useCallback((draft: TransactionDraft) => {
    const transaction = createTransaction(draft);
    setTransactions((current) => {
      const next = [transaction, ...current];
      void persistTransactions(next);
      return next;
    });
    return transaction;
  }, []);

  const updateTransaction = useCallback((id: string, patch: Partial<TransactionDraft>) => {
    setTransactions((current) => {
      const next = current.map((transaction) =>
        transaction.id === id
          ? { ...transaction, ...patch, updatedAt: new Date().toISOString() }
          : transaction,
      );
      void persistTransactions(next);
      return next;
    });
  }, []);

  const updateStatus = useCallback((id: string, status: TransactionStatus) => {
    setTransactions((current) => {
      const next = current.map((transaction) =>
        transaction.id === id ? { ...transaction, status, updatedAt: new Date().toISOString() } : transaction,
      );
      void persistTransactions(next);
      return next;
    });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((current) => {
      const next = current.filter((transaction) => transaction.id !== id);
      void persistTransactions(next);
      return next;
    });
  }, []);

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
