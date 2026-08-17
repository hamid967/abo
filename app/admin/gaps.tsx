import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { trpc } from "@/lib/trpc";

const priorityMeta = {
  p0: { label: "P0 · معالجة قبل التوسع", color: "#B42318", background: "#FEF1EF", border: "#F1C8C3" },
  p1: { label: "P1 · أساس المرحلة التالية", color: "#A15C07", background: "#FFF7E8", border: "#F4DBA9" },
  p2: { label: "P2 · تحسين مؤسسي لاحق", color: "#0B5D45", background: "#EDF8F0", border: "#CBE6D1" },
} as const;

const categoryMeta = {
  security: { label: "الأمن والخصوصية", icon: "shield-checkmark-outline" as const, color: "#8B241B" },
  database: { label: "قاعدة البيانات", icon: "server-outline" as const, color: "#185C8A" },
} as const;

export default function GovernanceGapsScreen() {
  const router = useRouter();
  const { isAuthenticated, account } = useAccount();
  const isAdmin = account?.role === "admin" || account?.role === "super_admin";
  const gaps = trpc.adminDashboard.governanceGaps.useQuery(undefined, { enabled: isAuthenticated && isAdmin, retry: false });

  if (!isAuthenticated) return <AccessState icon="log-in-outline" title="سجّل الدخول أولاً" body="تحتاج تقارير الفجوات إلى جلسة حساب إدارية." action="فتح الحساب" onPress={() => router.push("/account" as never)} />;
  if (!isAdmin) return <AccessState icon="shield-outline" title="ليس لديك إذن الإدارة" body="تقتصر تقارير فجوات الأمن والبيانات على المدير أو المدير العام." action="العودة" onPress={() => router.back()} />;
  if (gaps.isLoading) return <ScreenContainer style={styles.center}><ActivityIndicator color="#0B5D45" /><Text style={styles.centerText}>جارٍ تجهيز ملخص الفجوات...</Text></ScreenContainer>;
  if (gaps.error || !gaps.data) return <AccessState icon="alert-circle-outline" title="تعذر تحميل الملخص" body="تحقق من الاتصال أو صلاحية الإدارة، ثم حاول مرة ثانية." action="إعادة المحاولة" onPress={() => void gaps.refetch()} />;

  const { summary, gaps: items, auditBaseline, auditDate } = gaps.data;
  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><FlatList
    data={items}
    keyExtractor={(item) => item.id}
    contentContainerStyle={styles.list}
    refreshControl={<RefreshControl refreshing={gaps.isFetching} onRefresh={() => void gaps.refetch()} tintColor="#0B5D45" />}
    ListHeaderComponent={<View>
      <View style={styles.header}><Pressable accessibilityLabel="العودة إلى لوحة الإدارة" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-forward" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>أبو مشعل · إدارة النظام</Text><Text style={styles.title}>فجوات الأمن والبيانات</Text><Text style={styles.subtitle}>ملخص قابل للتنفيذ من تقارير {auditBaseline}، وليس فحصاً لحظياً للبنية.</Text></View></View>
      <View style={styles.banner}><Ionicons name="document-text-outline" size={21} color="#0B5D45" /><View style={styles.bannerCopy}><Text style={styles.bannerTitle}>خط أساس موثّق</Text><Text style={styles.bannerBody}>تاريخ التدقيق: {new Date(`${auditDate}T00:00:00`).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}</Text></View></View>
      <View style={styles.metrics}><Metric label="إجمالي الفجوات" value={summary.total} icon="layers-outline" /><Metric label="P0" value={summary.p0} icon="alert-circle-outline" tone="p0" /><Metric label="P1" value={summary.p1} icon="flag-outline" tone="p1" /><Metric label="أمن" value={summary.security} icon="shield-checkmark-outline" tone="security" /><Metric label="بيانات" value={summary.database} icon="server-outline" tone="database" /></View>
      <Text style={styles.sectionTitle}>الأولوية والإجراء التالي</Text>
    </View>}
    renderItem={({ item }) => <GapCard item={item} />}
    ListFooterComponent={<View style={styles.footer}><Ionicons name="information-circle-outline" size={18} color="#4D6B5E" /><Text style={styles.footerText}>يُحدّث هذا الملخص عند اعتماد تدقيق جديد. لا تعني الفجوة وجود اختراق أو فقد بيانات؛ هي بند متابعة قبل التوسع.</Text></View>}
  /></ScreenContainer>;
}

function GapCard({ item }: { item: { category: "security" | "database"; priority: "p0" | "p1" | "p2"; title: string; summary: string; nextAction: string; report: string } }) {
  const priority = priorityMeta[item.priority];
  const category = categoryMeta[item.category];
  return <View style={styles.card}><View style={styles.cardHeader}><View style={styles.category}><Ionicons name={category.icon} size={16} color={category.color} /><Text style={[styles.categoryText, { color: category.color }]}>{category.label}</Text></View><Text style={[styles.priority, { backgroundColor: priority.background, borderColor: priority.border, color: priority.color }]}>{priority.label}</Text></View><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardBody}>{item.summary}</Text><View style={styles.nextAction}><Ionicons name="arrow-back-outline" size={16} color="#0B5D45" /><View style={styles.nextActionCopy}><Text style={styles.nextActionLabel}>الإجراء التالي</Text><Text style={styles.nextActionText}>{item.nextAction}</Text></View></View><Text style={styles.reportRef}>المرجع: {item.report}</Text></View>;
}

