import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { trpc } from "@/lib/trpc";

type PreviewResult = { matched: boolean; triggerEvent: string; actionPlan: { order: number; type: string; wouldRun: boolean }[]; sideEffectsExecuted: false };

export default function AutomationOperationsScreen() {
  const router = useRouter();
  const { isAuthenticated, account } = useAccount();
  const allowed = isAuthenticated && (account?.role === "admin" || account?.role === "super_admin");
  const dashboard = trpc.automationOps.dashboard.useQuery(undefined, { enabled: allowed, retry: false });
  const toggleRule = trpc.automationOps.setRuleEnabled.useMutation({ onSuccess: () => void dashboard.refetch() });
  const previewRule = trpc.automationOps.previewRule.useMutation();
  const [previews, setPreviews] = useState<Record<string, PreviewResult>>({});
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function runPreview(rule: { id: string; conditions: unknown }) {
    setPreviewError(null);
    try {
      const payload = payloadFromConditions(rule.conditions);
      const result = await previewRule.mutateAsync({ ruleId: rule.id, payload });
      setPreviews((current) => ({ ...current, [rule.id]: result }));
    } catch { setPreviewError("تعذر تنفيذ المعاينة الآمنة. جرّب مرة ثانية."); }
  }

  if (!allowed) return <ScreenContainer style={styles.state}><Ionicons name="shield-outline" size={42} color="#0B5D45" /><Text style={styles.stateTitle}>ليست لديك صلاحية مركز الأتمتة</Text><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>العودة</Text></Pressable></ScreenContainer>;
  if (dashboard.isLoading) return <ScreenContainer style={styles.state}><ActivityIndicator color="#0B5D45" /><Text style={styles.stateTitle}>قاعد نحمّل عمليات الأتمتة…</Text></ScreenContainer>;
  if (!dashboard.data) return <ScreenContainer style={styles.state}><Text style={styles.stateTitle}>ما قدرنا نحمّل مركز الأتمتة</Text><Pressable onPress={() => void dashboard.refetch()} style={styles.backButton}><Text style={styles.backText}>جرّب مرة ثانية</Text></Pressable></ScreenContainer>;
  const { metrics, rules, runs } = dashboard.data;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.container}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>أبو مشعل · إدارة النظام</Text><Text style={styles.title}>مركز الأتمتة والعمليات</Text></View></View>
    <View style={styles.previewNotice}><Ionicons name="flask-outline" size={18} color="#0B5D45" /><Text style={styles.previewNoticeText}>المعاينة تفحص الشروط وتعرض خطة الإجراءات فقط، ولا ترسل إشعاراً ولا تنشئ مهمة.</Text></View>
    <View style={styles.metrics}><Metric label="قواعد مفعلة" value={metrics.activeRules} icon="flash-outline" /><Metric label="تشغيل ناجح" value={metrics.successfulRuns} icon="checkmark-circle-outline" /><Metric label="تشغيل فاشل" value={metrics.failedRuns} icon="alert-circle-outline" tone="alert" /><Metric label="تحويلات مفتوحة" value={metrics.pendingHandoffs} icon="people-outline" tone="warm" /></View>
    <Text style={styles.section}>قواعد الأتمتة</Text>
    {previewError ? <Text style={styles.errorBanner}>{previewError}</Text> : null}
    {rules.map((rule) => <View key={rule.id} style={styles.rule}>
      <View style={styles.ruleTop}><View style={styles.ruleCopy}><Text style={styles.ruleName}>{rule.name}</Text><Text style={styles.ruleMeta}>{rule.triggerEvent} · أولوية {rule.priority}</Text></View><Pressable disabled={toggleRule.isPending} onPress={() => toggleRule.mutate({ ruleId: rule.id, enabled: !rule.enabled })} style={[styles.toggle, rule.enabled && styles.toggleOn]}><Text style={[styles.toggleText, rule.enabled && styles.toggleTextOn]}>{rule.enabled ? "مفعلة" : "متوقفة"}</Text></Pressable></View>
      <View style={styles.ruleActions}><Pressable disabled={previewRule.isPending} onPress={() => void runPreview(rule)} style={styles.previewButton}>{previewRule.isPending ? <ActivityIndicator size="small" color="#0B5D45" /> : <Ionicons name="play-outline" size={16} color="#0B5D45" />}<Text style={styles.previewButtonText}>معاينة آمنة</Text></Pressable></View>
      {previews[rule.id] ? <View style={styles.previewResult}><Text style={styles.previewResultTitle}>{previews[rule.id].matched ? "الشروط متطابقة مع العينة" : "الشروط غير متطابقة"}</Text>{previews[rule.id].actionPlan.length ? previews[rule.id].actionPlan.map((action) => <Text key={`${rule.id}-${action.order}`} style={styles.previewAction}>{action.order}. {actionLabel(action.type)} — {action.wouldRun ? "سيُنفذ" : "لن يُنفذ"}</Text>) : <Text style={styles.previewAction}>لا توجد إجراءات مسجلة في القاعدة.</Text>}<Text style={styles.noSideEffects}>لم تُنفذ أي آثار جانبية.</Text></View> : null}
    </View>)}
    <Text style={styles.section}>آخر عمليات التشغيل</Text>
    {runs.length ? runs.map((run) => <View key={run.id} style={styles.run}><Ionicons name={run.status === "failed" ? "alert-circle-outline" : run.status === "succeeded" ? "checkmark-circle-outline" : "time-outline"} size={19} color={run.status === "failed" ? "#B42318" : "#0B5D45"} /><View style={styles.runCopy}><Text style={styles.runTitle}>{run.ruleName}</Text><Text style={styles.runMeta}>{run.eventName} · {new Date(run.createdAt).toLocaleString("ar-SA")}</Text>{run.errorCode ? <Text style={styles.error}>{run.errorCode}</Text> : null}</View><Text style={styles.runStatus}>{labelStatus(run.status)}</Text></View>) : <View style={styles.empty}><Text style={styles.emptyText}>ما فيه عمليات تشغيل مسجلة للحين.</Text></View>}
  </ScrollView></ScreenContainer>;
}

