import Ionicons from "@expo/vector-icons/Ionicons";
import * as Network from "expo-network";
import { StyleSheet, View } from "react-native";

import { AppText as Text } from "@/components/ui/app-text";

export function NetworkStatusBanner() {
  const state = Network.useNetworkState();
  const isOffline = state.isInternetReachable === false || (state.isInternetReachable === null && state.isConnected === false);

  if (!isOffline) return null;

  return <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.banner}>
    <Ionicons name="cloud-offline-outline" size={17} color="#8A3B08" />
    <View style={styles.copy}>
      <Text style={styles.title}>ما فيه اتصال بالإنترنت</Text>
      <Text style={styles.body}>تقدر تراجع المحتوى المحفوظ، لكن الرفع والمزامنة والإجراءات الجديدة تنتظر رجوع الشبكة.</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  banner: { alignItems: "flex-start", backgroundColor: "#FFF4E6", borderBottomColor: "#F0C28B", borderBottomWidth: 1, flexDirection: "row-reverse", gap: 8, paddingHorizontal: 16, paddingVertical: 9 },
  copy: { alignItems: "flex-end", flex: 1 },
  title: { color: "#8A3B08", fontSize: 12, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  body: { color: "#7B512F", fontSize: 10, lineHeight: 15, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
});
