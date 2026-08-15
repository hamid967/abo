import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name="folder-open-outline" size={34} color="#0B5CAD" />
      </View>
      <Text style={styles.title}>لا توجد معاملات بعد</Text>
      <Text style={styles.body}>أضف معاملتك الأولى ليظهر لك وضعها وموعد متابعتها هنا.</Text>
      <Pressable onPress={onAdd} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Ionicons name="add" size={20} color="#FFFFFF" />
        <Text style={styles.buttonText}>إضافة معاملة</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E6EAF0", borderRadius: 24, borderWidth: 1, marginTop: 8, paddingHorizontal: 26, paddingVertical: 30 },
  iconCircle: { alignItems: "center", backgroundColor: "#EAF3FF", borderRadius: 999, height: 70, justifyContent: "center", width: 70 },
  title: { color: "#172033", fontSize: 18, fontWeight: "800", marginTop: 16, writingDirection: "rtl" },
  body: { color: "#667085", fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: "center", writingDirection: "rtl" },
  button: { alignItems: "center", backgroundColor: "#0B5CAD", borderRadius: 14, flexDirection: "row-reverse", gap: 6, marginTop: 20, paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", writingDirection: "rtl" },
  pressed: { opacity: 0.86, transform: [{ scale: 0.97 }] },
});
