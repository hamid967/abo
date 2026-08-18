import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import type { TransactionListItem } from "./transactions";

type TransactionContextValue = { transactions: TransactionListItem[]; loading: boolean; error: string | null; refresh: () => Promise<void> };
const TransactionContext = createContext<TransactionContextValue | undefined>(undefined);

export function TransactionStoreProvider({ children }: PropsWithChildren) {
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await api.transactions.mobileList.query() as TransactionListItem[];
      setTransactions(Array.isArray(result) ? result : []);
    } catch {
      setError("ما قدرنا نجيب معاملاتك الحين. تأكد من الدخول والاتصال ثم جرّب.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const value = useMemo(() => ({ transactions, loading, error, refresh }), [transactions, loading, error, refresh]);
  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactionStore() {
  const context = useContext(TransactionContext);
  if (!context) throw new Error("TransactionStoreProvider is required");
  return context;
}
