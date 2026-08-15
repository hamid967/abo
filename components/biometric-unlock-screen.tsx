import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import type { BiometricAvailability } from "@/lib/biometric-auth";

type Props = {
  availability: BiometricAvailability;
  onUnlock: () => Promise<{ success: boolean; cancelled: boolean; message?: string }>;
  onFallback: () => Promise<void>;
};

export function BiometricUnlockScreen({ availability, onUnlock, onFallback }: Props) {
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const checkingRef = useRef(false);

  const attemptUnlock = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setIsChecking(true);
    setMessage(null);
    const result = await onUnlock();
    if (!result.success && !result.cancelled) setMessage(result.message || "تعذر فتح الحساب بهذه الطريقة.");
    checkingRef.current = false;
    setIsChecking(false);
  }, [onUnlock]);

  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    void attemptUnlock();
  }, [attemptUnlock, entrance]);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <Animated.View style={[styles.container, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
        <View style={styles.iconCircle}><Ionicons name={availability.kind === "face" ? "scan-outline" : "finger-print-outline"} size={42} color="#0B5D45" /></View>
        <Text style={styles.brand}>أبو مشعل</Text>
        <Text style={styles.title}>افتح حسابك بأمان</Text>
        <Text style={styles.description}>استخدم {availability.label} للمتابعة إلى معاملاتك وبياناتك المحمية.</Text>
        {isChecking ? <View style={styles.statusCard} accessibilityRole="progressbar"><ActivityIndicator size="small" color="#0B5D45" /><Text style={styles.statusText}>جارٍ التحقق من هويتك…</Text></View> : null}
        {message ? <View style={styles.errorCard} accessibilityRole="alert"><Ionicons name="alert-circle-outline" size={19} color="#B42318" /><Text style={styles.errorText}>{message}</Text></View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`فتح باستخدام ${availability.label}`} disabled={isChecking} onPress={() => void attemptUnlock()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isChecking && styles.disabled]}>
          {isChecking ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name={availability.kind === "face" ? "scan-outline" : "finger-print-outline"} size={21} color="#FFFFFF" />}
          <Text style={styles.primaryText}>{isChecking ? "بانتظار التحقق" : `فتح باستخدام ${availability.label}`}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="استخدام تسجيل الدخول التقليدي" onPress={() => void onFallback()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>استخدام تسجيل الدخول التقليدي</Text>
        </Pressable>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1, justifyContent: "center", padding: 24 },
  iconCircle: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 42, height: 84, justifyContent: "center", width: 84 },
  brand: { color: "#0B5D45", fontSize: 13, fontWeight: "800", marginTop: 20, writingDirection: "rtl" },
  title: { color: "#17382F", fontSize: 23, fontWeight: "800", marginTop: 8, writingDirection: "rtl" },
  description: { color: "#66756E", fontSize: 14, lineHeight: 22, marginTop: 9, maxWidth: 320, textAlign: "center", writingDirection: "rtl" },
  statusCard: { alignItems: "center", backgroundColor: "#F0F8F2", borderColor: "#CDE7D2", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 9, marginTop: 22, paddingHorizontal: 15, paddingVertical: 11 },
  statusText: { color: "#0B5D45", fontSize: 13, fontWeight: "700", writingDirection: "rtl" },
  errorCard: { alignItems: "center", backgroundColor: "#FFF4F2", borderColor: "#F2C8C3", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 8, marginTop: 18, padding: 12, width: "100%" },
  errorText: { color: "#B42318", flex: 1, fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
  primaryButton: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 15, flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginTop: 24, minHeight: 52, paddingHorizontal: 18, width: "100%" },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", writingDirection: "rtl" },
  secondaryButton: { marginTop: 14, padding: 12 },
  secondaryText: { color: "#0B5D45", fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.72 },
});
