import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { isTransactionOverdue } from "@/lib/transactions";
import { useTransactions } from "@/lib/transactions-provider";
import { useWorkspace } from "@/lib/workspace-provider";

export default function ReportsScreen() {
  const router = useRouter();
  const { transactions } = useTransactions();
  const { tasks, appointments } = useWorkspace();
  const completed = transactions.filter((item) => item.status === "completed").length;
  const overdue = transactions.filter((item) => isTransactionOverdue(item)).length;
  const actionRequired = transactions.filter((item) => ["awaiting_customer_documents", "payment_required", "revision_required", "beneficiary_attendance_required"].includes(item.status)).length;
  const openTasks = tasks.filter((item) => item.status !== "completed").length;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.nav}><Pressable onPress={() => router.back()} style={styles.closeButton}><Ionicons name="close" size={22} color="#17382F" /></Pressable><View style={styles.navCopy}><Text style={styles.brand}>أبو مشعل</Text><Text style={styles.title}>التقارير التشغيلية</Text></View></View>
    <Text style={styles.subtitle}>ملخص لحالة بيانات مساحة المعاينة الحالية. تظهر التقارير الموسعة والتصدير بعد ربط الحسابات والبيانات السحابية.</Text>
    <View style={styles.grid}><Metric label="إجمالي الطلبات" value={transactions.length} icon="layers-outline" /><Metric label="مكتملة" value={completed} icon="checkmark-done-outline" tone="green" /><Metric label="تحتاج إجراء" value={actionRequired} icon="alert-circle-outline" tone="amber" /><Metric label="متأخرة" value={overdue} icon="time-outline" tone="red" /></View>
    <Text style={styles.sectionTitle}>ملخص العمل</Text>
    <View style={styles.card}><ReportRow label="المهام المفتوحة" value={`${openTasks} مهمة`} icon="checkbox-outline" /><ReportRow label="المواعيد المسجلة" value={`${appointments.length} موعد`} icon="calendar-outline" last /><Text style={styles.note}>تعتمد الأرقام على السجلات المحلية الحالية. لا تستخدم المنصة بيانات حكومية أو شخصية حقيقية في وضع المعاينة.</Text></View>
    <Text style={styles.sectionTitle}>أولويات المتابعة</Text>
    <View style={styles.card}><ReportRow label="طلبات بانتظار مستندات" value={`${transactions.filter((item) => item.status === "awaiting_customer_documents").length} طلب`} icon="document-attach-outline" /><ReportRow label="طلبات تحت مراجعة الجهة" value={`${transactions.filter((item) => item.status === "under_agency_review").length} طلب`} icon="business-outline" /><ReportRow label="طلبات بموعد قريب" value={`${transactions.filter((item) => Boolean(item.dueDate)).length} طلب`} icon="alarm-outline" last /></View>
  </ScrollView></ScreenContainer>;
}
function Metric({ label, value, icon, tone }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; tone?: "green" | "amber" | "red" }) { return <View style={[styles.metric, tone === "amber" && styles.metricAmber, tone === "red" && styles.metricRed]}><Ionicons name={icon} size={20} color={tone === "amber" ? "#AA6D12" : tone === "red" ? "#B42318" : "#0B5D45"} /><Text style={styles.metricNumber}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function ReportRow({ label, value, icon, last }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; last?: boolean }) { return <View style={[styles.row, !last && styles.rowBorder]}><Ionicons name={icon} size={19} color="#0B5D45" /><View style={styles.rowCopy}><Text style={styles.rowValue}>{value}</Text><Text style={styles.rowLabel}>{label}</Text></View></View>; }
const styles = StyleSheet.create({ content: { padding: 20, paddingBottom: 34 }, nav: { alignItems: "center", flexDirection: "row-reverse", gap: 12 }, closeButton: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, navCopy: { alignItems: "flex-end", flex: 1 }, brand: { color: "#0B5D45", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, title: { color: "#17382F", fontSize: 22, fontWeight: "800", writingDirection: "rtl" }, subtitle: { color: "#66756E", fontSize: 13, lineHeight: 20, marginTop: 18, textAlign: "right", writingDirection: "rtl" }, grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10, marginTop: 18 }, metric: { backgroundColor: "#F1F8F3", borderColor: "#D9EBDD", borderRadius: 16, borderWidth: 1, minHeight: 108, padding: 13, width: "48.5%" }, metricAmber: { backgroundColor: "#FFF8EC", borderColor: "#F0D9A7" }, metricRed: { backgroundColor: "#FFF1F0", borderColor: "#F3CECB" }, metricNumber: { color: "#17382F", fontSize: 27, fontWeight: "800", marginTop: 8 }, metricLabel: { color: "#66756E", fontSize: 12, marginTop: 3, writingDirection: "rtl" }, sectionTitle: { color: "#344D42", fontSize: 15, fontWeight: "800", marginBottom: 10, marginTop: 26, textAlign: "right", writingDirection: "rtl" }, card: { backgroundColor: "#FFFFFF", borderColor: "#E1E9E3", borderRadius: 18, borderWidth: 1, paddingHorizontal: 15 }, row: { alignItems: "center", flexDirection: "row-reverse", gap: 12, paddingVertical: 14 }, rowBorder: { borderBottomColor: "#EDF1ED", borderBottomWidth: 1 }, rowCopy: { alignItems: "flex-end", flex: 1 }, rowValue: { color: "#17382F", fontSize: 14, fontWeight: "800", writingDirection: "rtl" }, rowLabel: { color: "#66756E", fontSize: 12, marginTop: 3, writingDirection: "rtl" }, note: { color: "#6C7F75", fontSize: 11, lineHeight: 17, paddingBottom: 14, textAlign: "right", writingDirection: "rtl" }, });
