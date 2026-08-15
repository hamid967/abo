import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { getReminderPermissionStatus, ReminderPermissionState, requestReminderPermission } from "@/lib/notification-service";

export default function SettingsScreen() {
  const [permission, setPermission] = useState<ReminderPermissionState>("unsupported");

  useEffect(() => {
    void getReminderPermissionStatus().then(setPermission);
  }, []);

  async function enableReminders() {
    const granted = await requestReminderPermission();
    setPermission(granted ? "granted" : "denied");
  }

  const reminderMessage = permission === "granted"
    ? "الإشعارات مفعّلة. ستظهر التذكيرات التي تحفظها مستقبلاً."
    : permission === "denied"
      ? "لم تمنح الإذن بعد. يمكنك طلبه مرة أخرى أو تفعيله من إعدادات الجهاز."
      : "تعمل التنبيهات المحلية على هاتفك بعد تثبيت التطبيق.";

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>الإعدادات</Text>
        <Text style={styles.subtitle}>خيارات وخصوصية التطبيق</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>تنبيهات المواعيد</Text>
        <View style={styles.card}>
          <View style={styles.iconBox}><Ionicons name="notifications-outline" color="#0B5CAD" size={22} /></View>
          <View style={styles.copy}>
            <Text style={styles.cardTitle}>{permission === "granted" ? "التنبيهات مفعّلة" : "ذكّرني بالمواعيد"}</Text>
            <Text style={styles.cardBody}>{reminderMessage}</Text>
            {permission !== "granted" && permission !== "unsupported" && (
              <Pressable onPress={enableReminders} style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}>
                <Text style={styles.permissionText}>تفعيل الإشعارات</Text>
              </Pressable>
            )}
          </View>
        </View>
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
  permissionButton: { alignSelf: "flex-end", backgroundColor: "#0B5CAD", borderRadius: 10, marginTop: 12, paddingHorizontal: 12, paddingVertical: 9 },
  permissionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", writingDirection: "rtl" },
  aboutRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E6EAF0", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", padding: 16 },
  version: { color: "#667085", fontSize: 12, writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
});
