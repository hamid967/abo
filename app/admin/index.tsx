import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text, AppTextInput as TextInput } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { trpc } from "@/lib/trpc";

const filters = [
  { label: "الكل", value: undefined },
  { label: "بانتظار مستندات", value: "awaiting_customer_documents" },
  { label: "متأخرة", value: "overdue" },
  { label: "مكتملة", value: "completed" },
] as const;

const approvalAlertWindowOptions = [24, 48, 72] as const;

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { isAuthenticated, account } = useAccount();
  const [status, setStatus] = useState<(typeof filters)[number]["value"]>();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState<string | undefined>();

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim().length >= 2 ? searchInput.trim() : undefined), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const dashboard = trpc.adminDashboard.overview.useQuery({ status, search }, { enabled: isAuthenticated && (account?.role === "admin" || account?.role === "super_admin"), retry: false });
  const workload = trpc.adminDashboard.workload.useQuery(undefined, { enabled: isAuthenticated && (account?.role === "admin" || account?.role === "super_admin"), retry: false });
  const audit = trpc.audit.list.useQuery({ limit: 10 }, { enabled: isAuthenticated && (account?.role === "admin" || account?.role === "super_admin"), retry: false });
  const updateApprovalAlertSettings = trpc.adminDashboard.updateApprovalAlertSettings.useMutation();

  if (!isAuthenticated) return <AccessState icon="log-in-outline" title="سجّل الدخول أولاً" body="تحتاج لوحة الإدارة إلى جلسة حساب فعلية." action="فتح الحساب" onPress={() => router.push("/account" as never)} />;
  if (account?.role !== "admin" && account?.role !== "super_admin") return <AccessState icon="shield-outline" title="ليس لديك إذن الإدارة" body="تقتصر هذه اللوحة على المدير أو المدير العام." action="العودة للإعدادات" onPress={() => router.back()} />;
  if (dashboard.isLoading) return <ScreenContainer style={styles.loading}><ActivityIndicator color="#0B5D45" /><Text style={styles.loadingText}>جارٍ تحميل مؤشرات النظام...</Text></ScreenContainer>;
  if (dashboard.error || !dashboard.data) return <AccessState icon="alert-circle-outline" title="تعذر تحميل البيانات" body="تحقق من الاتصال أو صلاحيات الحساب ثم أعد المحاولة." action="إعادة المحاولة" onPress={() => void dashboard.refetch()} />;

  const { metrics, transactions } = dashboard.data;
  const hasApprovalsAtRisk = metrics.approvalsExpiringSoon > 0;
  const updateAlertWindow = async (approvalAlertWindowHours: (typeof approvalAlertWindowOptions)[number]) => {
    if (metrics.approvalAlertWindowHours === approvalAlertWindowHours || updateApprovalAlertSettings.isPending) return;
    try {
      await updateApprovalAlertSettings.mutateAsync({ approvalAlertWindowHours });
      await dashboard.refetch();
    } catch {
      Alert.alert("تعذر حفظ الإعداد", "ما قدرنا نحدّث نافذة تنبيه الموافقات الحين. جرّب مرة ثانية.");
    }
  };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.container}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="إغلاق لوحة الإدارة" onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={22} color="#17382F" /></Pressable>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>أبو مشعل · إدارة النظام</Text><Text style={styles.title}>متابعة المعاملات</Text></View>
    </View>

    <View style={styles.metrics}>
      <Metric label="إجمالي المعاملات" value={metrics.total} icon="layers-outline" />
      <Metric label="نشطة" value={metrics.active} icon="pulse-outline" />
      <Metric label="متأخرة" value={metrics.overdue} icon="alert-circle-outline" tone="alert" />
      <Metric label="بانتظار مستندات" value={metrics.awaitingDocuments} icon="document-text-outline" tone="warm" />
      <Metric label="مكتملة" value={metrics.completed} icon="checkmark-circle-outline" tone="success" />
    </View>

    <View accessibilityRole="alert" style={[styles.approvalRisk, !hasApprovalsAtRisk && styles.approvalRiskClear]}>
      <View style={styles.approvalRiskIcon}><Ionicons name={hasApprovalsAtRisk ? "alarm-outline" : "checkmark-circle-outline"} size={22} color={hasApprovalsAtRisk ? "#B42318" : "#0B5D45"} /></View>
      <View style={styles.approvalRiskCopy}>
        <Text style={[styles.approvalRiskTitle, !hasApprovalsAtRisk && styles.approvalRiskTitleClear]}>موافقات تنتهي خلال {metrics.approvalAlertWindowHours} ساعة</Text>
        <Text style={styles.approvalRiskBody}>{hasApprovalsAtRisk ? "تابع مع الموافقين قبل انتهاء مهلة القرار." : "ما فيه موافقات معلقة قرب موعد انتهائها."}</Text>
      </View>
      <Text style={[styles.approvalRiskCount, !hasApprovalsAtRisk && styles.approvalRiskCountClear]}>{metrics.approvalsExpiringSoon}</Text>
    </View>

    <View style={styles.alertWindowSettings}>
      <View style={styles.alertWindowHeader}><Ionicons name="options-outline" size={18} color="#0B5D45" /><View style={styles.alertWindowCopy}><Text style={styles.alertWindowTitle}>إعدادات تنبيه الموافقين</Text><Text style={styles.alertWindowBody}>اختر الفترة التي يظهر فيها عدّاد الموافقات القريبة من الانتهاء.</Text></View></View>
      <View style={styles.alertWindowOptions}>{approvalAlertWindowOptions.map((hours) => <Pressable key={hours} accessibilityRole="button" accessibilityLabel={`نافذة التنبيه ${hours} ساعة`} accessibilityState={{ selected: metrics.approvalAlertWindowHours === hours, disabled: updateApprovalAlertSettings.isPending }} disabled={updateApprovalAlertSettings.isPending} onPress={() => void updateAlertWindow(hours)} style={[styles.alertWindowOption, metrics.approvalAlertWindowHours === hours && styles.alertWindowOptionActive, updateApprovalAlertSettings.isPending && styles.alertWindowOptionDisabled]}><Text style={[styles.alertWindowOptionText, metrics.approvalAlertWindowHours === hours && styles.alertWindowOptionTextActive]}>{hours} ساعة</Text></Pressable>)}</View>
      {updateApprovalAlertSettings.isPending && <View style={styles.alertWindowSaving}><ActivityIndicator size="small" color="#0B5D45" /><Text style={styles.alertWindowSavingText}>جارٍ حفظ الإعداد...</Text></View>}
    </View>

    {workload.data && <View style={styles.workload}>
      <View style={styles.workloadHeader}><Ionicons name="people-outline" size={19} color="#0B5D45" /><View style={styles.workloadCopy}><Text style={styles.workloadTitle}>عبء عمل الفريق</Text><Text style={styles.workloadBody}>المهام المفتوحة والمتأخرة حسب المسؤول، من بيانات التشغيل الفعلية.</Text></View></View>
      <View style={styles.workloadMetrics}><Text style={styles.workloadMetric}>مفتوحة: {workload.data.totalActive}</Text><Text style={[styles.workloadMetric, workload.data.overdue > 0 && styles.workloadMetricAlert]}>متأخرة: {workload.data.overdue}</Text><Text style={styles.workloadMetric}>غير معيّنة: {workload.data.unassigned}</Text></View>
      {workload.data.team.slice(0, 5).map((member) => <View key={member.assigneeUserId ?? "unassigned"} style={styles.workloadRow}><Text style={styles.workloadCount}>{member.active} مفتوحة{member.overdue ? ` · ${member.overdue} متأخرة` : ""}</Text><Text style={styles.workloadName}>{member.name}</Text></View>)}
    </View>}

    <Pressable onPress={() => router.push("/admin/automation" as never)} style={styles.automationLink}><Ionicons name="flash-outline" size={18} color="#0B5D45" /><View style={styles.automationCopy}><Text style={styles.automationTitle}>مركز الأتمتة والعمليات</Text><Text style={styles.automationBody}>مراجعة القواعد ونتائج التشغيل والتحويلات البشرية.</Text></View><Ionicons name="chevron-back" size={18} color="#0B5D45" /></Pressable>
    <Pressable onPress={() => router.push("/admin/playbooks" as never)} style={styles.automationLink}><Ionicons name="book-outline" size={18} color="#0B5D45" /><View style={styles.automationCopy}><Text style={styles.automationTitle}>Playbooks الخدمات</Text><Text style={styles.automationBody}>إدارة خطوات الخدمة والإصدارات المنشورة بدون تغيير الطلبات السابقة.</Text></View><Ionicons name="chevron-back" size={18} color="#0B5D45" /></Pressable>
    <Pressable onPress={() => router.push("/admin/official-updates" as never)} style={styles.automationLink}><Ionicons name="newspaper-outline" size={18} color="#0B5D45" /><View style={styles.automationCopy}><Text style={styles.automationTitle}>مركز التحديثات الرسمية</Text><Text style={styles.automationBody}>جمع المصادر المعتمدة ومراجعة المواد قبل نشرها للمستخدمين.</Text></View><Ionicons name="chevron-back" size={18} color="#0B5D45" /></Pressable>
    <Pressable onPress={() => router.push("/admin/gaps" as never)} style={styles.automationLink}><Ionicons name="shield-checkmark-outline" size={18} color="#0B5D45" /><View style={styles.automationCopy}><Text style={styles.automationTitle}>فجوات الأمن والبيانات</Text><Text style={styles.automationBody}>ملخص أولويات المرحلة صفر والإجراءات المطلوبة قبل التوسع.</Text></View><Ionicons name="chevron-back" size={18} color="#0B5D45" /></Pressable>

    <Text style={styles.sectionTitle}>البحث والتصفية</Text>
    <View style={styles.searchBox}><Ionicons name="search-outline" size={19} color="#66756E" /><TextInput value={searchInput} onChangeText={setSearchInput} placeholder="ابحث برقم المعاملة أو العميل أو الجوال أو المنشأة" placeholderTextColor="#93A39C" style={styles.searchInput} textAlign="right" /></View>
    <View style={styles.filters}>{filters.map((filter) => <Pressable key={filter.label} accessibilityRole="button" accessibilityState={{ selected: status === filter.value }} onPress={() => setStatus(filter.value)} style={[styles.filter, status === filter.value && styles.filterActive]}><Text style={[styles.filterText, status === filter.value && styles.filterTextActive]}>{filter.label}</Text></Pressable>)}</View>
    <Text style={styles.sectionTitle}>{search ? `نتائج البحث عن «${search}»` : "أحدث المعاملات"}</Text>
    <FlatList data={transactions} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>لا توجد معاملات ضمن المرشح الحالي.</Text></View>} ListFooterComponent={audit.data?.length ? <View><Text style={styles.sectionTitle}>أحدث سجل تدقيق</Text>{audit.data.map((item) => <View key={item.id} style={styles.auditRow}><Ionicons name="shield-checkmark-outline" size={17} color="#0B5D45" /><View style={styles.auditCopy}><Text style={styles.auditTitle}>{formatAuditAction(item.action)}</Text><Text style={styles.auditMeta}>{item.actorName || `حساب #${item.actorUserId ?? "—"}`} · {new Date(item.createdAt).toLocaleString("ar-SA")}</Text></View></View>)}</View> : null} renderItem={({ item }) => <View style={styles.row}><View style={styles.rowIcon}><Ionicons name="folder-open-outline" size={20} color="#0B5D45" /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.referenceNumber || `معاملة #${item.id}`}</Text><Text style={styles.rowMeta}>{item.customerName || `عميل #${item.customerUserId}`} · {formatStatus(item.status)} · {formatPriority(item.priority)}</Text>{item.organizationName && <Text style={styles.rowAction}>المنشأة: {item.organizationName}</Text>}{item.customerPhone && <Text style={styles.rowAction}>الجوال: {maskPhone(item.customerPhone)}</Text>}{item.nextAction && <Text style={styles.rowAction}>{item.nextAction}</Text>}</View></View>} />
  </View></ScreenContainer>;
}

