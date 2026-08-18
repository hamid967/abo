import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../api/client";
import type { TransactionDetail, TransactionStatus } from "../data/transactions";
import { statusColor, statusLabel } from "../data/transactions";
import { useTransactionStore } from "../data/transactionStore";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { theme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "TransactionDetail">;
const operatorStatuses: TransactionStatus[] = ["received", "under_review", "awaiting_customer_documents", "ready_for_submission", "submitted_to_agency", "under_agency_review", "completed", "rejected", "cancelled"];

export function TransactionDetailScreen({ route }: Props) {
  const { refresh } = useTransactionStore();
  const [detail, setDetail] = useState<(TransactionDetail & { canUpdateStatus: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextAction, setNextAction] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await api.transactions.mobileDetail.query({ id: route.params.transactionId }) as { transaction: TransactionDetail; history: TransactionDetail["history"]; canUpdateStatus: boolean };
      const combined = { ...result.transaction, history: result.history, canUpdateStatus: result.canUpdateStatus };
      setDetail(combined); setNextAction(combined.nextAction ?? "");
    } catch { setError("ما قدرنا نفتح تفاصيل المعاملة. تأكد من صلاحيتك ثم جرّب مرة ثانية."); }
    finally { setLoading(false); }
  }, [route.params.transactionId]);
  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (status: TransactionStatus) => {
    if (!detail || saving) return;
    setSaving(true); setError(null);
    try {
      await api.transactions.updateStatus.mutate({ id: detail.id, status, nextAction: nextAction.trim() || undefined });
      await Promise.all([load(), refresh()]);
    } catch {
      Alert.alert("تعذر تحديث الحالة", "قد لا تملك صلاحية هذا الإجراء أو أن الاتصال انقطع. جرّب مرة ثانية.");
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.loading}>جارٍ فتح التفاصيل…</Text></View>;
  if (!detail) return <View style={styles.center}><Text style={styles.error}>{error ?? "المعاملة غير متاحة."}</Text><Pressable onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View>;
  return <ScrollView contentContainerStyle={styles.content}>
    <View style={styles.hero}><Text style={styles.reference}>{detail.referenceNumber ?? `AM-${detail.id}`}</Text><Text style={styles.title}>{detail.title}</Text><View style={[styles.status, { backgroundColor: `${statusColor(detail.status)}18` }]}><Text style={[styles.statusText, { color: statusColor(detail.status) }]}>{statusLabel[detail.status] ?? detail.status}</Text></View></View>
    <Section title="بيانات المعاملة"><DetailRow label="الخدمة" value={detail.serviceName ?? "غير محددة"} /><DetailRow label="المدينة" value={detail.city ?? "غير محددة"} /><DetailRow label="الأولوية" value={detail.priority} /><DetailRow label="الموعد" value={detail.dueAt ? new Date(detail.dueAt).toLocaleDateString("ar-SA") : "لا يوجد موعد محدد"} /><DetailRow label="آخر تحديث" value={new Date(detail.updatedAt).toLocaleString("ar-SA")} /><Text style={styles.description}>{detail.description || "لا يوجد وصف إضافي."}</Text></Section>
    <Section title="الإجراء التالي"><TextInput value={nextAction} onChangeText={setNextAction} editable={detail.canUpdateStatus && !saving} multiline placeholder="اكتب الإجراء التالي للعميل" placeholderTextColor="#84948C" style={styles.input} textAlign="right" /><Text style={styles.helper}>{detail.canUpdateStatus ? "يظهر هذا النص للعميل مع تحديث الحالة." : (detail.nextAction ?? "لا يوجد إجراء محدث.")}</Text></Section>
    {detail.canUpdateStatus ? <Section title="تحديث الحالة"><Text style={styles.helper}>تُطبّق الصلاحية في الخادم ويُسجل التغيير في سجل التدقيق.</Text><View style={styles.actions}>{operatorStatuses.map((status) => <Pressable key={status} disabled={saving || status === detail.status} onPress={() => void updateStatus(status)} style={[styles.actionButton, status === detail.status && styles.current, saving && styles.disabled]}><Text style={[styles.actionText, status === detail.status && styles.currentText]}>{statusLabel[status]}</Text></Pressable>)}</View></Section> : null}
    <Section title="سجل الحالة">{detail.history.length ? detail.history.map((item) => <View key={item.id} style={styles.history}><View style={[styles.dot, { backgroundColor: statusColor(item.status) }]} /><View style={styles.historyCopy}><Text style={styles.historyTitle}>{statusLabel[item.status] ?? item.status}</Text><Text style={styles.historyDate}>{new Date(item.createdAt).toLocaleString("ar-SA")}</Text>{item.note ? <Text style={styles.historyNote}>{item.note}</Text> : null}</View></View>) : <Text style={styles.helper}>لا يوجد سجل حالة ظاهر بعد.</Text>}</Section>
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </ScrollView>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function DetailRow({ label, value }: { label: string; value: string }) { return <View style={styles.row}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View>; }
const styles = StyleSheet.create({ content: { padding: 18, paddingBottom: 42 }, center: { alignItems: "center", backgroundColor: theme.colors.background, flex: 1, justifyContent: "center", padding: 24 }, loading: { color: theme.colors.muted, marginTop: 10, writingDirection: "rtl" }, hero: { alignItems: "flex-end", backgroundColor: "#EFF7F1", borderRadius: 18, padding: 18 }, reference: { color: theme.colors.primary, fontSize: 12, fontWeight: "900", writingDirection: "rtl" }, title: { color: theme.colors.foreground, fontSize: 23, fontWeight: "900", marginTop: 7, textAlign: "right", writingDirection: "rtl" }, status: { borderRadius: 12, marginTop: 12, paddingHorizontal: 10, paddingVertical: 6 }, statusText: { fontSize: 12, fontWeight: "900", writingDirection: "rtl" }, section: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: 15, borderWidth: 1, marginTop: 14, padding: 15 }, sectionTitle: { color: theme.colors.foreground, fontSize: 16, fontWeight: "900", marginBottom: 10, textAlign: "right", writingDirection: "rtl" }, row: { borderBottomColor: theme.colors.border, borderBottomWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 9 }, label: { color: theme.colors.muted, fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, value: { color: theme.colors.foreground, flex: 1, fontSize: 13, textAlign: "right", writingDirection: "rtl" }, description: { color: theme.colors.foreground, fontSize: 13, lineHeight: 22, marginTop: 13, textAlign: "right", writingDirection: "rtl" }, input: { borderColor: theme.colors.border, borderRadius: 11, borderWidth: 1, color: theme.colors.foreground, fontSize: 14, minHeight: 74, padding: 10, writingDirection: "rtl" }, helper: { color: theme.colors.muted, fontSize: 12, lineHeight: 19, marginTop: 8, textAlign: "right", writingDirection: "rtl" }, actions: { alignItems: "flex-end", flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 12 }, actionButton: { backgroundColor: "#EFF5F1", borderRadius: 11, paddingHorizontal: 10, paddingVertical: 9 }, actionText: { color: theme.colors.primary, fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, current: { backgroundColor: theme.colors.primary }, currentText: { color: "#FFFFFF" }, disabled: { opacity: 0.45 }, history: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 10, paddingVertical: 10 }, dot: { borderRadius: 6, height: 11, marginTop: 5, width: 11 }, historyCopy: { alignItems: "flex-end", flex: 1 }, historyTitle: { color: theme.colors.foreground, fontSize: 13, fontWeight: "900", writingDirection: "rtl" }, historyDate: { color: theme.colors.muted, fontSize: 11, marginTop: 3, writingDirection: "rtl" }, historyNote: { color: theme.colors.foreground, fontSize: 12, lineHeight: 19, marginTop: 5, textAlign: "right", writingDirection: "rtl" }, error: { color: "#B42318", fontSize: 13, lineHeight: 21, textAlign: "center", writingDirection: "rtl" }, retry: { backgroundColor: "#E8F4ED", borderRadius: 10, marginTop: 12, paddingHorizontal: 12, paddingVertical: 9 }, retryText: { color: theme.colors.primary, fontWeight: "900", writingDirection: "rtl" }, });
