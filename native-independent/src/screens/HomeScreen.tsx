import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { beginNativeLogin } from "../auth/nativeOAuth";
import { theme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const signIn = async () => {
    try {
      await beginNativeLogin();
    } catch (error) {
      Alert.alert("تعذر تسجيل الدخول", error instanceof Error ? error.message : "حاول مرة أخرى.");
    }
  };
  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>منصة مستقلة لإدارة المتابعة</Text>
        <Text style={styles.title}>أبو مشعل</Text>
        <Text style={styles.description}>نسخة React Native مستقلة قيد نقل الوظائف من المشروع السابق دون تغيير بيانات الحساب أو خادم التطبيق.</Text>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="فتح المعاملات" onPress={() => navigation.navigate("Transactions")} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>المعاملات</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="تسجيل الدخول" onPress={signIn} style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}>
        <Text style={styles.signInButtonText}>تسجيل الدخول</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="عرض حالة الترحيل" onPress={() => navigation.navigate("MigrationStatus")} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <Text style={styles.secondaryButtonText}>حالة الترحيل</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  hero: { alignItems: "flex-end", marginBottom: 42 },
  eyebrow: { color: theme.colors.primary, fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
  title: { color: theme.colors.foreground, fontSize: 42, fontWeight: "900", marginTop: 8, writingDirection: "rtl" },
  description: { color: theme.colors.muted, fontSize: 16, lineHeight: 26, marginTop: 12, textAlign: "right", writingDirection: "rtl" },
  primaryButton: { alignItems: "center", backgroundColor: theme.colors.primary, borderRadius: 14, minHeight: 54, justifyContent: "center", marginBottom: 12 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", writingDirection: "rtl" },
  signInButton: { alignItems: "center", backgroundColor: "#E8F4ED", borderRadius: 14, minHeight: 54, justifyContent: "center", marginBottom: 12 },
  signInButtonText: { color: theme.colors.primary, fontSize: 16, fontWeight: "900", writingDirection: "rtl" },
  secondaryButton: { alignItems: "center", backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: 14, borderWidth: 1, minHeight: 54, justifyContent: "center" },
  secondaryButtonText: { color: theme.colors.primary, fontSize: 16, fontWeight: "900", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
});
