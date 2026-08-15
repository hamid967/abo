import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/status-pill";
import { isTransactionOverdue, statusDetails, transactionStatuses } from "@/lib/transactions";
import { useTransactions } from "@/lib/transactions-provider";

export default function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, deleteTransaction, updateStatus } = useTransactions();
  const transaction = transactions.find((item) => item.id === id);

  if (!transaction) {
    return (
      <ScreenContainer style={styles.notFound}>
        <Text style={styles.notFoundTitle}>لم نعثر على هذه المعاملة</Text>
        <Pressable onPress={() => router.replace("/(tabs)/transactions")} style={styles.backToList}><Text style={styles.backToListText}>العودة إلى المعاملات</Text></Pressable>
      </ScreenContainer>
    );
  }

  const effectiveStatus = isTransactionOverdue(transaction) ? "overdue" : transaction.status;
  const transactionId = transaction.id;
  const statusIndex = transactionStatuses.indexOf(transaction.status);
  const nextStatus = transaction.status === "completed" ? null : transactionStatuses[Math.min(statusIndex + 1, transactionStatuses.length - 2)];

  function confirmDelete() {
    Alert.alert("حذف المعاملة؟", "سيُحذف هذا السجل من جهازك ولا يمكن استعادته من التطبيق.", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => { deleteTransaction(transactionId); router.replace("/(tabs)/transactions"); } },
    ]);
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons name="close" color="#172033" size={23} /></Pressable>
          <View style={styles.navActions}>
            <Pressable onPress={confirmDelete} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons name="trash-outline" color="#B42318" size={20} /></Pressable>
            <Pressable onPress={() => router.push({ pathname: "/transaction/form", params: { id: transaction.id } })} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons name="pencil-outline" color="#0B5CAD" size={20} /></Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroMark}><Ionicons name="document-text" color="#0B5CAD" size={26} /></View>
          <Text style={styles.title}>{transaction.title}</Text>
          <Text style={styles.agency}>{transaction.agency}</Text>
          <StatusPill status={effectiveStatus} />
        </View>

        <View style={styles.infoCard}>
          <DetailRow icon="document-text-outline" label="الرقم المرجعي" value={transaction.reference || "لم يُضف"} />
          <DetailRow icon="calendar-outline" label="موعد المتابعة" value={transaction.dueDate || "لم يُحدّد"} last />
        </View>

        <Text style={styles.sectionTitle}>مراحل المتابعة</Text>
        <View style={styles.timeline}>
          {transactionStatuses.filter((status) => status !== "overdue").map((status) => {
            const active = transactionStatuses.indexOf(status) <= Math.max(statusIndex, 0);
            return <View key={status} style={styles.timelineRow}><View style={[styles.timelineDot, active && styles.timelineDotActive]} /><Text style={[styles.timelineText, active && styles.timelineTextActive]}>{statusDetails[status].label}</Text></View>;
          })}
        </View>

        {nextStatus && (
          <Pressable onPress={() => updateStatus(transaction.id, nextStatus)} style={({ pressed }) => [styles.advanceButton, pressed && styles.advancePressed]}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            <Text style={styles.advanceText}>تحديث إلى «{statusDetails[nextStatus].label}»</Text>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>الملاحظات</Text>
        <View style={styles.notesCard}><Text style={styles.notes}>{transaction.notes || "لا توجد ملاحظات محفوظة لهذه المعاملة."}</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}

function DetailRow({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return <View style={[styles.detailRow, !last && styles.detailBorder]}><Ionicons name={icon} size={19} color="#667085" /><View style={styles.detailCopy}><Text style={styles.detailValue}>{value}</Text><Text style={styles.detailLabel}>{label}</Text></View></View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 34 },
  nav: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  navActions: { flexDirection: "row-reverse", gap: 8 },
  iconButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E6EAF0", borderRadius: 13, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  pressed: { opacity: 0.68 },
  hero: { alignItems: "center", marginTop: 26 },
  heroMark: { alignItems: "center", backgroundColor: "#EAF3FF", borderRadius: 18, height: 60, justifyContent: "center", width: 60 },
  title: { color: "#172033", fontSize: 23, fontWeight: "800", marginTop: 14, textAlign: "center", writingDirection: "rtl" },
  agency: { color: "#667085", fontSize: 14, marginTop: 5, textAlign: "center", writingDirection: "rtl" },
  infoCard: { backgroundColor: "#FFFFFF", borderColor: "#E6EAF0", borderRadius: 20, borderWidth: 1, marginTop: 22, paddingHorizontal: 16 },
  detailRow: { alignItems: "center", flexDirection: "row-reverse", gap: 12, paddingVertical: 15 },
  detailBorder: { borderBottomColor: "#EEF1F5", borderBottomWidth: 1 },
  detailCopy: { alignItems: "flex-end", flex: 1 },
  detailValue: { color: "#172033", fontSize: 14, fontWeight: "800", writingDirection: "rtl" },
  detailLabel: { color: "#667085", fontSize: 12, marginTop: 4, writingDirection: "rtl" },
  sectionTitle: { color: "#344054", fontSize: 14, fontWeight: "800", marginBottom: 10, marginTop: 26, textAlign: "right", writingDirection: "rtl" },
  timeline: { backgroundColor: "#FFFFFF", borderColor: "#E6EAF0", borderRadius: 20, borderWidth: 1, padding: 16 },
  timelineRow: { alignItems: "center", flexDirection: "row-reverse", gap: 10, paddingVertical: 8 },
  timelineDot: { backgroundColor: "#D9E0E8", borderRadius: 8, height: 12, width: 12 },
  timelineDotActive: { backgroundColor: "#0B5CAD" },
  timelineText: { color: "#98A2B3", fontSize: 14, writingDirection: "rtl" },
  timelineTextActive: { color: "#172033", fontWeight: "800" },
  advanceButton: { alignItems: "center", backgroundColor: "#0B5CAD", borderRadius: 16, flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginTop: 16, minHeight: 54 },
  advanceText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", writingDirection: "rtl" },
  advancePressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  notesCard: { backgroundColor: "#FFFFFF", borderColor: "#E6EAF0", borderRadius: 20, borderWidth: 1, padding: 16 },
  notes: { color: "#475467", fontSize: 14, lineHeight: 22, textAlign: "right", writingDirection: "rtl" },
  notFound: { alignItems: "center", justifyContent: "center", padding: 24 },
  notFoundTitle: { color: "#172033", fontSize: 18, fontWeight: "800", writingDirection: "rtl" },
  backToList: { backgroundColor: "#0B5CAD", borderRadius: 14, marginTop: 14, paddingHorizontal: 16, paddingVertical: 11 },
  backToListText: { color: "#FFFFFF", fontWeight: "800", writingDirection: "rtl" },
});
