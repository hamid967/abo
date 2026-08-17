import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type ReviewFilter = "needs_review" | "verified" | "published" | "rejected";

export default function AdminOfficialUpdatesScreen() {
  const colors = useColors();
  const [filter, setFilter] = useState<ReviewFilter>("needs_review");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const sources = trpc.officialUpdates.adminSources.useQuery();
  const updates = trpc.officialUpdates.adminList.useQuery({ status: filter });
  const initialize = trpc.officialUpdates.initializeZatca.useMutation({ onSuccess: () => sources.refetch() });
  const collect = trpc.officialUpdates.collect.useMutation({ onSuccess: () => { sources.refetch(); updates.refetch(); } });
  const review = trpc.officialUpdates.review.useMutation({ onSuccess: () => updates.refetch() });
  const activeSource = useMemo(() => (sources.data ?? []).find((source) => source.isActive && source.verificationStatus === "verified"), [sources.data]);

  const decide = (updateId: number, action: "verify" | "publish" | "reject") => {
    review.mutate({ updateId, action, note: notes[updateId]?.trim() || undefined });
  };

  const collectNow = () => {
    if (!activeSource || collect.isPending) return;
    Alert.alert("جمع تحديثات رسمية", "سيجلب النظام المواد من القناة الرسمية ويضعها في المراجعة، ولن ينشر أي مادة تلقائياً.", [
      { text: "إلغاء", style: "cancel" },
      { text: "بدء الجمع", onPress: () => collect.mutate({ sourceId: activeSource.id }) },
    ]);
  };

  const filters: { key: ReviewFilter; label: string }[] = [
    { key: "needs_review", label: "للمراجعة" }, { key: "verified", label: "معتمدة" }, { key: "published", label: "منشورة" }, { key: "rejected", label: "مرفوضة" },
  ];

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4" containerClassName="bg-background">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}><Ionicons name="arrow-forward" size={20} color={colors.text} /></Pressable>
        <View style={styles.titleBlock}><Text style={[styles.title, { color: colors.text }]}>إدارة التحديثات الرسمية</Text><Text style={[styles.subtitle, { color: colors.muted }]}>الجمع لا يعني النشر؛ المراجعة والاعتماد مطلوبان.</Text></View>
      </View>

      {!activeSource ? (
        <Pressable accessibilityRole="button" onPress={() => initialize.mutate()} disabled={initialize.isPending} style={({ pressed }) => [styles.primaryAction, { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 }]}><Ionicons name="add-circle-outline" size={19} color="#fff" /><Text style={styles.primaryActionText}>{initialize.isPending ? "جاري تهيئة المصدر…" : "تهيئة مصدر هيئة الزكاة والضريبة والجمارك"}</Text></Pressable>
      ) : (
        <View style={[styles.sourceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sourceMeta}><Ionicons name="shield-checkmark" size={19} color={colors.success} /><View style={styles.sourceLabel}><Text style={[styles.sourceTitle, { color: colors.text }]}>{activeSource.authorityNameAr}</Text><Text style={[styles.sourceCaption, { color: colors.muted }]}>RSS رسمي · آخر نجاح: {activeSource.lastSuccessAt ? new Date(activeSource.lastSuccessAt).toLocaleDateString("ar-SA") : "لم يُجمع بعد"}</Text></View></View>
          <Pressable accessibilityRole="button" onPress={collectNow} disabled={collect.isPending} style={({ pressed }) => [styles.collectButton, { borderColor: colors.primary, opacity: pressed ? 0.65 : 1 }]}><Ionicons name="sync-outline" size={17} color={colors.primary} /><Text style={[styles.collectText, { color: colors.primary }]}>{collect.isPending ? "جاري الجمع…" : "جمع الآن"}</Text></Pressable>
        </View>
      )}

      <View style={styles.filters}>{filters.map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: filter === item.key }} onPress={() => setFilter(item.key)} style={({ pressed }) => [styles.filter, { backgroundColor: filter === item.key ? colors.primary : colors.surface, borderColor: filter === item.key ? colors.primary : colors.border, opacity: pressed ? 0.7 : 1 }]}><Text style={[styles.filterText, { color: filter === item.key ? "#fff" : colors.text }]}>{item.label}</Text></Pressable>)}</View>

      {updates.isLoading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : <FlatList
        data={updates.data ?? []}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={updates.isRefetching} onRefresh={() => updates.refetch()} tintColor={colors.primary} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="checkmark-done-outline" size={31} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد مواد في هذه الحالة</Text><Text style={[styles.emptyText, { color: colors.muted }]}>تظهر المواد الجديدة هنا بعد جمعها من المصدر الرسمي.</Text></View>}
        renderItem={({ item }) => <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardSource, { color: colors.primary }]}>{item.authorityNameAr} · {item.sourceName}</Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{item.titleAr ?? item.originalTitle}</Text>
          <Text numberOfLines={4} style={[styles.cardBody, { color: colors.muted }]}>{item.originalContent}</Text>
          <TextInput value={notes[item.id] ?? ""} onChangeText={(value) => setNotes((current) => ({ ...current, [item.id]: value }))} placeholder="ملاحظة مراجعة اختيارية" placeholderTextColor={colors.muted} multiline style={[styles.note, { color: colors.text, borderColor: colors.border }]} textAlign="right" />
          <View style={styles.actions}>
            {item.status === "needs_review" && <Pressable accessibilityRole="button" onPress={() => decide(item.id, "verify")} disabled={review.isPending} style={({ pressed }) => [styles.action, { backgroundColor: colors.success, opacity: pressed ? 0.7 : 1 }]}><Text style={styles.actionText}>اعتماد للمراجعة النهائية</Text></Pressable>}
            {item.status === "verified" && <Pressable accessibilityRole="button" onPress={() => decide(item.id, "publish")} disabled={review.isPending} style={({ pressed }) => [styles.action, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}><Text style={styles.actionText}>نشر للمستخدمين</Text></Pressable>}
            {!["published", "rejected"].includes(item.status) && <Pressable accessibilityRole="button" onPress={() => decide(item.id, "reject")} disabled={review.isPending} style={({ pressed }) => [styles.reject, { borderColor: colors.error, opacity: pressed ? 0.7 : 1 }]}><Text style={[styles.rejectText, { color: colors.error }]}>رفض</Text></Pressable>}
          </View>
        </View>}
      />}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6, marginBottom: 14 }, iconButton: { width: 40, height: 40, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" }, titleBlock: { flex: 1, alignItems: "flex-end" }, title: { fontSize: 21, lineHeight: 30, fontFamily: "Cairo-Bold", textAlign: "right" }, subtitle: { fontSize: 11, lineHeight: 19, fontFamily: "Cairo-Regular", textAlign: "right" },
  primaryAction: { flexDirection: "row-reverse", gap: 8, alignItems: "center", justifyContent: "center", borderRadius: 14, padding: 13, marginBottom: 12 }, primaryActionText: { color: "#fff", fontSize: 13, fontFamily: "Cairo-SemiBold" }, sourceCard: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 12 }, sourceMeta: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 8 }, sourceLabel: { flex: 1, alignItems: "flex-end" }, sourceTitle: { fontSize: 13, fontFamily: "Cairo-SemiBold", textAlign: "right" }, sourceCaption: { fontSize: 10, fontFamily: "Cairo-Regular", textAlign: "right" }, collectButton: { flexDirection: "row-reverse", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 }, collectText: { fontSize: 11, fontFamily: "Cairo-SemiBold" },
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginBottom: 10 }, filter: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 6 }, filterText: { fontSize: 11, fontFamily: "Cairo-SemiBold" }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, list: { gap: 10, paddingBottom: 26 }, card: { borderWidth: 1, borderRadius: 17, padding: 13, gap: 8 }, cardSource: { fontSize: 11, fontFamily: "Cairo-SemiBold", textAlign: "right" }, cardTitle: { fontSize: 15, lineHeight: 24, fontFamily: "Cairo-Bold", textAlign: "right" }, cardBody: { fontSize: 11, lineHeight: 19, fontFamily: "Cairo-Regular", textAlign: "right" }, note: { minHeight: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8, fontFamily: "Cairo-Regular", fontSize: 12 }, actions: { flexDirection: "row-reverse", gap: 7, flexWrap: "wrap" }, action: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 }, actionText: { color: "#fff", fontSize: 11, fontFamily: "Cairo-SemiBold" }, reject: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 }, rejectText: { fontSize: 11, fontFamily: "Cairo-SemiBold" }, empty: { alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 17, padding: 25 }, emptyTitle: { fontSize: 15, fontFamily: "Cairo-Bold" }, emptyText: { fontSize: 11, fontFamily: "Cairo-Regular", textAlign: "center" },
});
