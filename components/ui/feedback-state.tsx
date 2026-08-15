import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "@/components/ui/app-text";

type FeedbackKind = "empty" | "loading" | "error" | "offline" | "success";

const presentation: Record<FeedbackKind, { icon: keyof typeof Ionicons.glyphMap; color: string; background: string }> = {
  empty: { icon: "folder-open-outline", color: "#277AB7", background: "#EAF3FF" },
  loading: { icon: "sync-outline", color: "#116B57", background: "#EAF6ED" },
  error: { icon: "alert-circle-outline", color: "#C84141", background: "#FFF0EF" },
  offline: { icon: "cloud-offline-outline", color: "#D99022", background: "#FFF4E5" },
  success: { icon: "checkmark-done-outline", color: "#18875F", background: "#E8F6EC" },
};

export function FeedbackState({ kind, title, description, actionLabel, onAction }: { kind: FeedbackKind; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  const token = presentation[kind];
  return <View accessibilityRole="summary" style={styles.wrap}>
    <View style={[styles.iconCircle, { backgroundColor: token.background }]}>{kind === "loading" ? <ActivityIndicator color={token.color} /> : <Ionicons name={token.icon} size={32} color={token.color} />}</View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.body}>{description}</Text>
    {actionLabel && onAction ? <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Text style={styles.buttonText}>{actionLabel}</Text><Ionicons name="arrow-back" size={17} color="#FFFFFF" /></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E9DFCF", borderRadius: 24, borderWidth: 1, marginTop: 8, paddingHorizontal: 26, paddingVertical: 30 },
  iconCircle: { alignItems: "center", borderRadius: 999, height: 68, justifyContent: "center", width: 68 },
  title: { color: "#111817", fontSize: 18, fontWeight: "800", marginTop: 16, textAlign: "center", writingDirection: "rtl" },
  body: { color: "#58635F", fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: "center", writingDirection: "rtl" },
  button: { alignItems: "center", backgroundColor: "#116B57", borderRadius: 14, flexDirection: "row-reverse", gap: 6, marginTop: 20, minHeight: 44, paddingHorizontal: 18 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", writingDirection: "rtl" },
  pressed: { opacity: 0.86 },
});
