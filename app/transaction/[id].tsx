import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/status-pill";
import { isTerminalStatus, isTransactionOverdue, statusDetails, TransactionStatus } from "@/lib/transactions";
import { useTransactions } from "@/lib/transactions-provider";

const suggestedNextStatus: Partial<Record<TransactionStatus, TransactionStatus>> = {
  draft: "received", received: "under_review", under_review: "awaiting_assignment", awaiting_assignment: "assigned", assigned: "document_verification", document_verification: "ready_for_submission", ready_for_submission: "submitted_to_agency", submitted_to_agency: "under_agency_review", under_agency_review: "awaiting_appointment", awaiting_appointment: "beneficiary_attendance_required", beneficiary_attendance_required: "completed", awaiting_customer_documents: "document_verification", revision_required: "under_review", payment_required: "under_agency_review", suspended: "under_review", overdue: "under_review",
};

export default function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, deleteTransaction, updateStatus } = useTransactions();
  const transaction = transactions.find((item) => item.id === id);

  if (!transaction) {
    return <ScreenContainer style={styles.notFound}><Text style={styles.notFoundTitle}>لم نعثر على هذا الطلب</Text><Pressable onPress={() => router.replace("/(tabs)/transactions")} style={styles.backToList}><Text style={styles.backToListText}>العودة إلى معاملاتي</Text></Pressable></ScreenContainer>;
  }

  const transactionId = transaction.id;
  const effectiveStatus = isTransactionOverdue(transaction) ? "overdue" : transaction.status;
  const nextStatus = isTerminalStatus(transaction.status) ? undefined : suggestedNextStatus[effectiveStatus];
  const requirements = effectiveStatus === "awaiting_customer_documents"
    ? ["إرفاق المستند المطلوب من فريق المتابعة.", "التأكد من وضوح الملفات وصلاحيتها قبل الإرسال."]
    : effectiveStatus === "payment_required"
      ? ["مراجعة الرسوم المطلوبة قبل إتمام الإجراء.", "إرفاق إثبات السداد بعد توفره."]
      : ["احتفظ بالمستندات الأساسية جاهزة عند طلبها.", "راجع الإجراء التالي وتواصل مع الفريق عند الحاجة."];

  function confirmDelete() {
    Alert.alert("حذف الطلب؟", "سيُحذف السجل من جهازك ولا يمكن استعادته من التطبيق.", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => { void deleteTransaction(transactionId); router.replace("/(tabs)/transactions"); } },
    ]);
  }

  function advanceStatus() {
    if (!nextStatus) return;
    Alert.alert("تحديث حالة الطلب", `هل تريد تحديث الحالة إلى «${statusDetails[nextStatus].label}»؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "تحديث", onPress: () => { void updateStatus(transactionId, nextStatus, "تم تحديث الحالة من مساحة المتابعة."); } },
    ]);
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons name="close" color="#17382F" size={23} /></Pressable>
          <View style={styles.navActions}>
            <Pressable onPress={confirmDelete} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons name="trash-outline" color="#B42318" size={20} /></Pressable>
            <Pressable onPress={() => router.push({ pathname: "/transaction/form", params: { id: transactionId } })} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons name="pencil-outline" color="#0B5D45" size={20} /></Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroMark}><Ionicons name="folder-open" color="#0B5D45" size={26} /></View>
          <Text style={styles.eyebrow}>{transaction.requestNumber || "طلب أبو مشعل"}</Text>
          <Text style={styles.title}>{transaction.title}</Text>
          <Text style={styles.agency}>{transaction.agency}</Text>
          <StatusPill status={effectiveStatus} />
        </View>

        <View style={styles.actionCard}>
          <View style={styles.actionIcon}><Ionicons name="navigate-outline" size={21} color="#0B5D45" /></View>
          <View style={styles.actionCopy}><Text style={styles.actionLabel}>الإجراء التالي</Text><Text style={styles.actionText}>{transaction.nextAction || statusDetails[effectiveStatus].description}</Text></View>
        </View>

        <View style={styles.infoCard}>
          <DetailRow icon="person-outline" label="المستفيد" value={transaction.customerName || "لم يُحدّد"} />
          <DetailRow icon="briefcase-outline" label="الموظف المسؤول" value={transaction.assigneeName || "سيُعيَّن بعد المراجعة"} />
          <DetailRow icon="document-text-outline" label="الرقم المرجعي" value={transaction.reference || "لم يُضف"} />
          <DetailRow icon="calendar-outline" label="موعد المتابعة" value={transaction.dueDate || "لم يُحدّد"} last />
        </View>

        <Text style={styles.sectionTitle}>المتطلبات والإجراء المطلوب</Text>
        <View style={detailStyles.requirementsCard}>
          {requirements.map((requirement) => <View key={requirement} style={detailStyles.requirementRow}><Ionicons name="checkmark-circle-outline" size={19} color="#0B5D45" /><Text style={detailStyles.requirementText}>{requirement}</Text></View>)}
          <View style={detailStyles.actions}>
            <Pressable onPress={() => router.push("/workspace" as never)} style={({ pressed }) => [detailStyles.action, pressed && styles.pressed]}><Ionicons name="attach-outline" size={18} color="#0B5D45" /><Text style={detailStyles.actionText}>المستندات</Text></Pressable>
            <Pressable onPress={() => router.push({ pathname: "/inquiries", params: { transactionId, transactionTitle: transaction.title } } as never)} style={({ pressed }) => [detailStyles.action, pressed && styles.pressed]}><Ionicons name="chatbubble-ellipses-outline" size={18} color="#0B5D45" /><Text style={detailStyles.actionText}>إضافة استفسار</Text></Pressable>
          </View>
        </View>

        {nextStatus && <Pressable onPress={advanceStatus} style={({ pressed }) => [styles.advanceButton, pressed && styles.advancePressed]}><Ionicons name="sync-outline" size={20} color="#FFFFFF" /><Text style={styles.advanceText}>تحديث إلى «{statusDetails[nextStatus].label}»</Text></Pressable>}

        <Text style={styles.sectionTitle}>سجل المتابعة</Text>
        <View style={styles.timeline}>
          {[...(transaction.statusHistory ?? [])].reverse().map((entry, index) => <View key={entry.id} style={styles.timelineRow}><View style={styles.timelineRail}>{index < (transaction.statusHistory?.length ?? 0) - 1 && <View style={styles.timelineLine} />}<View style={styles.timelineDot}><Ionicons name="checkmark" size={11} color="#FFFFFF" /></View></View><View style={styles.timelineCopy}><View style={styles.timelineTop}><Text style={styles.timelineTime}>{new Date(entry.createdAt).toLocaleDateString("ar-SA")}</Text><Text style={styles.timelineStatus}>{statusDetails[entry.status].label}</Text></View><Text style={styles.timelineActor}>{entry.actorName || "فريق أبو مشعل"}</Text>{entry.note && <Text style={styles.timelineNote}>{entry.note}</Text>}</View></View>)}
        </View>

        <Text style={styles.sectionTitle}>ملاحظات الطلب</Text>
        <View style={styles.notesCard}><Text style={styles.notes}>{transaction.notes || "لا توجد ملاحظات إضافية في هذا الطلب."}</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}

const detailStyles = StyleSheet.create({
  requirementsCard: { backgroundColor: "#FFFFFF", borderColor: "#E2E8E3", borderRadius: 20, borderWidth: 1, gap: 12, padding: 16 },
  requirementRow: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 9 },
  requirementText: { color: "#41564B", flex: 1, fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl" },
  actions: { flexDirection: "row-reverse", gap: 9, marginTop: 5 },
  action: { alignItems: "center", backgroundColor: "#F2F8F3", borderRadius: 12, flex: 1, flexDirection: "row-reverse", gap: 6, justifyContent: "center", minHeight: 43 },
  actionText: { color: "#0B5D45", fontSize: 12, fontWeight: "800", writingDirection: "rtl" },
});

function DetailRow({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return <View style={[styles.detailRow, !last && styles.detailBorder]}><Ionicons name={icon} size={19} color="#66756E" /><View style={styles.detailCopy}><Text style={styles.detailValue}>{value}</Text><Text style={styles.detailLabel}>{label}</Text></View></View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 34 }, nav: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, navActions: { flexDirection: "row-reverse", gap: 8 }, iconButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2E8E3", borderRadius: 13, borderWidth: 1, height: 42, justifyContent: "center", width: 42 }, pressed: { opacity: 0.68 }, hero: { alignItems: "center", marginTop: 24 }, heroMark: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 18, height: 60, justifyContent: "center", width: 60 }, eyebrow: { color: "#0B5D45", fontSize: 12, fontWeight: "800", marginTop: 12, writingDirection: "rtl" }, title: { color: "#17382F", fontSize: 23, fontWeight: "800", marginTop: 4, textAlign: "center", writingDirection: "rtl" }, agency: { color: "#66756E", fontSize: 14, marginTop: 5, textAlign: "center", writingDirection: "rtl" }, actionCard: { alignItems: "center", backgroundColor: "#F2F8F3", borderColor: "#D7E9DB", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 12, marginTop: 20, padding: 14 }, actionIcon: { alignItems: "center", backgroundColor: "#E1F0E4", borderRadius: 12, height: 42, justifyContent: "center", width: 42 }, actionCopy: { alignItems: "flex-end", flex: 1 }, actionLabel: { color: "#0B5D45", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, actionText: { color: "#39564A", fontSize: 13, lineHeight: 20, marginTop: 3, textAlign: "right", writingDirection: "rtl" }, infoCard: { backgroundColor: "#FFFFFF", borderColor: "#E2E8E3", borderRadius: 20, borderWidth: 1, marginTop: 18, paddingHorizontal: 16 }, detailRow: { alignItems: "center", flexDirection: "row-reverse", gap: 12, paddingVertical: 14 }, detailBorder: { borderBottomColor: "#EDF1ED", borderBottomWidth: 1 }, detailCopy: { alignItems: "flex-end", flex: 1 }, detailValue: { color: "#17382F", fontSize: 14, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, detailLabel: { color: "#66756E", fontSize: 12, marginTop: 4, writingDirection: "rtl" }, advanceButton: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 16, flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginTop: 16, minHeight: 54 }, advanceText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", writingDirection: "rtl" }, advancePressed: { opacity: 0.86, transform: [{ scale: 0.98 }] }, sectionTitle: { color: "#344D42", fontSize: 15, fontWeight: "800", marginBottom: 10, marginTop: 26, textAlign: "right", writingDirection: "rtl" }, timeline: { backgroundColor: "#FFFFFF", borderColor: "#E2E8E3", borderRadius: 20, borderWidth: 1, padding: 16 }, timelineRow: { flexDirection: "row-reverse", gap: 12 }, timelineRail: { alignItems: "center", position: "relative", width: 20 }, timelineLine: { backgroundColor: "#D9E8DD", bottom: -15, position: "absolute", top: 16, width: 2 }, timelineDot: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 12, height: 22, justifyContent: "center", width: 22 }, timelineCopy: { alignItems: "flex-end", flex: 1, minHeight: 68, paddingBottom: 16 }, timelineTop: { flexDirection: "row-reverse", justifyContent: "space-between", width: "100%" }, timelineStatus: { color: "#17382F", fontSize: 14, fontWeight: "800", writingDirection: "rtl" }, timelineTime: { color: "#82958B", fontSize: 11, writingDirection: "rtl" }, timelineActor: { color: "#66756E", fontSize: 12, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, timelineNote: { color: "#4F655A", fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: "right", writingDirection: "rtl" }, notesCard: { backgroundColor: "#FFFFFF", borderColor: "#E2E8E3", borderRadius: 20, borderWidth: 1, padding: 16 }, notes: { color: "#475A50", fontSize: 14, lineHeight: 22, textAlign: "right", writingDirection: "rtl" }, notFound: { alignItems: "center", justifyContent: "center", padding: 24 }, notFoundTitle: { color: "#17382F", fontSize: 18, fontWeight: "800", writingDirection: "rtl" }, backToList: { backgroundColor: "#0B5D45", borderRadius: 14, marginTop: 14, paddingHorizontal: 16, paddingVertical: 11 }, backToListText: { color: "#FFFFFF", fontWeight: "800", writingDirection: "rtl" },
});
