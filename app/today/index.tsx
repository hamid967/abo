import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import { useLocale } from "@/lib/locale-provider";
import { useTransactions } from "@/lib/transactions-provider";

type TodayItem = { id: string; transactionId: string; title: string; reason: string; action: string; priority: "urgent" | "today" | "week" | "follow_up"; dueDate?: string };

function daysUntil(value?: string) {
  if (!value) return undefined;
  const due = new Date(`${value}T12:00:00`);
  if (Number.isNaN(due.getTime())) return undefined;
  return Math.ceil((due.getTime() - Date.now()) / 86_400_000);
}

export default function TodayScreen() {
  const router = useRouter();
  const { locale, isArabic, direction } = useLocale();
  const { transactions, isLoading } = useTransactions();
  const text = isArabic ? {
    title: "يومي مع أبو مشعل", subtitle: "الأشياء اللي تحتاج انتباهك اليوم، مبنية على معاملاتك الفعلية.", urgent: "عاجل", today: "اليوم", week: "هذا الأسبوع", follow: "متابعة", open: "فتح السجل", empty: "ما فيه إجراء مطلوب حالياً. إذا أضفت موعد أو معاملة، بتظهر لك هنا بوضوح.", add: "بدء طلب جديد", status: "آخر نشاط",
  } : {
    title: "My Day", subtitle: "The items that need your attention, based on your real transactions.", urgent: "Urgent", today: "Today", week: "This week", follow: "Follow-up", open: "Open record", empty: "There is no action required right now. Add a transaction or a due date and it will appear here.", add: "Start a request", status: "Latest activity",
  };

  const items = useMemo<TodayItem[]>(() => transactions
    .filter((transaction) => transaction.status !== "completed" && transaction.status !== "cancelled")
    .map((transaction): TodayItem => {
      const remaining = daysUntil(transaction.dueDate);
      if (transaction.status === "awaiting_customer_documents") return { id: `${transaction.id}-documents`, transactionId: transaction.id, title: transaction.title, reason: isArabic ? "تحتاج مستنداً قبل ما تكتمل المتابعة." : "A document is required before follow-up can continue.", action: isArabic ? "إضافة المستند المطلوب" : "Add the required document", priority: "urgent", dueDate: transaction.dueDate };
      if (remaining !== undefined && remaining < 0) return { id: `${transaction.id}-overdue`, transactionId: transaction.id, title: transaction.title, reason: isArabic ? `تأخر الموعد ${Math.abs(remaining)} يوم.` : `The due date passed ${Math.abs(remaining)} day(s) ago.`, action: isArabic ? "مراجعة الموعد والإجراء التالي" : "Review the due date and next action", priority: "urgent", dueDate: transaction.dueDate };
      if (remaining === 0) return { id: `${transaction.id}-today`, transactionId: transaction.id, title: transaction.title, reason: isArabic ? "موعد المتابعة اليوم." : "The follow-up date is today.", action: isArabic ? "فتح تفاصيل الموعد" : "Open due-date details", priority: "today", dueDate: transaction.dueDate };
      if (remaining !== undefined && remaining <= 7) return { id: `${transaction.id}-week`, transactionId: transaction.id, title: transaction.title, reason: isArabic ? `الموعد خلال ${remaining} يوم.` : `The due date is in ${remaining} day(s).`, action: isArabic ? "الاستعداد للموعد" : "Prepare for the due date", priority: "week", dueDate: transaction.dueDate };
      return { id: `${transaction.id}-follow`, transactionId: transaction.id, title: transaction.title, reason: isArabic ? `آخر تحديث: ${transaction.updatedAt.slice(0, 10)}.` : `Last update: ${transaction.updatedAt.slice(0, 10)}.`, action: isArabic ? "مراجعة حالة المعاملة" : "Review transaction status", priority: "follow_up", dueDate: transaction.dueDate };
    })
    .sort((a, b) => ["urgent", "today", "week", "follow_up"].indexOf(a.priority) - ["urgent", "today", "week", "follow_up"].indexOf(b.priority)), [isArabic, transactions]);

  const labels = { urgent: text.urgent, today: text.today, week: text.week, follow_up: text.follow };
  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={styles.content} ListHeaderComponent={<View style={styles.header}><Text style={[styles.title, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{text.title}</Text><Text style={[styles.subtitle, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{text.subtitle}</Text></View>} ListEmptyComponent={isLoading ? <View style={styles.loading}><Text style={styles.loadingText}>{isArabic ? "قاعد نجهز يومك…" : "Preparing your day…"}</Text></View> : <EmptyState onAdd={() => router.push("/request/new" as never)} />} renderItem={({ item }) => <View style={[styles.card, item.priority === "urgent" && styles.urgentCard]}><View style={[styles.cardTop, { flexDirection: isArabic ? "row-reverse" : "row" }]}><View style={[styles.priority, item.priority === "urgent" && styles.urgentPriority]}><Text style={[styles.priorityText, item.priority === "urgent" && styles.urgentPriorityText]}>{labels[item.priority]}</Text></View><Text style={[styles.date, { writingDirection: direction }]}>{item.dueDate ? new Date(`${item.dueDate}T12:00:00`).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { day: "numeric", month: "short" }) : text.status}</Text></View><Text style={[styles.cardTitle, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{item.title}</Text><Text style={[styles.reason, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{item.reason}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${text.open}: ${item.title}`} onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: item.transactionId } })} style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}><Text style={styles.openText}>{item.action}</Text><Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={16} color="#0B5D45" /></Pressable></View>} ListFooterComponent={<Pressable onPress={() => router.push("/request/new" as never)} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Ionicons name="add" size={20} color="#FFFFFF" /><Text style={styles.addText}>{text.add}</Text></Pressable>} /></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { alignSelf: "center", maxWidth: 780, padding: 20, paddingBottom: 48, width: "100%" }, header: { marginBottom: 18 }, title: { color: "#17382F", fontSize: 25, fontWeight: "800" }, subtitle: { color: "#66756E", fontSize: 13, lineHeight: 21, marginTop: 5 }, card: { backgroundColor: "#FFFFFF", borderColor: "#E1E9E3", borderRadius: 20, borderWidth: 1, marginBottom: 11, padding: 15 }, urgentCard: { backgroundColor: "#FFF8EF", borderColor: "#F7D9AB" }, cardTop: { alignItems: "center", justifyContent: "space-between" }, priority: { backgroundColor: "#E9F5EC", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }, urgentPriority: { backgroundColor: "#FCE6C8" }, priorityText: { color: "#0B5D45", fontSize: 10, fontWeight: "800", writingDirection: "rtl" }, urgentPriorityText: { color: "#A24A05" }, date: { color: "#7C8B84", fontSize: 10 }, cardTitle: { color: "#17382F", fontSize: 15, fontWeight: "800", marginTop: 11 }, reason: { color: "#566D61", fontSize: 12, lineHeight: 19, marginTop: 5 }, openButton: { alignItems: "center", alignSelf: "flex-end", flexDirection: "row-reverse", gap: 4, marginTop: 12, paddingVertical: 3 }, openText: { color: "#0B5D45", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, addButton: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 15, flexDirection: "row-reverse", gap: 7, justifyContent: "center", marginTop: 8, paddingVertical: 14 }, addText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", writingDirection: "rtl" }, loading: { alignItems: "center", paddingVertical: 48 }, loadingText: { color: "#66756E", fontSize: 13, writingDirection: "rtl" }, pressed: { opacity: 0.76 } });
