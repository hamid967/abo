import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "@/components/ui/app-text";

import { StatusPill } from "@/components/status-pill";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { GovernmentTransaction, isTransactionOverdue, statusDetails, TransactionStatus } from "@/lib/transactions";

type TransactionCardProps = {
  transaction: GovernmentTransaction;
  onPress: () => void;
  variant?: "compact" | "standard";
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

export function TransactionCard({ transaction, onPress, variant = "standard" }: TransactionCardProps) {
  const motion = useReducedMotion();
  const computedStatus = isTransactionOverdue(transaction) ? "overdue" : transaction.status;
  const detail = statusDetails[computedStatus];
  const stage = getStage(computedStatus);
  const stageLabel = `المرحلة ${stage} من 4`;
  const progress = computedStatus === "completed" || computedStatus === "archived" ? 100 : Math.min(stage * 25, 75);
  const priority = transaction.priority === "urgent" ? { label: "عاجلة", color: "#C84141", background: "#FFF0EF" } : transaction.priority === "high" ? { label: "مرتفعة", color: "#D99022", background: "#FFF4E5" } : null;
  const visual = detail.tone === "green"
    ? { color: "#17804B", soft: "#E8F6EC", icon: "checkmark-done-outline" as const }
    : detail.tone === "amber"
      ? { color: "#B56A09", soft: "#FFF4E5", icon: "alert-circle-outline" as const }
      : detail.tone === "red"
        ? { color: "#B42318", soft: "#FFF0EF", icon: "warning-outline" as const }
        : { color: "#0B5CAD", soft: "#EAF3FF", icon: "sync-outline" as const };

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${transaction.title}، ${detail.label}، تقدم ${progress} بالمئة`} onPress={onPress} style={({ pressed }) => [styles.card, variant === "compact" && styles.compactCard, { borderRightColor: visual.color }, pressed && (motion.reducedMotion ? styles.pressedReduced : styles.pressed)]}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.title}>{transaction.title}</Text>
          <Text numberOfLines={1} style={styles.agency}>{transaction.agency}</Text>
        </View>
        <StatusPill status={computedStatus} />
      </View>

      {priority ? <View style={[styles.priorityBadge, { backgroundColor: priority.background }]}><Ionicons name="flag-outline" size={12} color={priority.color} /><Text style={[styles.priorityText, { color: priority.color }]}>{priority.label}</Text></View> : null}

      <View style={[styles.statusBand, { backgroundColor: visual.soft }]}>
        <View style={[styles.statusIcon, { backgroundColor: visual.color }]}><Ionicons name={visual.icon} size={18} color="#FFFFFF" /></View>
        <View style={styles.statusCopy}>
          <Text numberOfLines={1} style={[styles.statusTitle, { color: visual.color }]}>{detail.label}</Text>
          <Text numberOfLines={1} style={styles.statusDescription}>{transaction.nextAction || detail.description}</Text>
          <Text style={[styles.stageLabel, { color: visual.color }]}>{stageLabel}</Text>
        </View>
        <View style={styles.stageTrack}>{[1, 2, 3, 4].map((item) => <View key={item} style={[styles.stageDot, { backgroundColor: item <= stage ? visual.color : "#D9E4DD" }]} />)}</View>
      </View>

      <View style={styles.progressRow}><View style={styles.progressTrack}><View style={[styles.progressFill, { backgroundColor: visual.color, width: `${progress}%` }]} /></View><Text style={[styles.progressText, { color: visual.color }]}>{progress}%</Text></View>

      {variant === "standard" ? <><View style={styles.footer}>
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
      </> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderColor: "#DCE8DF", borderRadius: 20, borderRightWidth: 5, borderWidth: 1, marginBottom: 12, padding: 16 },
  compactCard: { padding: 13 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  pressedReduced: { opacity: 0.72 },
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
  priorityBadge: { alignItems: "center", alignSelf: "flex-end", borderRadius: 999, flexDirection: "row-reverse", gap: 4, marginTop: 9, paddingHorizontal: 8, paddingVertical: 4 },
  priorityText: { fontSize: 10, fontWeight: "900", writingDirection: "rtl" },
  stageTrack: { flexDirection: "row-reverse", gap: 3 },
  stageDot: { borderRadius: 3, height: 6, width: 6 },
  footer: { borderTopColor: "#E7EFE9", borderTopWidth: 1, flexDirection: "row-reverse", gap: 16, marginTop: 14, paddingTop: 12 },
  progressRow: { alignItems: "center", flexDirection: "row-reverse", gap: 8, marginTop: 11 },
  progressTrack: { backgroundColor: "#E7EFE9", borderRadius: 99, flex: 1, height: 6, overflow: "hidden" },
  progressFill: { borderRadius: 99, height: "100%" },
  progressText: { fontSize: 10, fontWeight: "900", minWidth: 32, textAlign: "left" },
  metaGroup: { alignItems: "center", flex: 1, flexDirection: "row-reverse", gap: 6, justifyContent: "flex-start" },
  metaIcon: { alignItems: "center", backgroundColor: "#F0F6F1", borderRadius: 8, height: 26, justifyContent: "center", width: 26 },
  metaIconUrgent: { backgroundColor: "#FFF0EF" },
  meta: { color: "#667085", flexShrink: 1, fontSize: 12, textAlign: "right", writingDirection: "rtl" },
  metaUrgent: { color: "#B42318", fontWeight: "800" },
  contextRow: { flexDirection: "row-reverse", gap: 10, justifyContent: "space-between", marginTop: 11 },
  contextText: { color: "#7A8A82", flex: 1, fontSize: 10, textAlign: "right", writingDirection: "rtl" },
});
