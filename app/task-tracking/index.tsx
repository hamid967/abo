import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ScreenContainer } from "@/components/screen-container";
import { SlaBadge } from "@/components/sla-badge";
import { SlaSummaryChart } from "@/components/sla-summary-chart";
import { SlaWeeklyTrendChart } from "@/components/sla-weekly-trend-chart";
import { AppText as Text } from "@/components/ui/app-text";
import { calculateSlaDashboard } from "@/lib/sla-dashboard";
import { calculateSlaWeeklyTrend, type SlaTrendPeriodDays } from "@/lib/sla-weekly-trend";
import { syncTaskToCalendar } from "@/lib/task-calendar";
import { syncTaskSlaAlerts } from "@/lib/notification-service";
import { trpc } from "@/lib/trpc";

type TaskFilter = "all" | "needs_attention" | "overdue";

export default function TaskTrackingScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [trendPeriodDays, setTrendPeriodDays] = useState<SlaTrendPeriodDays>(7);
  const [now, setNow] = useState(() => new Date());
  const [calendarTaskId, setCalendarTaskId] = useState<number | null>(null);
  const tracking = trpc.taskTracking.list.useQuery(undefined, { refetchInterval: 60_000 });
  const preferences = trpc.notificationPreferences.get.useQuery();
  const updateStatus = trpc.taskTracking.updateStatus.useMutation({ onSuccess: () => void tracking.refetch() });
  const savePreferences = trpc.notificationPreferences.update.useMutation({ onSuccess: () => void preferences.refetch() });
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!tracking.data || !preferences.data) return;
    void syncTaskSlaAlerts({ tasks: tracking.data, enabled: preferences.data.taskAlertsEnabled, reminderMinutes: preferences.data.taskReminderMinutes }).catch(() => undefined);
  }, [preferences.data, tracking.data]);
  const dashboard = useMemo(() => calculateSlaDashboard(tracking.data ?? [], now), [now, tracking.data]);
  const weeklyTrend = useMemo(() => calculateSlaWeeklyTrend(tracking.data ?? [], now, trendPeriodDays), [now, tracking.data, trendPeriodDays]);
  const items = useMemo(() => (tracking.data ?? []).filter((task) => {
    if (filter === "all") return task.status !== "cancelled";
    const dueAt = task.slaDueAt ?? task.dueAt;
    if (!dueAt) return filter === "needs_attention" && task.status !== "completed";
    const remaining = new Date(dueAt).getTime() - Date.now();
    return filter === "overdue" ? remaining < 0 && task.status !== "completed" : remaining < 8 * 60 * 60 * 1000 && task.status !== "completed";
  }), [filter, tracking.data]);

  function complete(taskId: number) {
    Alert.alert("إكمال المهمة؟", "تتوقف متابعة SLA بعد الإكمال وتُحفظ العملية في سجل التدقيق.", [{ text: "إلغاء", style: "cancel" }, { text: "إكمال", onPress: () => void updateStatus.mutateAsync({ taskId, status: "completed" }).catch(() => Alert.alert("ما قدرنا نكمل المهمة", "تحقق من اتصالك وحاول مرة ثانية.")) }]);
  }

  async function addTaskToCalendar(task: NonNullable<typeof tracking.data>[number]) {
    if (!preferences.data || calendarTaskId !== null) return;
    setCalendarTaskId(task.id);
    try {
      const result = await syncTaskToCalendar(task, preferences.data.taskReminderMinutes);
      if (result.success) {
        if (!preferences.data.calendarSyncEnabled) await savePreferences.mutateAsync({ ...preferences.data, calendarSyncEnabled: true });
        Alert.alert(result.updated ? "تم تحديث التقويم" : "تمت الإضافة إلى التقويم", "سيظهر موعد المهمة في تقويم جهازك مع تنبيه قبل موعد SLA.");
        return;
      }
      const messages = { unsupported: "التقويم غير متاح على هذا الجهاز.", permission_denied: "لم تمنح إذن الوصول إلى التقويم.", no_due_date: "لا يوجد موعد محدد لهذه المهمة بعد.", no_writable_calendar: "ما فيه تقويم قابل للإضافة على هذا الجهاز.", failed: "ما قدرنا نضيف المهمة للتقويم الآن." } as const;
      Alert.alert("تعذر ربط التقويم", messages[result.reason]);
    } finally {
      setCalendarTaskId(null);
    }
  }

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.container}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="close" color="#17382F" size={22} /></Pressable><View style={styles.headerCopy}><Text style={styles.brand}>أبو مشعل · مساحة العمل</Text><Text style={styles.title}>متابعة SLA للمهام</Text><Text style={styles.subtitle}>كل لون يوضح الوقت المتبقي للمهمة المولدة أو المستحقة.</Text></View></View>
    <View style={styles.legend}><Legend color="#1E8C5A" label="ضمن الوقت" /><Legend color="#D88712" label="قريبة" /><Legend color="#D92D20" label="متأخرة" /></View>
    <SlaSummaryChart summary={dashboard} />
    <SlaWeeklyTrendChart trend={weeklyTrend} onPeriodChange={setTrendPeriodDays} />
    <View style={styles.filters}>{(["all", "needs_attention", "overdue"] as TaskFilter[]).map((value) => <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{({ all: "الكل", needs_attention: "تحتاج انتباه", overdue: "متأخرة" } as const)[value]}</Text></Pressable>)}</View>
    <FlatList data={items} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={tracking.isRefetching} onRefresh={() => void tracking.refetch()} tintColor="#0B5D45" />} ListEmptyComponent={<View style={styles.empty}><Ionicons name="checkmark-done-outline" color="#78A190" size={34} /><Text style={styles.emptyText}>{tracking.isLoading ? "قاعد نحمّل مهامك..." : "ما فيه مهام ضمن هذا الفلتر."}</Text></View>} renderItem={({ item }) => {
      const completed = item.status === "completed";
      const dueAt = item.slaDueAt ?? item.dueAt;
      return <View style={styles.card}><View style={styles.cardTop}><View style={styles.priority}><Text style={styles.priorityText}>{priorityLabel(item.priority)}</Text></View><Text style={styles.taskTitle}>{item.title}</Text></View>{item.description && <Text style={styles.description}>{item.description}</Text>}<SlaBadge dueAt={dueAt ? new Date(dueAt).toISOString() : undefined} status={item.status} /><View style={styles.meta}><Text style={styles.metaText}>{assignmentLabel(item.assignmentSource)}</Text>{item.transactionReference && <Text style={styles.metaText}>· {item.transactionReference}</Text>}</View>{!completed && <View style={styles.actions}><Pressable disabled={calendarTaskId !== null || savePreferences.isPending} onPress={() => void addTaskToCalendar(item)} style={[styles.calendarButton, (calendarTaskId !== null || savePreferences.isPending) && styles.disabled]}><Ionicons name="calendar-outline" color="#0B5D45" size={16} /><Text style={styles.calendarText}>{calendarTaskId === item.id ? "جارٍ الإضافة…" : "إضافة للتقويم"}</Text></Pressable><Pressable disabled={updateStatus.isPending} onPress={() => complete(item.id)} style={[styles.complete, updateStatus.isPending && styles.disabled]}><Ionicons name="checkmark" color="#FFFFFF" size={17} /><Text style={styles.completeText}>إكمال المهمة</Text></Pressable></View>}</View>;
    }} />
  </View></ScreenContainer>;
}

