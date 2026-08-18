import { StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

const migrationSteps = [
  "تم إنشاء نقطة دخول React Native مستقلة والتنقل الأساسي.",
  "يلي ذلك نقل المصادقة والروابط العميقة والتخزين الآمن.",
  "تُنقل بعد ذلك الواجهات والخصائص الأصلية وبناء Android وiOS.",
];

export function MigrationStatusScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>الترحيل المستقل</Text>
      {migrationSteps.map((step, index) => <View key={step} style={styles.step}><Text style={styles.stepNumber}>{index + 1}</Text><Text style={styles.stepText}>{step}</Text></View>)}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24 },
  title: { color: theme.colors.foreground, fontSize: 24, fontWeight: "900", marginBottom: 26, textAlign: "right", writingDirection: "rtl" },
  step: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 12, marginBottom: 20 },
  stepNumber: { backgroundColor: "#E8F4ED", borderRadius: 16, color: theme.colors.primary, fontSize: 13, fontWeight: "900", overflow: "hidden", paddingHorizontal: 11, paddingVertical: 6 },
  stepText: { color: theme.colors.muted, flex: 1, fontSize: 16, lineHeight: 25, textAlign: "right", writingDirection: "rtl" },
});