function payloadFromConditions(conditions: unknown) {
  if (!conditions || typeof conditions !== "object") return {};
  const equals = (conditions as Record<string, unknown>).equals;
  if (!equals || typeof equals !== "object" || Array.isArray(equals)) return {};
  return Object.fromEntries(Object.entries(equals as Record<string, unknown>).filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value)).slice(0, 20)) as Record<string, string | number | boolean | null>;
}

function actionLabel(type: string) {
  return ({ in_app_notification: "إشعار داخل التطبيق", create_task: "إنشاء مهمة", escalate_to_supervisor: "تصعيد للمشرف", request_document: "طلب مستند", schedule_reminder: "جدولة تذكير", close_completed_task: "إغلاق مهمة مكتملة" } as Record<string, string>)[type] ?? type;
}

function Metric({ label, value, icon, tone }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; tone?: "alert" | "warm" }) { return <View style={[styles.metric, tone === "alert" && styles.metricAlert, tone === "warm" && styles.metricWarm]}><Ionicons name={icon} size={18} color={tone === "alert" ? "#B42318" : tone === "warm" ? "#B45309" : "#0B5D45"} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function labelStatus(status: string) { return ({ succeeded: "نجاح", failed: "تعذر", skipped: "متخطاة", running: "قيد التنفيذ", pending: "بانتظار" } as Record<string, string>)[status] ?? status; }

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48 }, header: { alignItems: "center", flexDirection: "row-reverse", gap: 12 }, close: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, headerCopy: { alignItems: "flex-end", flex: 1 }, eyebrow: { color: "#0B5D45", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, title: { color: "#17382F", fontSize: 21, fontWeight: "900", marginTop: 3, writingDirection: "rtl" }, previewNotice: { alignItems: "flex-start", backgroundColor: "#EFF7F1", borderColor: "#CEE2D3", borderRadius: 13, borderWidth: 1, flexDirection: "row-reverse", gap: 8, marginTop: 16, padding: 11 }, previewNoticeText: { color: "#49665B", flex: 1, fontSize: 10, lineHeight: 16, textAlign: "right" }, metrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9, marginTop: 16 }, metric: { alignItems: "flex-end", backgroundColor: "#F2F8F3", borderRadius: 15, padding: 11, width: "48%" }, metricAlert: { backgroundColor: "#FEF3F2" }, metricWarm: { backgroundColor: "#FFF7E8" }, metricValue: { color: "#17382F", fontSize: 20, fontWeight: "900", marginTop: 5 }, metricLabel: { color: "#5B7165", fontSize: 10, fontWeight: "700", marginTop: 2, writingDirection: "rtl" }, section: { color: "#344D42", fontSize: 15, fontWeight: "900", marginTop: 22, textAlign: "right", writingDirection: "rtl" }, rule: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 15, borderWidth: 1, gap: 9, marginTop: 9, padding: 12 }, ruleTop: { alignItems: "center", flexDirection: "row-reverse", gap: 10 }, ruleCopy: { alignItems: "flex-end", flex: 1 }, ruleName: { color: "#17382F", fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, ruleMeta: { color: "#6A7C73", fontSize: 10, marginTop: 4, writingDirection: "ltr" }, ruleActions: { alignItems: "flex-start" }, toggle: { backgroundColor: "#F6F8F6", borderColor: "#D5E0D7", borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 }, toggleOn: { backgroundColor: "#E9F5EC", borderColor: "#0B5D45" }, toggleText: { color: "#66756E", fontSize: 10, fontWeight: "800", writingDirection: "rtl" }, toggleTextOn: { color: "#0B5D45" }, previewButton: { alignItems: "center", backgroundColor: "#EFF7F1", borderRadius: 10, flexDirection: "row-reverse", gap: 5, minHeight: 36, paddingHorizontal: 10 }, previewButtonText: { color: "#0B5D45", fontSize: 10, fontWeight: "800" }, previewResult: { backgroundColor: "#F8FAF8", borderRadius: 11, gap: 4, padding: 9 }, previewResultTitle: { color: "#25463A", fontSize: 10, fontWeight: "900", textAlign: "right" }, previewAction: { color: "#5B7165", fontSize: 9, lineHeight: 15, textAlign: "right" }, noSideEffects: { color: "#7A8B82", fontSize: 9, fontStyle: "italic", marginTop: 3, textAlign: "right" }, errorBanner: { backgroundColor: "#FEF3F2", borderRadius: 10, color: "#B42318", fontSize: 10, marginTop: 8, padding: 9, textAlign: "right" }, run: { alignItems: "flex-start", backgroundColor: "#F9FBF9", borderColor: "#E1E9E3", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 9, marginTop: 8, padding: 11 }, runCopy: { alignItems: "flex-end", flex: 1 }, runTitle: { color: "#25463A", fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, runMeta: { color: "#74877D", fontSize: 9, marginTop: 3, textAlign: "right", writingDirection: "rtl" }, runStatus: { color: "#49665B", fontSize: 10, fontWeight: "800", writingDirection: "rtl" }, error: { color: "#B42318", fontSize: 9, marginTop: 3 }, empty: { alignItems: "center", backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 14, borderStyle: "dashed", borderWidth: 1, marginTop: 9, padding: 20 }, emptyText: { color: "#66756E", fontSize: 12, writingDirection: "rtl" }, state: { alignItems: "center", flex: 1, justifyContent: "center", padding: 28 }, stateTitle: { color: "#17382F", fontSize: 16, fontWeight: "800", marginTop: 12, textAlign: "center", writingDirection: "rtl" }, backButton: { backgroundColor: "#0B5D45", borderRadius: 12, marginTop: 15, paddingHorizontal: 16, paddingVertical: 10 }, backText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", writingDirection: "rtl" },
});
