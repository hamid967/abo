import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatusPill } from "@/components/status-pill";
import { GovernmentTransaction, isTransactionOverdue, statusDetails, TransactionStatus } from "@/lib/transactions";

type TransactionCardProps = {
  transaction: GovernmentTransaction;
  onPress: () => void;
};

function formatDueDate(date?: string) {
  if (!date) return "لا يوجد موعد مسجّل";
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function getStage(status: TransactionStatus) {
  if (["draft", "received", "under_review", "awaiting_assignment", "assigned", "document_verification"].includes(status)) return 1;
  if (["awaiting_customer_documents", "awaiting_appointment", "beneficiary_attendance_required", "payment_required", "revision_required", "suspended"].includes(status)) return 2;
  if (["ready_for_submission", "submitted_to_agency", "under_agency_review"].includes(status)) return 3;
  return 4;
}

export function TransactionCard({ transaction, onPress }: TransactionCardProps) {
  const computedStatus = isTransactionOverdue(transaction) ? "overdue" : transaction.status;
  const detail = statusDetails[computedStatus];
  const stage = getStage(computedStatus);
  const stageLabel = `المرحلة ${stage} من 4`;
  const visual = detail.tone === "green"
    ? { color: "#17804B", soft: "#E8F6EC", icon: "checkmark-done-outline" as const }
    : detail.tone === "amber"
      ? { color: "#B56A09", soft: "#FFF4E5", icon: "alert-circle-outline" as const }
      : detail.tone === "red"
        ? { color: "#B42318", soft: "#FFF0EF", icon: "warning-outline" as const }
        : { color: "#0B5CAD", soft: "#EAF3FF", icon: "sync-outline" as const };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { borderRightColor: visual.color }, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.title}>{transaction.title}</Text>
          <Text numberOfLines={1} style={styles.agency}>{transaction.agency}</Text>
        </View>
        <StatusPill status={computedStatus} />
      </View>

      <View style={[styles.statusBand, { backgroundColor: visual.soft }]}>
        <View style={[styles.statusIcon, { backgroundColor: visual.color }]}><Ionicons name={visual.icon} size={18} color="#FFFFFF" /></View>
        <View style={styles.statusCopy}>
          <Text numberOfLines={1} style={[styles.statusTitle, { color: visual.color }]}>{detail.label}</Text>
          <Text numberOfLines={1} style={styles.statusDescription}>{transaction.nextAction || detail.description}</Text>
          <Text style={[styles.stageLabel, { color: visual.color }]}>{stageLabel}</Text>
        </View>
        <View style={styles.stageTrack}>{[1, 2, 3, 4].map((item) => <View key={item} style={[styles.stageDot, { backgroundColor: item <= stage ? visual.color : "#D9E4DD" }]} />)}</View>
      </View>

      <View style={styles.footer}>
        <View style={styles.metaGroup}>
          <View style={[styles.metaIcon, isTransactionOverdue(transaction) && styles.metaIconUrgent]}><Ionicons name="calendar-outline" size={14} color={isTransactionOverdue(transaction) ? "#B42318" : "#587066"} /></View>
          <Text style={[styles.meta, isTransactionOverdue(transaction) && styles.metaUrgent]}>{formatDueDate(transaction.dueDate)}</Text>
        </View>
        <View style={styles.metaGroup}>
          <View style={styles.metaIcon}><Ionicons name="document-text-outline" size={14} color="#587066" /></View>
          <Text style={styles.meta}>{transaction.reference || "بدون رقم مرجعي"}</Text>
        </View>
      </View>
      <View style={styles.contextRow}>
        <Text numberOfLines={1} style={styles.contextText}>آخر تحديث: {new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(transaction.updatedAt))}</Text>
        {transaction.assigneeName ? <Text numberOfLines={1} style={styles.contextText}>المسؤول: {transaction.assigneeName}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderColor: "#DCE8DF", borderRadius: 20, borderRightWidth: 5, borderWidth: 1, marginBottom: 12, padding: 16 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  topRow: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 12, justifyContent: "space-between" },
  titleBlock: { alignItems: "flex-end", flex: 1, gap: 4 },
  title: { color: "#172033", fontSize: 16, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  agency: { color: "#667085", fontSize: 13, textAlign: "right", writingDirection: "rtl" },
  statusBand: { alignItems: "center", borderRadius: 14, flexDirection: "row-reverse", gap: 10, marginTop: 14, padding: 10 },
  statusIcon: { alignItems: "center", borderRadius: 11, height: 34, justifyContent: "center", width: 34 },
  statusCopy: { alignItems: "flex-end", flex: 1 },
  statusTitle: { fontSize: 12, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  statusDescription: { color: "#587066", fontSize: 10, lineHeight: 15, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  stageLabel: { fontSize: 9, fontWeight: "800", marginTop: 4, textAlign: "right", writingDirection: "rtl" },
  stageTrack: { flexDirection: "row-reverse", gap: 3 },
  stageDot: { borderRadius: 3, height: 6, width: 6 },
  footer: { borderTopColor: "#E7EFE9", borderTopWidth: 1, flexDirection: "row-reverse", gap: 16, marginTop: 14, paddingTop: 12 },
  metaGroup: { alignItems: "center", flex: 1, flexDirection: "row-reverse", gap: 6, justifyContent: "flex-start" },
  metaIcon: { alignItems: "center", backgroundColor: "#F0F6F1", borderRadius: 8, height: 26, justifyContent: "center", width: 26 },
  metaIconUrgent: { backgroundColor: "#FFF0EF" },
  meta: { color: "#667085", flexShrink: 1, fontSize: 12, textAlign: "right", writingDirection: "rtl" },
  metaUrgent: { color: "#B42318", fontWeight: "800" },
  contextRow: { flexDirection: "row-reverse", gap: 10, justifyContent: "space-between", marginTop: 11 },
  contextText: { color: "#7A8A82", flex: 1, fontSize: 10, textAlign: "right", writingDirection: "rtl" },
});
