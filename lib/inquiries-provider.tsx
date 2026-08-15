import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { GovernmentTransaction, isTerminalStatus } from "@/lib/transactions";
import { useAccount } from "@/hooks/use-account";
import { trpc } from "@/lib/trpc";
import { getAccountStorageKey } from "@/lib/cloud-storage";

export type InquiryTicket = { id: string; subject: string; message: string; status: "open" | "escalated" | "resolved"; createdAt: string; assistantReply: string; transactionId?: string; transactionTitle?: string; };
type InquiryContextValue = { tickets: InquiryTicket[]; isLoading: boolean; createInquiry: (subject: string, message: string, transactions: GovernmentTransaction[], link?: { transactionId: string; transactionTitle: string }) => Promise<InquiryTicket>; escalate: (id: string) => Promise<void>; };
const STORAGE_KEY = "abu-mishal-inquiries:v1";
const InquiryContext = createContext<InquiryContextValue | undefined>(undefined);

function buildLocalGuidance(message: string, transactions: GovernmentTransaction[]) {
  const active = transactions.find((transaction) => !isTerminalStatus(transaction.status));
  const normalized = message.toLowerCase();
  if (normalized.includes("حالة") || normalized.includes("معاملة") || normalized.includes("طلب")) return active ? `لديك طلب نشط بعنوان «${active.title}» وحالته الحالية «${active.status === "awaiting_customer_documents" ? "بانتظار مستندات" : active.status === "under_review" ? "تحت المراجعة" : "قيد المتابعة"}». ${active.nextAction || "راجع صفحة الطلب لمعرفة الإجراء التالي."} هذه معلومات إرشادية وليست تأكيداً من جهة حكومية.` : "لا توجد طلبات نشطة ظاهرة في مساحة المعاينة. يمكنك بدء طلب جديد ثم متابعة الحالة من صفحة معاملاتي.";
  if (normalized.includes("مستند") || normalized.includes("وثيقة")) return "يمكنك إضافة PDF أو صورة أو DOCX من مساحة العمل. راجع متطلبات الجهة الرسمية قبل الإرسال؛ المنصة لا تمثل أي جهة حكومية.";
  if (normalized.includes("موعد") || normalized.includes("تذكير")) return "سجّل الموعد في الطلب ثم فعّل التذكير وحدد الساعة والدقيقة. يُنصح بتأكيد تفاصيل الموعد من القناة الرسمية للجهة المختصة.";
  return "أستطيع مساعدتك في تنظيم الطلبات، المستندات، المواعيد، والإجراء التالي. لا أقدم تأكيداً رسمياً أو استشارة قانونية ملزمة. يمكنك تحويل استفسارك إلى موظف للمراجعة.";
}

export function InquiryProvider({ children }: PropsWithChildren) {
  const account = useAccount();
  const cloudRecord = trpc.cloud.get.useQuery({ recordType: "inquiries" }, { enabled: account.isAuthenticated, retry: 1 });
  const cloudPut = trpc.cloud.put.useMutation();
  const [tickets, setTickets] = useState<InquiryTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const storageKey = getAccountStorageKey(STORAGE_KEY, account.isAuthenticated ? account.user?.id : undefined);
  const persist = useCallback(async (next: InquiryTicket[]) => AsyncStorage.setItem(storageKey, JSON.stringify(next)), [storageKey]);
  useEffect(() => { void (async () => { setIsLoading(true); setTickets([]); try { const raw = await AsyncStorage.getItem(storageKey); if (raw) setTickets(JSON.parse(raw) as InquiryTicket[]); } finally { setIsLoading(false); } })(); }, [storageKey]);
  useEffect(() => { if (!account.isAuthenticated || isLoading || cloudRecord.isLoading) return; const payload = cloudRecord.data?.payload; if (Array.isArray(payload)) { setTickets(payload as InquiryTicket[]); return; } if (!cloudRecord.data && tickets.length) void cloudPut.mutateAsync({ recordType: "inquiries", payload: tickets }).catch(() => undefined); }, [account.isAuthenticated, cloudPut, cloudRecord.data, cloudRecord.isLoading, isLoading, tickets]);
  const sync = useCallback(async (next: InquiryTicket[]) => { await persist(next); if (account.isAuthenticated) { try { await cloudPut.mutateAsync({ recordType: "inquiries", payload: next }); } catch { /* تبقى النسخة المحلية آمنة حتى عودة الاتصال. */ } } }, [account.isAuthenticated, cloudPut, persist]);
  const createInquiry = useCallback(async (subject: string, message: string, transactions: GovernmentTransaction[], link?: { transactionId: string; transactionTitle: string }) => { const ticket: InquiryTicket = { id: `inquiry-${Date.now()}`, subject, message, status: "open", createdAt: new Date().toISOString(), assistantReply: buildLocalGuidance(message, transactions), ...link }; const next = [ticket, ...tickets]; setTickets(next); await sync(next); return ticket; }, [sync, tickets]);
  const escalate = useCallback(async (id: string) => { const next = tickets.map((ticket) => ticket.id === id ? { ...ticket, status: "escalated" as const } : ticket); setTickets(next); await sync(next); }, [sync, tickets]);
  const value = useMemo(() => ({ tickets, isLoading: isLoading || (account.isAuthenticated && cloudRecord.isLoading), createInquiry, escalate }), [account.isAuthenticated, cloudRecord.isLoading, createInquiry, escalate, isLoading, tickets]);
  return <InquiryContext.Provider value={value}>{children}</InquiryContext.Provider>;
}

export function useInquiries() { const context = useContext(InquiryContext); if (!context) throw new Error("useInquiries must be used within InquiryProvider"); return context; }
