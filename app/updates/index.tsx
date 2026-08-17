import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

function relativeDate(value: Date | string | null) {
  if (!value) return "تاريخ النشر غير متاح";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "تاريخ النشر غير متاح";
  return date.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

export default function OfficialUpdatesScreen() {
  const colors = useColors();
  const updates = trpc.officialUpdates.listPublished.useQuery(undefined, { refetchInterval: 5 * 60 * 1000 });
  const subscriptions = trpc.officialUpdates.subscriptions.useQuery();
  const subscribe = trpc.officialUpdates.subscribe.useMutation({ onSuccess: () => subscriptions.refetch() });

  const hasGeneralSubscription = useMemo(
    () => (subscriptions.data ?? []).some((item) => item.isActive && !item.sourceId && !item.updateType),
    [subscriptions.data],
  );

  const enableInAppUpdates = () => {
    if (hasGeneralSubscription || subscribe.isPending) return;
    subscribe.mutate({ notificationChannel: "in_app" });
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4" containerClassName="bg-background">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="arrow-forward" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.text }]}>التحديثات الحكومية</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>من مصادر رسمية مع رابط المنشور وتاريخ التحقق</Text>
        </View>
      </View>

      <View style={[styles.notice, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
        <Text style={[styles.noticeText, { color: colors.text }]}>تظهر هنا المواد المعتمدة فقط. راجع المصدر الرسمي دائماً قبل اتخاذ أي إجراء.</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasGeneralSubscription ? "تنبيهات التحديثات مفعلة" : "تفعيل تنبيهات التحديثات داخل التطبيق"}
        onPress={enableInAppUpdates}
        disabled={hasGeneralSubscription || subscribe.isPending}
        style={({ pressed }) => [styles.subscription, { backgroundColor: hasGeneralSubscription ? `${colors.success}14` : colors.surface, borderColor: hasGeneralSubscription ? `${colors.success}42` : colors.border, opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name={hasGeneralSubscription ? "notifications" : "notifications-outline"} size={21} color={hasGeneralSubscription ? colors.success : colors.primary} />
        <View style={styles.subscriptionText}>
          <Text style={[styles.subscriptionTitle, { color: colors.text }]}>{hasGeneralSubscription ? "تنبيهات التحديثات مفعلة" : "فعّل تنبيهات التحديثات"}</Text>
          <Text style={[styles.subscriptionCaption, { color: colors.muted }]}>{hasGeneralSubscription ? "ستصل المواد المعتمدة إلى مركز الإشعارات." : "تنبيهات داخل التطبيق للمواد المعتمدة فقط."}</Text>
        </View>
        {!hasGeneralSubscription && <Ionicons name="chevron-back" size={18} color={colors.muted} />}
      </Pressable>

      {updates.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={[styles.loadingText, { color: colors.muted }]}>جاري تحميل التحديثات المعتمدة…</Text></View>
      ) : (
        <FlatList
          data={updates.data ?? []}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={updates.isRefetching} onRefresh={() => updates.refetch()} tintColor={colors.primary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="newspaper-outline" size={34} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد تحديثات منشورة حالياً</Text><Text style={[styles.emptyText, { color: colors.muted }]}>تظهر التحديثات بعد مراجعتها واعتمادها من فريق أبو مشعل.</Text></View>}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardTopline}>
                <View style={[styles.typeBadge, { backgroundColor: `${colors.primary}16` }]}><Text style={[styles.typeText, { color: colors.primary }]}>{item.updateType.replace(/_/g, " ")}</Text></View>
                <Text style={[styles.date, { color: colors.muted }]}>{relativeDate(item.publishedAt)}</Text>
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.titleAr ?? item.originalTitle}</Text>
              {item.summaryAr ? <Text numberOfLines={3} style={[styles.cardBody, { color: colors.muted }]}>{item.summaryAr}</Text> : null}
              <View style={styles.sourceLine}><Ionicons name="business-outline" size={15} color={colors.muted} /><Text numberOfLines={1} style={[styles.sourceText, { color: colors.muted }]}>{item.authorityNameAr} · {item.sourceName}</Text></View>
              <Pressable accessibilityRole="link" accessibilityLabel="فتح المصدر الرسمي" onPress={() => Linking.openURL(item.officialUrl).catch(() => undefined)} style={({ pressed }) => [styles.sourceButton, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}>
                <Ionicons name="open-outline" size={17} color={colors.primary} /><Text style={[styles.sourceButtonText, { color: colors.primary }]}>فتح المصدر الرسمي</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6, marginBottom: 16 },
  iconButton: { width: 40, height: 40, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  titleBlock: { flex: 1, alignItems: "flex-end" },
  title: { fontSize: 22, lineHeight: 31, fontFamily: "Cairo-Bold", textAlign: "right" },
  subtitle: { fontSize: 12, lineHeight: 19, fontFamily: "Cairo-Regular", textAlign: "right" },
  notice: { flexDirection: "row-reverse", alignItems: "center", gap: 9, padding: 13, borderWidth: 1, borderRadius: 15, marginBottom: 10 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 20, fontFamily: "Cairo-Regular", textAlign: "right" },
  subscription: { flexDirection: "row-reverse", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, padding: 13, marginBottom: 12 },
  subscriptionText: { flex: 1, alignItems: "flex-end" },
  subscriptionTitle: { fontSize: 14, lineHeight: 22, fontFamily: "Cairo-SemiBold", textAlign: "right" },
  subscriptionCaption: { fontSize: 11, lineHeight: 18, fontFamily: "Cairo-Regular", textAlign: "right" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontSize: 13, fontFamily: "Cairo-Regular" },
  list: { gap: 10, paddingBottom: 28 },
  card: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 9 },
  cardTopline: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  typeBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  typeText: { fontSize: 10, fontFamily: "Cairo-SemiBold", textTransform: "capitalize" },
  date: { fontSize: 11, fontFamily: "Cairo-Regular" },
  cardTitle: { fontSize: 16, lineHeight: 25, fontFamily: "Cairo-Bold", textAlign: "right" },
  cardBody: { fontSize: 12, lineHeight: 20, fontFamily: "Cairo-Regular", textAlign: "right" },
  sourceLine: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  sourceText: { flex: 1, fontSize: 11, fontFamily: "Cairo-Regular", textAlign: "right" },
  sourceButton: { alignSelf: "flex-end", flexDirection: "row-reverse", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 7 },
  sourceButtonText: { fontSize: 12, fontFamily: "Cairo-SemiBold" },
  empty: { alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 18, padding: 28 },
  emptyTitle: { fontSize: 16, fontFamily: "Cairo-Bold", textAlign: "center" },
  emptyText: { fontSize: 12, lineHeight: 20, fontFamily: "Cairo-Regular", textAlign: "center" },
});
