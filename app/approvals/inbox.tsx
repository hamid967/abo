import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { useLocale } from "@/lib/locale-provider";
import { trpc } from "@/lib/trpc";

type Decision = "approved" | "rejected" | "changes_requested" | "information_requested";
type ResourceFilter = "all" | "task" | "service_request";
type StatusFilter = "all" | "active" | "expired";
type InboxSort = "oldest" | "newest" | "expiresSoonest";

const DECISIONS: { value: Decision; ar: string; icon: keyof typeof Ionicons.glyphMap; style: "approve" | "reject" | "request" }[] = [
  { value: "approved", ar: "اعتماد", icon: "checkmark-circle-outline", style: "approve" },
  { value: "rejected", ar: "رفض", icon: "close-circle-outline", style: "reject" },
  { value: "changes_requested", ar: "طلب تعديل", icon: "create-outline", style: "request" },
  { value: "information_requested", ar: "طلب توضيح", icon: "help-circle-outline", style: "request" },
];

export default function ApprovalsInboxScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAccount();
  const { isArabic, direction } = useLocale();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [resourceType, setResourceType] = useState<ResourceFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<InboxSort>("oldest");
  const inboxInput = useMemo(() => ({
    ...(resourceType === "all" ? {} : { resourceType }),
    status,
    sortBy: sort === "expiresSoonest" ? "expiresAt" as const : "createdAt" as const,
    sortOrder: sort === "newest" ? "desc" as const : "asc" as const,
  }), [resourceType, sort, status]);
  const inbox = trpc.approvals.inbox.useQuery(inboxInput, { enabled: isAuthenticated });
  const decide = trpc.approvals.decide.useMutation({ onSuccess: () => void inbox.refetch() });
  const expired = useMemo(() => (inbox.data ?? []).filter((item) => item.expiresAt && new Date(item.expiresAt) <= new Date()).length, [inbox.data]);

  async function decideItem(item: NonNullable<typeof inbox.data>[number], decision: Decision) {
    try {
      await decide.mutateAsync({ approvalRequestId: item.approvalRequestId, stepId: item.stepId, decision, note: notes[item.stepId]?.trim() || undefined });
    } catch {
      Alert.alert(isArabic ? "تعذر حفظ القرار" : "Decision could not be saved", isArabic ? "تأكد من أن الخطوة ما زالت معلقة ومخصصة لك، ثم جرّب مرة ثانية." : "Ensure the step is still pending and assigned to you, then try again.");
    }
  }

  const text = isArabic ? {
    title: "صندوق وارد الموافقات", subtitle: "قراراتك المعلقة فقط، مع تصفية وفرز سريع", signIn: "سجّل دخولك للوصول إلى الموافقات المسندة لك", empty: "ما عندك موافقات مطابقة للفلاتر الحالية.", pending: "معلّق", expired: "منتهٍ", step: "خطوة الاعتماد", note: "ملاحظة اختيارية للمسار", open: "فتح متابعة المهمة", results: "النتائج", filters: "تصفية وفرز", type: "النوع", status: "الحالة", sort: "الترتيب", all: "الكل", tasks: "مهام", requests: "طلبات خدمة", active: "نشط", oldest: "الأقدم أولاً", newest: "الأحدث أولاً", expiresSoonest: "الأقرب انتهاءً", endsAt: "ينتهي",
  } : {
    title: "Approvals inbox", subtitle: "Only your pending decisions, with quick filters and sorting", signIn: "Sign in to access approvals assigned to you", empty: "No pending approvals match these filters.", pending: "Pending", expired: "Expired", step: "Approval step", note: "Optional note for the workflow", open: "Open task tracking", results: "Results", filters: "Filter and sort", type: "Type", status: "Status", sort: "Sort", all: "All", tasks: "Tasks", requests: "Service requests", active: "Active", oldest: "Oldest first", newest: "Newest first", expiresSoonest: "Expiring first", endsAt: "Expires",
  };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.container}>
    <View style={[styles.header, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
      <Pressable accessibilityLabel={isArabic ? "رجوع" : "Back"} onPress={() => router.back()} style={styles.close}><Ionicons name="arrow-forward" color="#17382F" size={21} /></Pressable>
      <View style={styles.headerCopy}><Text style={[styles.title, { writingDirection: direction }]}>{text.title}</Text><Text style={[styles.subtitle, { writingDirection: direction }]}>{text.subtitle}</Text></View>
    </View>
    {!isAuthenticated ? <Pressable onPress={() => router.push("/account" as never)} style={styles.empty}><Ionicons name="lock-closed-outline" size={30} color="#0B5D45" /><Text style={[styles.emptyText, { writingDirection: direction }]}>{text.signIn}</Text></Pressable> : inbox.isLoading ? <ActivityIndicator color="#0B5D45" style={styles.loading} /> : <>
      <View style={[styles.summary, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Metric icon="time-outline" value={(inbox.data ?? []).length} label={text.results} direction={direction} /><Metric icon="alert-circle-outline" value={expired} label={text.expired} direction={direction} /></View>
      <View style={styles.filters}>
        <Text style={[styles.filterTitle, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{text.filters}</Text>
        <FilterGroup direction={direction} isArabic={isArabic} label={text.type} options={[{ value: "all", label: text.all }, { value: "task", label: text.tasks }, { value: "service_request", label: text.requests }]} selected={resourceType} onSelect={setResourceType} />
        <FilterGroup direction={direction} isArabic={isArabic} label={text.status} options={[{ value: "all", label: text.all }, { value: "active", label: text.active }, { value: "expired", label: text.expired }]} selected={status} onSelect={setStatus} />
        <FilterGroup direction={direction} isArabic={isArabic} label={text.sort} options={[{ value: "oldest", label: text.oldest }, { value: "newest", label: text.newest }, { value: "expiresSoonest", label: text.expiresSoonest }]} selected={sort} onSelect={setSort} />
      </View>
      <FlatList data={inbox.data ?? []} keyExtractor={(item) => `${item.approvalRequestId}-${item.stepId}`} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={inbox.isRefetching} onRefresh={() => void inbox.refetch()} tintColor="#0B5D45" />} ListEmptyComponent={<View style={styles.empty}><Ionicons name="checkmark-done-outline" color="#78A190" size={34} /><Text style={[styles.emptyText, { writingDirection: direction }]}>{text.empty}</Text></View>} renderItem={({ item }) => {
        const isExpired = Boolean(item.expiresAt && new Date(item.expiresAt) <= new Date());
        return <View style={[styles.card, isExpired && styles.expiredCard]}><View style={[styles.cardHead, { flexDirection: isArabic ? "row-reverse" : "row" }]}><View style={styles.icon}><Ionicons name="shield-checkmark-outline" color="#0B5D45" size={19} /></View><View style={styles.copy}><View style={[styles.statusRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Text numberOfLines={1} style={[styles.resourceTitle, { writingDirection: direction }]}>{item.resourceLabel}</Text><Text style={[styles.status, isExpired && styles.expiredStatus, { writingDirection: direction }]}>{isExpired ? text.expired : text.pending}</Text></View><Text style={[styles.step, { writingDirection: direction }]}>{text.step}: {item.stepLabel}</Text>{item.expiresAt ? <Text style={[styles.meta, { writingDirection: direction }]}>{text.endsAt}: {new Date(item.expiresAt).toLocaleString(isArabic ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short" })}</Text> : null}</View></View>
          <TextInput value={notes[item.stepId] ?? ""} onChangeText={(value) => setNotes((current) => ({ ...current, [item.stepId]: value }))} editable={!decide.isPending && !isExpired} placeholder={text.note} placeholderTextColor="#8B9B93" multiline maxLength={1000} textAlign={isArabic ? "right" : "left"} style={[styles.note, { writingDirection: direction }]} />
          <View style={[styles.actions, { flexDirection: isArabic ? "row-reverse" : "row" }]}>{DECISIONS.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={`${option.ar}: ${item.resourceLabel}`} disabled={decide.isPending || isExpired} onPress={() => void decideItem(item, option.value)} style={({ pressed }) => [styles.action, styles[option.style], (decide.isPending || isExpired) && styles.disabled, pressed && styles.pressed]}><Ionicons name={option.icon} color={option.style === "reject" ? "#A63737" : "#0B5D45"} size={15} /><Text style={[styles.actionText, option.style === "reject" && styles.rejectText, { writingDirection: direction }]}>{option.ar}</Text></Pressable>)}</View>
          {item.resourceType === "task" ? <Pressable accessibilityRole="button" accessibilityLabel={`${text.open}: ${item.resourceLabel}`} onPress={() => router.push("/task-tracking" as never)} style={({ pressed }) => [styles.open, pressed && styles.pressed]}><Text style={[styles.openText, { writingDirection: direction }]}>{text.open}</Text><Ionicons name="arrow-back" color="#0B5D45" size={15} /></Pressable> : null}
        </View>;
      }} />
    </>}</View></ScreenContainer>;
}

function Metric({ icon, value, label, direction }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string; direction: "rtl" | "ltr" }) { return <View style={styles.metric}><Ionicons name={icon} color="#0B5D45" size={17} /><Text style={styles.metricValue}>{value}</Text><Text style={[styles.metricLabel, { writingDirection: direction }]}>{label}</Text></View>; }

function FilterGroup<T extends string>({ direction, isArabic, label, options, selected, onSelect }: { direction: "rtl" | "ltr"; isArabic: boolean; label: string; options: { value: T; label: string }[]; selected: T; onSelect: (value: T) => void }) {
  return <View style={styles.filterGroup}><Text style={[styles.filterLabel, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{label}</Text><View style={[styles.filterOptions, { flexDirection: isArabic ? "row-reverse" : "row" }]}>{options.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: selected === option.value }} accessibilityLabel={`${label}: ${option.label}`} onPress={() => onSelect(option.value)} style={({ pressed }) => [styles.filterChip, selected === option.value && styles.filterChipActive, pressed && styles.pressed]}><Text style={[styles.filterChipText, selected === option.value && styles.filterChipTextActive, { writingDirection: direction }]}>{option.label}</Text></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({ container: { alignSelf: "center", flex: 1, maxWidth: 780, padding: 20, width: "100%" }, header: { alignItems: "center", gap: 12 }, close: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, headerCopy: { alignItems: "flex-end", flex: 1 }, title: { color: "#17382F", fontSize: 22, fontWeight: "800", textAlign: "right" }, subtitle: { color: "#66756E", fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: "right" }, loading: { marginTop: 40 }, summary: { backgroundColor: "#F3F8F4", borderColor: "#D9E9DC", borderRadius: 18, borderWidth: 1, gap: 8, marginTop: 20, padding: 10 }, metric: { alignItems: "center", flex: 1, gap: 2 }, metricValue: { color: "#17382F", fontSize: 18, fontWeight: "800" }, metricLabel: { color: "#668075", fontSize: 10, fontWeight: "700" }, filters: { backgroundColor: "#FFFFFF", borderColor: "#D9E9DC", borderRadius: 18, borderWidth: 1, marginTop: 12, padding: 12 }, filterTitle: { color: "#17382F", fontSize: 13, fontWeight: "800" }, filterGroup: { marginTop: 10 }, filterLabel: { color: "#66756E", fontSize: 10, fontWeight: "800", marginBottom: 6 }, filterOptions: { flexWrap: "wrap", gap: 7 }, filterChip: { backgroundColor: "#F5F8F5", borderColor: "#DCE8DE", borderRadius: 999, borderWidth: 1, minHeight: 32, paddingHorizontal: 10, paddingVertical: 7 }, filterChipActive: { backgroundColor: "#0B5D45", borderColor: "#0B5D45" }, filterChipText: { color: "#52685C", fontSize: 11, fontWeight: "800" }, filterChipTextActive: { color: "#FFFFFF" }, list: { gap: 10, paddingBottom: 30, paddingTop: 16 }, card: { backgroundColor: "#FFFFFF", borderColor: "#D9E9DC", borderRadius: 18, borderWidth: 1, padding: 14 }, expiredCard: { backgroundColor: "#FFFAF8", borderColor: "#E9C6C6" }, cardHead: { alignItems: "flex-start", gap: 10 }, icon: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 12, height: 38, justifyContent: "center", width: 38 }, copy: { flex: 1 }, statusRow: { alignItems: "center", gap: 8, justifyContent: "space-between" }, resourceTitle: { color: "#17382F", flex: 1, fontSize: 14, fontWeight: "800", textAlign: "right" }, status: { backgroundColor: "#E4F4E8", borderRadius: 999, color: "#0B5D45", fontSize: 9, fontWeight: "800", overflow: "hidden", paddingHorizontal: 7, paddingVertical: 3 }, expiredStatus: { backgroundColor: "#FBE7E7", color: "#A63737" }, step: { color: "#52685C", fontSize: 12, marginTop: 5, textAlign: "right" }, meta: { color: "#8B9B93", fontSize: 10, marginTop: 6, textAlign: "right" }, note: { backgroundColor: "#F7FAF8", borderColor: "#DCE8DE", borderRadius: 12, borderWidth: 1, color: "#17382F", fontSize: 12, lineHeight: 18, marginTop: 12, minHeight: 46, padding: 10 }, actions: { flexWrap: "wrap", gap: 7, marginTop: 10 }, action: { alignItems: "center", backgroundColor: "#E9F5EC", borderColor: "#B8DCC1", borderRadius: 10, borderWidth: 1, flexDirection: "row-reverse", gap: 4, paddingHorizontal: 9, paddingVertical: 8 }, approve: { backgroundColor: "#E9F5EC" }, reject: { backgroundColor: "#FFF0F0", borderColor: "#E9C6C6" }, request: { backgroundColor: "#FFF7E7", borderColor: "#E9D7A9" }, actionText: { color: "#0B5D45", fontSize: 11, fontWeight: "800" }, rejectText: { color: "#A63737" }, disabled: { opacity: 0.5 }, open: { alignItems: "center", alignSelf: "flex-end", flexDirection: "row-reverse", gap: 4, marginTop: 11 }, openText: { color: "#0B5D45", fontSize: 11, fontWeight: "800" }, empty: { alignItems: "center", backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 18, borderStyle: "dashed", borderWidth: 1, marginTop: 30, padding: 28 }, emptyText: { color: "#66756E", fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: "center" }, pressed: { opacity: 0.72 } });
