import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";

import { ActivitySkeleton } from "@/components/activity-skeleton";
import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { useLocale } from "@/lib/locale-provider";
import { trpc } from "@/lib/trpc";

function deviceName(
  platform: string | null,
  userAgent: string | null,
  ar: boolean,
) {
  const platformName =
    platform === "ios"
      ? "iPhone / iPad"
      : platform === "android"
        ? "Android"
        : platform === "web"
          ? ar
            ? "متصفح الويب"
            : "Web browser"
          : ar
            ? "جهاز غير محدد"
            : "Unknown device";
  const browser =
    userAgent &&
    (/Edg\//.test(userAgent)
      ? "Edge"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : /Firefox\//.test(userAgent)
            ? "Firefox"
            : null);
  return browser ? `${platformName} · ${browser}` : platformName;
}

export default function SecurityActivityScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAccount();
  const { isArabic, direction } = useLocale();
  const utils = trpc.useUtils();
  const activity = trpc.security.loginActivity.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const forgetDevice = trpc.security.forgetDevice.useMutation({
    onSuccess: () => utils.security.loginActivity.invalidate(),
  });
  const [refreshing, setRefreshing] = useState(false);
  const text = isArabic
    ? {
        title: "الأجهزة والأمان",
        subtitle: "تحكم بالأجهزة الموثوقة المرتبطة بحسابك.",
        devices: "الأجهزة الموثوقة",
        alerts: "تنبيهات الدخول",
        empty: "لا توجد أجهزة موثوقة حتى الآن.",
        signIn: "سجّل دخولك لعرض الأجهزة المرتبطة.",
        error: "تعذر تحميل النشاط. حاول مرة أخرى.",
        last: "آخر نشاط",
        first: "تاريخ الربط",
        unusual: "دخول غير معتاد",
        trusted: "موثوق",
        remove: "إزالة",
        removeTitle: "إزالة الجهاز الموثوق؟",
        removeBody:
          "لن تُحذف بياناتك، وسيُعامل الجهاز كجهاز جديد عند تسجيل دخوله مجدداً.",
        cancel: "إلغاء",
        confirm: "إزالة الثقة",
        safe: "لا توجد تنبيهات أمنية.",
        note: "إزالة جهاز تلغي الثقة به، وتُفعّل التحقق والتنبيه عند دخوله لاحقاً.",
        protected: "حماية الجهاز مفعّلة",
      }
    : {
        title: "Devices & security",
        subtitle: "Control trusted devices linked to your account.",
        devices: "Trusted devices",
        alerts: "Sign-in alerts",
        empty: "No trusted devices yet.",
        signIn: "Sign in to view linked devices.",
        error: "Unable to load activity. Try again.",
        last: "Last activity",
        first: "Linked on",
        unusual: "Unusual sign-in",
        trusted: "Trusted",
        remove: "Remove",
        removeTitle: "Remove trusted device?",
        removeBody:
          "Your data remains safe. The device will be verified on its next sign-in.",
        cancel: "Cancel",
        confirm: "Remove trust",
        safe: "No security alerts.",
        note: "Removing a device revokes trust and triggers verification on its next sign-in.",
        protected: "Device protection is active",
      };
  const formatDate = (value: Date | string) =>
    new Date(value).toLocaleString(isArabic ? "ar-SA" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await activity.refetch();
    } finally {
      setRefreshing(false);
    }
  }
  function confirmForget(deviceId: string) {
    Alert.alert(text.removeTitle, text.removeBody, [
      { text: text.cancel, style: "cancel" },
      {
        text: text.confirm,
        style: "destructive",
        onPress: () => forgetDevice.mutate({ deviceId }),
      },
    ]);
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.container}>
        <View
          style={[
            styles.header,
            { flexDirection: isArabic ? "row-reverse" : "row" },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isArabic ? "العودة" : "Back"}
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <Ionicons name="chevron-back" size={22} color="#17382F" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { writingDirection: direction }]}>
              {text.title}
            </Text>
            <Text style={[styles.subtitle, { writingDirection: direction }]}>
              {text.subtitle}
            </Text>
          </View>
          <View style={styles.iconButton}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color="#0B5D45"
            />
          </View>
        </View>
        {!isAuthenticated ? (
          <Empty icon="lock-closed-outline" label={text.signIn} />
        ) : activity.isLoading ? (
          <ActivitySkeleton />
        ) : activity.isError ? (
          <Pressable onPress={() => void activity.refetch()}>
            <Empty icon="refresh-outline" label={text.error} />
          </Pressable>
        ) : (
          <FlatList
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            data={activity.data?.devices ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <>
                <View style={styles.securityScore}>
                  <View style={styles.scoreIcon}>
                    <Ionicons
                      name="shield-checkmark"
                      size={25}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={styles.scoreCopy}>
                    <Text style={styles.scoreTitle}>{text.protected}</Text>
                    <Text style={styles.scoreBody}>{text.note}</Text>
                  </View>
                </View>
                <Text style={styles.sectionTitle}>{text.devices}</Text>
              </>
            }
            ListEmptyComponent={
              <Empty icon="phone-portrait-outline" label={text.empty} />
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.deviceIcon}>
                    <Ionicons
                      name={
                        item.platform === "web"
                          ? "globe-outline"
                          : "phone-portrait-outline"
                      }
                      size={21}
                      color="#0B5D45"
                    />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.cardTitle}>
                      {deviceName(item.platform, item.userAgent, isArabic)}
                    </Text>
                    <Text style={styles.cardBody}>
                      {text.last}: {formatDate(item.lastSeenAt)}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {text.first}: {formatDate(item.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.status}>
                    <View style={styles.trustedBadge}>
                      <View style={styles.dot} />
                      <Text style={styles.statusText}>{text.trusted}</Text>
                    </View>
                    <Pressable
                      disabled={forgetDevice.isPending}
                      onPress={() => confirmForget(item.id)}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeText}>{text.remove}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
            ListFooterComponent={
              <View style={styles.footer}>
                <Text style={styles.sectionTitle}>{text.alerts}</Text>
                {(activity.data?.alerts?.length ?? 0) === 0 ? (
                  <View style={styles.safeRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#2D9A64"
                    />
                    <Text style={styles.safeText}>{text.safe}</Text>
                  </View>
                ) : (
                  activity.data?.alerts.slice(0, 8).map((alert) => (
                    <View key={String(alert.id)} style={styles.alertRow}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={17}
                        color="#9A5A12"
                      />
                      <Text style={styles.alertText}>
                        {text.unusual} · {formatDate(alert.createdAt)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}

function Empty({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={32} color="#78A190" />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { alignItems: "center", gap: 10, marginBottom: 18 },
  headerCopy: { alignItems: "flex-end", flex: 1 },
  title: {
    color: "#17382F",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "right",
  },
  subtitle: {
    color: "#66756E",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
    textAlign: "right",
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#E9F5EC",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  list: { gap: 11, paddingBottom: 32 },
  securityScore: {
    alignItems: "center",
    backgroundColor: "#0B3B31",
    borderRadius: 22,
    flexDirection: "row-reverse",
    gap: 13,
    padding: 16,
  },
  scoreIcon: {
    alignItems: "center",
    backgroundColor: "#116B57",
    borderRadius: 18,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  scoreCopy: { alignItems: "flex-end", flex: 1 },
  scoreTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },
  scoreBody: {
    color: "#CFE3DA",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
    textAlign: "right",
  },
  sectionTitle: {
    color: "#17382F",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 19,
    textAlign: "right",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DFEAE1",
    borderRadius: 19,
    borderWidth: 1,
    padding: 14,
  },
  cardRow: { alignItems: "center", flexDirection: "row-reverse", gap: 11 },
  deviceIcon: {
    alignItems: "center",
    backgroundColor: "#E9F5EC",
    borderRadius: 14,
    height: 45,
    justifyContent: "center",
    width: 45,
  },
  copy: { flex: 1 },
  cardTitle: {
    color: "#17382F",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  cardBody: {
    color: "#5A6D63",
    fontSize: 11,
    marginTop: 5,
    textAlign: "right",
  },
  cardMeta: {
    color: "#8B9B93",
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
  },
  status: { alignItems: "flex-start", gap: 7 },
  trustedBadge: {
    alignItems: "center",
    backgroundColor: "#ECF8F0",
    borderRadius: 999,
    flexDirection: "row-reverse",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  dot: { backgroundColor: "#2D9A64", borderRadius: 4, height: 7, width: 7 },
  statusText: { color: "#237B50", fontSize: 9, fontWeight: "800" },
  removeButton: { paddingHorizontal: 7, paddingVertical: 4 },
  removeText: { color: "#B42318", fontSize: 10, fontWeight: "800" },
  footer: { paddingBottom: 20 },
  safeRow: {
    alignItems: "center",
    backgroundColor: "#ECF8F0",
    borderRadius: 14,
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 10,
    padding: 12,
  },
  safeText: { color: "#237B50", flex: 1, fontSize: 12, textAlign: "right" },
  alertRow: {
    alignItems: "center",
    backgroundColor: "#FFF4E6",
    borderRadius: 13,
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 9,
    padding: 11,
  },
  alertText: { color: "#8A5416", flex: 1, fontSize: 11, textAlign: "right" },
  empty: {
    alignItems: "center",
    backgroundColor: "#F7FAF8",
    borderColor: "#E1E9E3",
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    marginTop: 20,
    padding: 28,
  },
  emptyText: {
    color: "#66756E",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
});
