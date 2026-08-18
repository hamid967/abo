import Ionicons from "@expo/vector-icons/Ionicons";
import * as Network from "expo-network";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { AppText as Text } from "@/components/ui/app-text";

export function NetworkStatusBanner() {
  const state = Network.useNetworkState();
  const isOffline = state.isInternetReachable === false || (state.isInternetReachable === null && state.isConnected === false);
  const [retryState, setRetryState] = useState<"idle" | "checking" | "offline" | "online">("idle");

  useEffect(() => {
    if (!isOffline && retryState !== "online") setRetryState("idle");
  }, [isOffline, retryState]);

  useEffect(() => {
    if (retryState !== "online") return;
    const timeout = setTimeout(() => setRetryState("idle"), 3600);
    return () => clearTimeout(timeout);
  }, [retryState]);

  const retryConnection = async () => {
    setRetryState("checking");
    try {
      const latest = await Network.getNetworkStateAsync();
      setRetryState(latest.isInternetReachable === true ? "online" : "offline");
    } catch {
      setRetryState("offline");
    }
  };

  if (!isOffline && retryState !== "online") return null;
  const isBackOnline = retryState === "online";

  return <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.banner, isBackOnline && styles.onlineBanner]}>
    <Ionicons name={isBackOnline ? "cloud-done-outline" : "cloud-offline-outline"} size={17} color={isBackOnline ? "#0B5D45" : "#8A3B08"} />
    <View style={styles.copy}>
      <Text style={[styles.title, isBackOnline && styles.onlineTitle]}>{isBackOnline ? "عاد اتصال الإنترنت" : "ما فيه اتصال بالإنترنت"}</Text>
      <Text style={styles.body}>{isBackOnline ? "تقدر تعيد المحاولة في الإجراء السابق عند الحاجة." : "تقدر تراجع المحتوى المحفوظ، لكن الرفع والمزامنة والإجراءات الجديدة تنتظر رجوع الشبكة."}</Text>
    </View>
    {!isBackOnline && <Pressable accessibilityRole="button" accessibilityLabel="إعادة محاولة الاتصال بالإنترنت" disabled={retryState === "checking"} onPress={() => void retryConnection()} style={[styles.retry, retryState === "checking" && styles.retryDisabled]}>{retryState === "checking" ? <ActivityIndicator color="#8A3B08" size="small" /> : <Text style={styles.retryText}>{retryState === "offline" ? "ما زال مقطوع" : "إعادة المحاولة"}</Text>}</Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  banner: { alignItems: "flex-start", backgroundColor: "#FFF4E6", borderBottomColor: "#F0C28B", borderBottomWidth: 1, flexDirection: "row-reverse", gap: 8, paddingHorizontal: 16, paddingVertical: 9 },
  onlineBanner: { backgroundColor: "#EFFAF2", borderBottomColor: "#BFE2C8" },
  copy: { alignItems: "flex-end", flex: 1 },
  title: { color: "#8A3B08", fontSize: 12, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  onlineTitle: { color: "#0B5D45" },
  body: { color: "#7B512F", fontSize: 10, lineHeight: 15, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  retry: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E9B470", borderRadius: 9, borderWidth: 1, justifyContent: "center", minHeight: 32, paddingHorizontal: 9 },
  retryDisabled: { opacity: 0.65 },
  retryText: { color: "#8A3B08", fontSize: 10, fontWeight: "900", writingDirection: "rtl" },
});