function Legend({ color, label }: { color: string; label: string }) { return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>; }
function priorityLabel(priority: string) { return ({ urgent: "عاجلة", high: "عالية", normal: "عادية", low: "منخفضة" } as Record<string, string>)[priority] ?? "عادية"; }
function assignmentLabel(source: string) { return ({ transaction_assignee: "عيّنت حسب مسؤول المعاملة", least_loaded_staff: "توزيع تلقائي للفريق", request_owner: "مطلوبة منك", unassigned: "بانتظار تعيين", manual: "تعيين يدوي" } as Record<string, string>)[source] ?? "مهمة متابعة"; }

const styles = StyleSheet.create({ container: { alignSelf: "center", flex: 1, maxWidth: 780, padding: 20, width: "100%" }, header: { alignItems: "center", flexDirection: "row-reverse", gap: 12 }, back: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, headerCopy: { alignItems: "flex-end", flex: 1 }, brand: { color: "#0B5D45", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, title: { color: "#17382F", fontSize: 22, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, subtitle: { color: "#66756E", fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, legend: { alignSelf: "flex-end", flexDirection: "row-reverse", gap: 10, marginTop: 18 }, legendItem: { alignItems: "center", flexDirection: "row-reverse", gap: 4 }, legendDot: { borderRadius: 5, height: 9, width: 9 }, legendText: { color: "#63786D", fontSize: 10, writingDirection: "rtl" }, filters: { alignSelf: "flex-end", flexDirection: "row-reverse", gap: 6, marginTop: 14 }, filter: { backgroundColor: "#F3F7F4", borderColor: "#DFE9E1", borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 }, filterActive: { backgroundColor: "#E8F5EC", borderColor: "#0B5D45" }, filterText: { color: "#6A7C73", fontSize: 11, fontWeight: "800", writingDirection: "rtl" }, filterTextActive: { color: "#0B5D45" }, list: { gap: 10, paddingBottom: 34, paddingTop: 18 }, card: { alignItems: "flex-end", backgroundColor: "#FFFFFF", borderColor: "#E1E9E3", borderRadius: 18, borderWidth: 1, padding: 14 }, cardTop: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", width: "100%" }, taskTitle: { color: "#17382F", flex: 1, fontSize: 14, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, priority: { backgroundColor: "#F3F7F4", borderRadius: 9, marginRight: 10, paddingHorizontal: 7, paddingVertical: 4 }, priorityText: { color: "#416052", fontSize: 10, fontWeight: "800", writingDirection: "rtl" }, description: { color: "#64766D", fontSize: 12, lineHeight: 18, marginTop: 7, textAlign: "right", writingDirection: "rtl" }, meta: { flexDirection: "row-reverse", marginTop: 8 }, metaText: { color: "#71837A", fontSize: 10, writingDirection: "rtl" }, actions: { alignItems: "center", flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 12 }, complete: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 11, flexDirection: "row-reverse", gap: 6, justifyContent: "center", minHeight: 40, paddingHorizontal: 13 }, completeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, calendarButton: { alignItems: "center", backgroundColor: "#E9F5EC", borderColor: "#B6DCC1", borderRadius: 11, borderWidth: 1, flexDirection: "row-reverse", gap: 6, justifyContent: "center", minHeight: 40, paddingHorizontal: 13 }, calendarText: { color: "#0B5D45", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, disabled: { opacity: 0.55 }, empty: { alignItems: "center", backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 18, borderStyle: "dashed", borderWidth: 1, marginTop: 22, padding: 30 }, emptyText: { color: "#66756E", fontSize: 13, lineHeight: 20, marginTop: 10, textAlign: "center", writingDirection: "rtl" } });
