import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SlaBadge } from "@/components/sla-badge";
import { AppText as Text } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { useLocale } from "@/lib/locale-provider";
import { trpc } from "@/lib/trpc";

type NotificationFilter = "all" | "unread" | "tasks";

const CHANNEL_LABELS = { in_app: { ar: "داخل التطبيق", en: "In-app" }, push: { ar: "دفع للجوال", en: "Mobile push" } } as const;
const DELIVERY_LABELS = { queued: { ar: "قيد الإرسال", en: "Queued" }, delivered: { ar: "تم التسليم", en: "Delivered" }, suppressed: { ar: "موقوف بالتفضيلات", en: "Suppressed" }, failed: { ar: "تعذر الإرسال", en: "Failed" } } as const;

export default function NotificationsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAccount();
  const { isArabic, direction } = useLocale();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const list = trpc.notifications.list.useQuery(undefined, { enabled: isAuthenticated });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => void list.refetch() });
  const text = isArabic
    ? { title: "مركز الإشعارات", subtitle: "سجل التنبيهات والمهام المرتبطة بحسابك", empty: "ما فيه إشعارات ضمن هذا الفلتر.", signIn: "سجّل دخولك عشان تشوف سجل الإشعارات", read: "مقروء", unread: "غير مقروء", task: "مهمة مرتبطة", openTask: "فتح متابعة المهمة", viewNotification: "عرض الإشعار", all: "الكل", tasks: "المهام", delivery: "التسليم", noDelivery: "إشعار داخل التطبيق", unreadCount: "غير مقروء" }
    : { title: "Notification center", subtitle: "Your alert history and linked tasks", empty: "No notifications match this filter.", signIn: "Sign in to see your notification history", read: "Read", unread: "Unread", task: "Linked task", openTask: "Open task tracking", viewNotification: "View notification", all: "All", tasks: "Tasks", delivery: "Delivery", noDelivery: "In-app notification", unreadCount: "Unread" };
  const items = useMemo(() => (list.data ?? []).filter((item) => filter === "all" || (filter === "unread" ? !item.readAt : Boolean(item.task))), [filter, list.data]);
  const unreadCount = useMemo(() => (list.data ?? []).filter((item) => !item.readAt).length, [list.data]);
  const taskCount = useMemo(() => (list.data ?? []).filter((item) => item.task).length, [list.data]);
  const filterCounts = { all: (list.data ?? []).length, unread: unreadCount, tasks: taskCount };

  async function openNotification(item: NonNullable<typeof list.data>[number]) {
    try {
      if (!item.readAt) await markRead.mutateAsync({ notificationId: item.id });
      if (item.task) router.push("/task-tracking" as never);
    } catch {
      // The card remains usable on the next refresh; no sensitive notification data is logged.
    }
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.container}>
        <View style={[styles.header, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
          <Pressable accessibilityLabel={isArabic ? "إغلاق مركز الإشعارات" : "Close notification center"} onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={22} color="#17382F" /></Pressable>
          <View style={styles.headerCopy}><Text style={[styles.title, { writingDirection: direction }]}>{text.title}</Text><Text style={[styles.subtitle, { writingDirection: direction }]}>{text.subtitle}</Text></View>
          <Pressable accessibilityLabel={isArabic ? "إعدادات الإشعارات" : "Notification settings"} onPress={() => router.push("/notifications/preferences" as never)} style={styles.settings}><Ionicons name="options-outline" size={19} color="#0B5D45" /></Pressable>
        </View>

        {!isAuthenticated ? (
          <Pressable onPress={() => router.push("/account" as never)} style={styles.empty}><Ionicons name="lock-closed-outline" size={30} color="#0B5D45" /><Text style={[styles.emptyText, { writingDirection: direction }]}>{text.signIn}</Text></Pressable>
        ) : list.isLoading ? (
          <ActivityIndicator color="#0B5D45" style={styles.loading} />
        ) : (
          <>
            <View style={[styles.summary, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <SummaryMetric icon="mail-unread-outline" value={unreadCount} label={text.unreadCount} direction={direction} />
              <SummaryMetric icon="checkbox-outline" value={taskCount} label={text.tasks} direction={direction} />
              <SummaryMetric icon="notifications-outline" value={(list.data ?? []).length} label={text.all} direction={direction} />
            </View>
            <View style={[styles.filters, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              {(["all", "unread", "tasks"] as NotificationFilter[]).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} accessibilityLabel={`${({ all: text.all, unread: text.unread, tasks: text.tasks })[value]}: ${filterCounts[value]}`} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive, { writingDirection: direction }]}>{({ all: text.all, unread: text.unread, tasks: text.tasks })[value]} ({filterCounts[value]})</Text></Pressable>)}
            </View>
            <FlatList
              data={items}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor="#0B5D45" />}
              ListEmptyComponent={<View style={styles.empty}><Ionicons name="notifications-off-outline" size={32} color="#78A190" /><Text style={[styles.emptyText, { writingDirection: direction }]}>{text.empty}</Text></View>}
              renderItem={({ item }) => {
                const primaryDelivery = item.deliveries[0];
                const deliveryLabel = primaryDelivery ? `${CHANNEL_LABELS[primaryDelivery.channel][isArabic ? "ar" : "en"]} · ${DELIVERY_LABELS[primaryDelivery.status][isArabic ? "ar" : "en"]}` : text.noDelivery;
                return <Pressable accessibilityRole="button" accessibilityLabel={item.task ? `${item.title}. ${text.openTask}` : `${item.title}. ${text.viewNotification}`} onPress={() => void openNotification(item)} style={({ pressed }) => [styles.card, !item.readAt && styles.unread, pressed && styles.pressed]}>
                  <View style={[styles.cardRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
                    <View style={[styles.icon, item.task && styles.taskIcon]}><Ionicons name={item.task ? "checkbox-outline" : item.readAt ? "notifications-outline" : "notifications"} size={18} color="#0B5D45" /></View>
                      <View style={styles.copy}>
                        <View style={[styles.titleRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Text style={[styles.cardTitle, { writingDirection: direction }]}>{item.title}</Text><Text style={[styles.readState, !item.readAt && styles.readStateUnread, { writingDirection: direction }]}>{item.readAt ? text.read : text.unread}</Text></View>
                        <Text style={[styles.body, { writingDirection: direction }]}>{item.body}</Text>
                      {item.task ? <View style={styles.taskPanel}><View style={[styles.taskPanelHead, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Ionicons name="clipboard-outline" color="#0B5D45" size={15} /><Text style={[styles.taskLabel, { writingDirection: direction }]}>{text.task}</Text></View><Text numberOfLines={1} style={[styles.taskTitle, { writingDirection: direction }]}>{item.task.title}</Text><SlaBadge dueAt={item.task.slaDueAt ? new Date(item.task.slaDueAt).toISOString() : item.task.dueAt ? new Date(item.task.dueAt).toISOString() : undefined} status={item.task.status} compact /><View style={[styles.openTaskRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Text style={[styles.openTaskText, { writingDirection: direction }]}>{text.openTask}</Text><Ionicons name={isArabic ? "arrow-back" : "arrow-forward"} color="#0B5D45" size={15} /></View></View> : null}
                      <View style={[styles.actionRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Text style={[styles.actionText, { writingDirection: direction }]}>{item.task ? text.openTask : text.viewNotification}</Text><Ionicons name={isArabic ? "arrow-back" : "arrow-forward"} color="#0B5D45" size={15} /></View>
                      <View style={[styles.deliveryRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Ionicons name="paper-plane-outline" size={12} color="#71837A" /><Text style={[styles.deliveryText, { writingDirection: direction }]}>{text.delivery}: {deliveryLabel}</Text></View>
                      <Text style={[styles.time, { writingDirection: direction }]}>{new Date(item.createdAt).toLocaleString(isArabic ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short" })}</Text>
                    </View>
                  </View>
                </Pressable>;
              }}
            />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

function SummaryMetric({ icon, value, label, direction }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string; direction: "rtl" | "ltr" }) {
  return <View style={styles.metric}><Ionicons name={icon} size={17} color="#0B5D45" /><Text style={styles.metricValue}>{value}</Text><Text style={[styles.metricLabel, { writingDirection: direction }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, maxWidth: 780, alignSelf: "center", padding: 20, width: "100%" }, header: { alignItems: "center", gap: 12 }, close: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, settings: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, headerCopy: { alignItems: "flex-end", flex: 1 }, title: { color: "#17382F", fontSize: 22, fontWeight: "800", textAlign: "right" }, subtitle: { color: "#66756E", fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: "right" }, loading: { marginTop: 40 }, summary: { backgroundColor: "#F3F8F4", borderColor: "#D9E9DC", borderRadius: 18, borderWidth: 1, gap: 8, marginTop: 20, padding: 10 }, metric: { alignItems: "center", flex: 1, gap: 2, paddingVertical: 3 }, metricValue: { color: "#17382F", fontSize: 18, fontWeight: "800" }, metricLabel: { color: "#668075", fontSize: 10, fontWeight: "700", textAlign: "center" }, filters: { gap: 7, marginTop: 14 }, filter: { backgroundColor: "#F4F7F5", borderColor: "#DCE8DE", borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, filterActive: { backgroundColor: "#E5F4E9", borderColor: "#0B5D45" }, filterText: { color: "#62776B", fontSize: 11, fontWeight: "800" }, filterTextActive: { color: "#0B5D45" }, list: { gap: 10, paddingTop: 16, paddingBottom: 30 }, card: { backgroundColor: "#FFFFFF", borderColor: "#E1E9E3", borderRadius: 18, borderWidth: 1, padding: 14 }, unread: { borderColor: "#76A98B", borderWidth: 1.5 }, cardRow: { alignItems: "flex-start", gap: 10 }, icon: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 12, height: 38, justifyContent: "center", width: 38 }, taskIcon: { backgroundColor: "#FFF3D7" }, copy: { flex: 1 }, titleRow: { alignItems: "center", gap: 8, justifyContent: "space-between" }, cardTitle: { color: "#17382F", flex: 1, fontSize: 14, fontWeight: "800", textAlign: "right" }, readState: { backgroundColor: "#F1F5F2", borderRadius: 999, color: "#738379", fontSize: 9, fontWeight: "800", overflow: "hidden", paddingHorizontal: 7, paddingVertical: 3 }, readStateUnread: { backgroundColor: "#E4F4E8", color: "#0B5D45" }, body: { color: "#5A6D63", fontSize: 12, lineHeight: 19, marginTop: 6, textAlign: "right" }, actionRow: { alignItems: "center", gap: 4, marginTop: 10 }, actionText: { color: "#0B5D45", fontSize: 11, fontWeight: "800" }, deliveryRow: { alignItems: "center", gap: 4, marginTop: 9 }, deliveryText: { color: "#71837A", fontSize: 10, flex: 1, textAlign: "right" }, taskPanel: { backgroundColor: "#F7FBF8", borderColor: "#D9E9DC", borderRadius: 12, borderWidth: 1, marginTop: 11, padding: 10 }, taskPanelHead: { alignItems: "center", gap: 5 }, taskLabel: { color: "#0B5D45", fontSize: 10, fontWeight: "800" }, taskTitle: { color: "#17382F", fontSize: 12, fontWeight: "800", marginTop: 5, textAlign: "right" }, openTaskRow: { alignItems: "center", gap: 4, marginTop: 8 }, openTaskText: { color: "#0B5D45", fontSize: 11, fontWeight: "800" }, time: { color: "#8B9B93", fontSize: 10, marginTop: 10, textAlign: "right" }, empty: { alignItems: "center", backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 18, borderStyle: "dashed", borderWidth: 1, marginTop: 30, padding: 28 }, emptyText: { color: "#66756E", fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: "center" }, pressed: { opacity: 0.72 },
});
