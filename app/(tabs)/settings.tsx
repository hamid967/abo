import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

export default function SettingsScreen() {
  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>الإعدادات</Text>
        <Text style={styles.subtitle}>خيارات وخصوصية التطبيق</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الخصوصية</Text>
        <View style={styles.card}>
          <View style={styles.iconBox}><Ionicons name="phone-portrait-outline" color="#0B5CAD" size={22} /></View>
          <View style={styles.copy}>
            <Text style={styles.cardTitle}>بياناتك على جهازك</Text>
            <Text style={styles.cardBody}>تُحفَظ المعاملات التي تضيفها محلياً على هذا الجهاز. لا يتصل التطبيق بمنصة حكومية أو يرسل سجلاتك إلى خادم.</Text>
          </View>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>عن التطبيق</Text>
        <View style={styles.aboutRow}>
          <Text style={styles.version}>الإصدار 1.0</Text>
          <Text style={styles.cardTitle}>متابع المعاملات الحكومية</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { alignItems: "flex-end", marginBottom: 28 },
  title: { color: "#172033", fontSize: 24, fontWeight: "800", writingDirection: "rtl" },
  subtitle: { color: "#667085", fontSize: 13, marginTop: 5, writingDirection: "rtl" },
  section: { marginBottom: 26 },
  sectionTitle: { color: "#667085", fontSize: 13, fontWeight: "800", marginBottom: 10, textAlign: "right", writingDirection: "rtl" },
  card: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#E6EAF0", borderRadius: 20, borderWidth: 1, flexDirection: "row-reverse", gap: 12, padding: 16 },
  iconBox: { alignItems: "center", backgroundColor: "#EAF3FF", borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  copy: { alignItems: "flex-end", flex: 1 },
  cardTitle: { color: "#172033", fontSize: 14, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  cardBody: { color: "#667085", fontSize: 13, lineHeight: 20, marginTop: 5, textAlign: "right", writingDirection: "rtl" },
  aboutRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E6EAF0", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", padding: 16 },
  version: { color: "#667085", fontSize: 12, writingDirection: "rtl" },
});