function Metric({ label, value, icon, tone }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; tone?: "p0" | "p1" | "security" | "database" }) {
  const color = tone === "p0" ? "#B42318" : tone === "p1" ? "#A15C07" : tone === "database" ? "#185C8A" : "#0B5D45";
  const background = tone === "p0" ? "#FEF1EF" : tone === "p1" ? "#FFF7E8" : tone === "database" ? "#EFF8FF" : "#EDF8F0";
  return <View style={[styles.metric, { backgroundColor: background }]}><Ionicons name={icon} size={18} color={color} /><Text style={[styles.metricValue, { color }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function AccessState({ icon, title, body, action, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; action: string; onPress: () => void }) {
  return <ScreenContainer style={styles.center}><Ionicons name={icon} size={42} color="#0B5D45" /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateBody}>{body}</Text><Pressable onPress={onPress} style={styles.stateButton}><Text style={styles.stateButtonText}>{action}</Text></Pressable></ScreenContainer>;
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 36 },
  header: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 12 }, back: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, headerCopy: { alignItems: "flex-end", flex: 1 },
  eyebrow: { color: "#0B5D45", fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, title: { color: "#17382F", fontSize: 22, fontWeight: "900", marginTop: 3, textAlign: "right", writingDirection: "rtl" }, subtitle: { color: "#5B7165", fontSize: 11, lineHeight: 18, marginTop: 5, textAlign: "right", writingDirection: "rtl" },
  banner: { alignItems: "center", backgroundColor: "#EDF8F0", borderColor: "#CBE6D1", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 18, padding: 13 }, bannerCopy: { alignItems: "flex-end", flex: 1 }, bannerTitle: { color: "#0B5D45", fontSize: 12, fontWeight: "900", writingDirection: "rtl" }, bannerBody: { color: "#4D6B5E", fontSize: 10, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  metrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 13 }, metric: { alignItems: "flex-end", borderRadius: 14, minHeight: 82, padding: 10, width: "31%" }, metricValue: { fontSize: 21, fontWeight: "900", marginTop: 5 }, metricLabel: { color: "#5B7165", fontSize: 10, fontWeight: "800", marginTop: 2, writingDirection: "rtl" },
  sectionTitle: { color: "#344D42", fontSize: 15, fontWeight: "900", marginBottom: 9, marginTop: 22, textAlign: "right", writingDirection: "rtl" },
  card: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 17, borderWidth: 1, marginBottom: 11, padding: 14 }, cardHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, category: { alignItems: "center", flexDirection: "row-reverse", gap: 5 }, categoryText: { fontSize: 10, fontWeight: "900", writingDirection: "rtl" }, priority: { borderRadius: 999, borderWidth: 1, fontSize: 9, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5, writingDirection: "rtl" }, cardTitle: { color: "#17382F", fontSize: 14, fontWeight: "900", marginTop: 12, textAlign: "right", writingDirection: "rtl" }, cardBody: { color: "#5B7165", fontSize: 11, lineHeight: 18, marginTop: 5, textAlign: "right", writingDirection: "rtl" },
  nextAction: { backgroundColor: "#F4FAF5", borderRadius: 12, flexDirection: "row-reverse", gap: 8, marginTop: 12, padding: 10 }, nextActionCopy: { alignItems: "flex-end", flex: 1 }, nextActionLabel: { color: "#0B5D45", fontSize: 10, fontWeight: "900", writingDirection: "rtl" }, nextActionText: { color: "#315442", fontSize: 10, lineHeight: 16, marginTop: 3, textAlign: "right", writingDirection: "rtl" }, reportRef: { color: "#84948B", fontSize: 9, marginTop: 10, textAlign: "right", writingDirection: "rtl" },
  footer: { alignItems: "flex-start", backgroundColor: "#F7FAF8", borderColor: "#DCE7DE", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 8, marginTop: 5, padding: 12 }, footerText: { color: "#4D6B5E", flex: 1, fontSize: 10, lineHeight: 16, textAlign: "right", writingDirection: "rtl" },
  center: { alignItems: "center", gap: 12, justifyContent: "center", padding: 28 }, centerText: { color: "#66756E", fontSize: 13, writingDirection: "rtl" }, stateTitle: { color: "#17382F", fontSize: 19, fontWeight: "900", marginTop: 5, writingDirection: "rtl" }, stateBody: { color: "#66756E", fontSize: 13, lineHeight: 20, textAlign: "center", writingDirection: "rtl" }, stateButton: { backgroundColor: "#0B5D45", borderRadius: 13, paddingHorizontal: 16, paddingVertical: 11 }, stateButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
});
