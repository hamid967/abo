import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { useLocale } from "@/lib/locale-provider";
import { trpc } from "@/lib/trpc";

function platformLabel(platform: string | null, isArabic: boolean) {
  if (platform === "ios") return "iPhone / iPad";
  if (platform === "android") return "Android";
  if (platform === "web") return isArabic ? "متصفح الويب" : "Web browser";
  return isArabic ? "جهاز غير محدد" : "Unknown device";
}

export default function SecurityActivityScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAccount();
  const { isArabic, direction } = useLocale();
  const activity = trpc.security.loginActivity.useQuery(undefined, { enabled: isAuthenticated });
  const [refreshing, setRefreshing] = useState(false);
  async function refreshActivity() {
    if (refreshing || !isAuthenticated) return;
    setRefreshing(true);
    try { await activity.refetch(); } finally { setRefreshing(false); }
  }
  const text = isArabic ? {
    title: "نشاط الحساب والأجهزة",
    subtitle: "راجع وين يُستخدم حسابك بدون عرض بيانات حساسة.",
    devices: "الأجهزة المتصلة",
    alerts: "تنبيهات الدخول",
    noDevices: "ما فيه أجهزة مسجلة للحساب حتى الآن.",
    noAlerts: "ما فيه تنبيهات أمنية.",
    signIn: "سجّل دخولك عشان تشوف نشاط حسابك.",
    loading: "قاعد نحمّل سجل النشاط…",
    error: "ما قدرنا نحمّل سجل النشاط. جرّب مرة ثانية.",
    lastSeen: "آخر نشاط",
    firstSeen: "أول تسجيل",
    unusual: "تم رصد دخول غير معتاد",
    securityNote: "نوريك معلومات مختصرة فقط. بصمات الأجهزة وعناوين الشبكة ما تظهر لك.",
  } : {
    title: "Account activity & devices",
    subtitle: "Review where your account is used without exposing sensitive data.",
    devices: "Connected devices",
    alerts: "Login alerts",
    noDevices: "No devices have been registered yet.",
    noAlerts: "No security alerts.",
    signIn: "Sign in to view your account activity.",
    loading: "Loading activity…",
    error: "Unable to load activity. Try again.",
    lastSeen: "Last activity",
    firstSeen: "First sign-in",
    unusual: "Unusual sign-in detected",
    securityNote: "Only summarized information is shown. Device fingerprints and network addresses stay hidden.",
  };
  const formatDate = (value: Date | string) => new Date(value).toLocaleString(isArabic ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short" });

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.container}>
    <View style={[styles.header, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "العودة للإعدادات" : "Back to settings"} onPress={() => router.back()} style={styles.iconButton}><Ionicons name="chevron-back" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><Text style={[styles.title, { writingDirection: direction }]}>{text.title}</Text><Text style={[styles.subtitle, { writingDirection: direction }]}>{text.subtitle}</Text></View><View style={styles.iconButton}><Ionicons name="shield-checkmark-outline" size={20} color="#0B5D45" /></View></View>
    {!isAuthenticated ? <View style={styles.empty}><Ionicons name="lock-closed-outline" size={32} color="#0B5D45" /><Text style={styles.emptyText}>{text.signIn}</Text></View> : activity.isLoading ? <View style={styles.loading}><ActivityIndicator color="#0B5D45" /><Text style={styles.loadingText}>{text.loading}</Text></View> : activity.isError ? <Pressable accessibilityRole="button" onPress={() => void activity.refetch()} style={styles.empty}><Ionicons name="refresh-outline" size={30} color="#0B5D45" /><Text style={styles.emptyText}>{text.error}</Text></Pressable> : <FlatList refreshing={refreshing} onRefresh={() => void refreshActivity()} data={activity.data?.devices ?? []} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<><View style={styles.note}><Ionicons name="information-circle-outline" size={18} color="#0B5D45" /><Text style={styles.noteText}>{text.securityNote}</Text></View><Text style={styles.sectionTitle}>{text.devices}</Text>{(activity.data?.alerts?.length ?? 0) > 0 ? <View style={styles.alertSummary}><Ionicons name="warning-outline" size={20} color="#9A5A12" /><Text style={styles.alertText}>{text.unusual} · {activity.data?.alerts.length}</Text></View> : null}</>} ListEmptyComponent={<View style={styles.empty}><Ionicons name="phone-portrait-outline" size={32} color="#78A190" /><Text style={styles.emptyText}>{text.noDevices}</Text></View>} renderItem={({ item }) => <View style={styles.card}><View style={styles.cardRow}><View style={styles.deviceIcon}><Ionicons name={item.platform === "web" ? "globe-outline" : "phone-portrait-outline"} size={20} color="#0B5D45" /></View><View style={styles.copy}><Text style={styles.cardTitle}>{platformLabel(item.platform, isArabic)}</Text><Text style={styles.cardBody}>{text.lastSeen}: {formatDate(item.lastSeenAt)}</Text><Text style={styles.cardMeta}>{text.firstSeen}: {formatDate(item.createdAt)}</Text></View><View style={styles.status}><View style={styles.dot} /><Text style={styles.statusText}>{isArabic ? "معروف" : "Recognized"}</Text></View></View></View>} ListFooterComponent={<View style={styles.footer}><Text style={styles.sectionTitle}>{text.alerts}</Text>{(activity.data?.alerts?.length ?? 0) === 0 ? <Text style={styles.cardMeta}>{text.noAlerts}</Text> : activity.data?.alerts.slice(0, 8).map((alert) => <View key={String(alert.id)} style={styles.alertRow}><Ionicons name="alert-circle-outline" size={17} color="#9A5A12" /><Text style={styles.alertRowText}>{text.unusual} · {formatDate(alert.createdAt)}</Text></View>)}</View>} />}
  </View></ScreenContainer>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 20 }, header: { alignItems: "center", gap: 10, marginBottom: 16 }, headerCopy: { alignItems: "flex-end", flex: 1 }, title: { color: "#17382F", fontSize: 22, fontWeight: "800", textAlign: "right" }, subtitle: { color: "#66756E", fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right" }, iconButton: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, list: { gap: 10, paddingBottom: 30 }, note: { alignItems: "center", backgroundColor: "#F0F7F1", borderRadius: 14, flexDirection: "row-reverse", gap: 8, padding: 12 }, noteText: { color: "#426658", flex: 1, fontSize: 12, lineHeight: 18, textAlign: "right" }, sectionTitle: { color: "#17382F", fontSize: 16, fontWeight: "800", marginTop: 18, textAlign: "right" }, card: { backgroundColor: "#FFFFFF", borderColor: "#E1E9E3", borderRadius: 16, borderWidth: 1, padding: 14 }, cardRow: { alignItems: "center", flexDirection: "row-reverse", gap: 10 }, deviceIcon: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, copy: { flex: 1 }, cardTitle: { color: "#17382F", fontSize: 14, fontWeight: "800", textAlign: "right" }, cardBody: { color: "#5A6D63", fontSize: 12, marginTop: 5, textAlign: "right" }, cardMeta: { color: "#8B9B93", fontSize: 11, marginTop: 4, textAlign: "right" }, status: { alignItems: "flex-end", gap: 4 }, dot: { backgroundColor: "#2D9A64", borderRadius: 5, height: 10, width: 10 }, statusText: { color: "#2D9A64", fontSize: 10 }, alertSummary: { alignItems: "center", backgroundColor: "#FFF4E6", borderColor: "#F1D5A8", borderRadius: 14, flexDirection: "row-reverse", gap: 8, marginTop: 12, padding: 12 }, alertText: { color: "#8A5416", flex: 1, fontSize: 12, textAlign: "right" }, footer: { paddingBottom: 20 }, alertRow: { alignItems: "center", flexDirection: "row-reverse", gap: 8, marginTop: 10 }, alertRowText: { color: "#8A5416", flex: 1, fontSize: 12, textAlign: "right" }, empty: { alignItems: "center", backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 18, borderStyle: "dashed", borderWidth: 1, marginTop: 24, padding: 28 }, emptyText: { color: "#66756E", fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: "center" }, loading: { alignItems: "center", gap: 10, marginTop: 36 }, loadingText: { color: "#66756E", fontSize: 13 }, pressed: { opacity: 0.7 } });