function Metric({ label, value, icon, tone }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; tone?: "alert" | "warm" | "success" }) { return <View style={[styles.metric, tone === "alert" && styles.metricAlert, tone === "warm" && styles.metricWarm, tone === "success" && styles.metricSuccess]}><Ionicons name={icon} size={19} color={tone === "alert" ? "#B42318" : tone === "warm" ? "#B45309" : "#0B5D45"} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function AccessState({ icon, title, body, action, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; action: string; onPress: () => void }) { return <ScreenContainer style={styles.state}><Ionicons name={icon} size={42} color="#0B5D45" /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateBody}>{body}</Text><Pressable onPress={onPress} style={styles.stateButton}><Text style={styles.stateButtonText}>{action}</Text></Pressable></ScreenContainer>; }
function formatStatus(status: string) { return ({ awaiting_customer_documents: "بانتظار مستندات", overdue: "متأخرة", completed: "مكتملة", under_review: "تحت المراجعة", received: "مستلمة" } as Record<string, string>)[status] ?? status; }
function formatPriority(priority: string) { return ({ low: "منخفضة", normal: "عادية", high: "عالية", urgent: "عاجلة" } as Record<string, string>)[priority] ?? priority; }
function formatAuditAction(action: string) { return ({ "transaction.status_updated": "تحديث حالة معاملة", "ticket.created": "إنشاء تذكرة دعم", "ticket.updated": "تحديث تذكرة دعم", "ticket.message_added": "إضافة رسالة دعم", "ticket.internal_message_added": "إضافة ملاحظة داخلية", "admin.dashboard_search": "بحث في لوحة الإدارة", "admin.dashboard_view": "عرض لوحة الإدارة", "search.records": "بحث ضمن السجلات", "knowledge.article_created": "نشر مقال معرفة", "knowledge.faq_created": "نشر سؤال شائع", "notification.read": "قراءة إشعار" } as Record<string, string>)[action] ?? action; }
function maskPhone(phone: string) { return phone.length > 4 ? `${phone.slice(0, 2)}••••${phone.slice(-2)}` : "••••"; }

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { alignItems: "center", flexDirection: "row-reverse", gap: 12 },
  close: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  headerCopy: { alignItems: "flex-end", flex: 1 },
  eyebrow: { color: "#0B5D45", fontSize: 12, fontWeight: "800", writingDirection: "rtl" },
  title: { color: "#17382F", fontSize: 22, fontWeight: "800", marginTop: 3, writingDirection: "rtl" },
  metrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9, marginTop: 22 },
  metric: { alignItems: "flex-end", backgroundColor: "#F2F8F3", borderRadius: 16, minHeight: 104, padding: 12, width: "31%" },
  metricAlert: { backgroundColor: "#FEF3F2" }, metricWarm: { backgroundColor: "#FFF7E8" }, metricSuccess: { backgroundColor: "#ECFDF3" },
  metricValue: { color: "#17382F", fontSize: 22, fontWeight: "800", marginTop: 8 },
  metricLabel: { color: "#5B7165", fontSize: 10, fontWeight: "700", marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  approvalRisk: { alignItems: "center", backgroundColor: "#FEF1EF", borderColor: "#F1C8C3", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 11, marginTop: 13, padding: 13 },
  approvalRiskClear: { backgroundColor: "#EDF8F0", borderColor: "#CBE6D1" },
  approvalRiskIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  approvalRiskCopy: { alignItems: "flex-end", flex: 1 },
  approvalRiskTitle: { color: "#8B241B", fontSize: 13, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  approvalRiskTitleClear: { color: "#0B5D45" },
  approvalRiskBody: { color: "#72514C", fontSize: 10, lineHeight: 16, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  approvalRiskCount: { color: "#B42318", fontSize: 28, fontWeight: "900" }, approvalRiskCountClear: { color: "#0B5D45" },
  alertWindowSettings: { backgroundColor: "#F7FBF8", borderColor: "#DCEADF", borderRadius: 16, borderWidth: 1, marginTop: 10, padding: 13 },
  alertWindowHeader: { alignItems: "center", flexDirection: "row-reverse", gap: 8 }, alertWindowCopy: { alignItems: "flex-end", flex: 1 },
  alertWindowTitle: { color: "#0B5D45", fontSize: 12, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  alertWindowBody: { color: "#587166", fontSize: 10, lineHeight: 16, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  alertWindowOptions: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  alertWindowOption: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#CFE0D3", borderRadius: 10, borderWidth: 1, flex: 1, paddingHorizontal: 7, paddingVertical: 9 },
  alertWindowOptionActive: { backgroundColor: "#0B5D45", borderColor: "#0B5D45" }, alertWindowOptionDisabled: { opacity: 0.65 },
  alertWindowOptionText: { color: "#315442", fontSize: 11, fontWeight: "800", writingDirection: "rtl" }, alertWindowOptionTextActive: { color: "#FFFFFF" },
  alertWindowSaving: { alignItems: "center", flexDirection: "row-reverse", gap: 6, justifyContent: "flex-start", marginTop: 10 }, alertWindowSavingText: { color: "#587166", fontSize: 10, writingDirection: "rtl" },
  workload: { backgroundColor: "#F7FBF8", borderColor: "#DCEADF", borderRadius: 16, borderWidth: 1, marginTop: 15, padding: 13 },
  workloadHeader: { alignItems: "center", flexDirection: "row-reverse", gap: 8 }, workloadCopy: { alignItems: "flex-end", flex: 1 },
  workloadTitle: { color: "#0B5D45", fontSize: 13, fontWeight: "900", writingDirection: "rtl" },
  workloadBody: { color: "#587166", fontSize: 10, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  workloadMetrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginTop: 10 },
  workloadMetric: { backgroundColor: "#E9F5EC", borderRadius: 999, color: "#315442", fontSize: 10, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 5, writingDirection: "rtl" },
  workloadMetricAlert: { backgroundColor: "#FEF1EF", color: "#A3382E" },
  workloadRow: { borderTopColor: "#E2ECE4", borderTopWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 8, paddingTop: 8 },
  workloadName: { color: "#315442", fontSize: 11, fontWeight: "800", writingDirection: "rtl" }, workloadCount: { color: "#6B8075", fontSize: 10, writingDirection: "rtl" },
  automationLink: { alignItems: "center", backgroundColor: "#E9F5EC", borderColor: "#C5DFCD", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 15, padding: 13 },
  automationCopy: { alignItems: "flex-end", flex: 1 }, automationTitle: { color: "#0B5D45", fontSize: 13, fontWeight: "900", writingDirection: "rtl" }, automationBody: { color: "#4D6B5E", fontSize: 10, marginTop: 3, writingDirection: "rtl" },
  sectionTitle: { color: "#344D42", fontSize: 15, fontWeight: "800", marginTop: 23, textAlign: "right", writingDirection: "rtl" },
  searchBox: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 8, marginTop: 10, minHeight: 50, paddingHorizontal: 13 },
  searchInput: { color: "#17382F", flex: 1, fontSize: 14, writingDirection: "rtl" },
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 10 }, filter: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  filterActive: { backgroundColor: "#E9F5EC", borderColor: "#0B5D45" }, filterText: { color: "#66756E", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, filterTextActive: { color: "#0B5D45" },
  list: { gap: 10, paddingBottom: 35, paddingTop: 11 },
  row: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#E1E9E3", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 11, padding: 14 },
  rowIcon: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 12, height: 40, justifyContent: "center", width: 40 }, rowCopy: { alignItems: "flex-end", flex: 1 },
  rowTitle: { color: "#17382F", fontSize: 14, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, rowMeta: { color: "#6A7C73", fontSize: 11, lineHeight: 18, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, rowAction: { color: "#476256", fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "right", writingDirection: "rtl" },
  auditRow: { alignItems: "flex-start", backgroundColor: "#F7FAF8", borderColor: "#DCE7DE", borderRadius: 12, borderWidth: 1, flexDirection: "row-reverse", gap: 9, marginTop: 8, padding: 11 }, auditCopy: { alignItems: "flex-end", flex: 1 }, auditTitle: { color: "#25463A", fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, auditMeta: { color: "#74877D", fontSize: 10, marginTop: 4, textAlign: "right", writingDirection: "rtl" },
  empty: { alignItems: "center", backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 16, borderStyle: "dashed", borderWidth: 1, padding: 24 }, emptyText: { color: "#66756E", fontSize: 13, writingDirection: "rtl" },
  loading: { alignItems: "center", gap: 12, justifyContent: "center" }, loadingText: { color: "#66756E", fontSize: 13, writingDirection: "rtl" },
  state: { alignItems: "center", justifyContent: "center", padding: 28 }, stateTitle: { color: "#17382F", fontSize: 19, fontWeight: "800", marginTop: 14, writingDirection: "rtl" }, stateBody: { color: "#66756E", fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: "center", writingDirection: "rtl" }, stateButton: { backgroundColor: "#0B5D45", borderRadius: 13, marginTop: 18, paddingHorizontal: 16, paddingVertical: 11 }, stateButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
});
