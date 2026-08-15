import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatusPill } from "@/components/status-pill";
import { GovernmentTransaction, isTransactionOverdue } from "@/lib/transactions";

type TransactionCardProps = {
  transaction: GovernmentTransaction;
  onPress: () => void;
};

function formatDueDate(date?: string) {
  if (!date) return "لا يوجد موعد مسجّل";
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${date}T12:00:00`),
  );
}

export function TransactionCard({ transaction, onPress }: TransactionCardProps) {
  const computedStatus = isTransactionOverdue(transaction) ? "overdue" : transaction.status;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.title}>{transaction.title}</Text>
          <Text numberOfLines={1} style={styles.agency}>{transaction.agency}</Text>
        </View>
        <StatusPill status={computedStatus} />
      </View>
      <View style={styles.footer}>
        <View style={styles.metaGroup}>
          <Ionicons name="calendar-outline" size={16} color="#667085" />
          <Text style={styles.meta}>{formatDueDate(transaction.dueDate)}</Text>
        </View>
        <View style={styles.metaGroup}>
          <Ionicons name="document-text-outline" size={16} color="#667085" />
          <Text style={styles.meta}>{transaction.reference || "بدون رقم مرجعي"}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E6EAF0",
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  topRow: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between", gap: 12 },
  titleBlock: { alignItems: "flex-end", flex: 1, gap: 4 },
  title: { color: "#172033", fontSize: 16, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  agency: { color: "#667085", fontSize: 13, textAlign: "right", writingDirection: "rtl" },
  footer: { borderTopColor: "#EEF1F5", borderTopWidth: 1, flexDirection: "row-reverse", gap: 16, marginTop: 14, paddingTop: 12 },
  metaGroup: { alignItems: "center", flexDirection: "row-reverse", gap: 6, flex: 1, justifyContent: "flex-start" },
  meta: { color: "#667085", flexShrink: 1, fontSize: 12, textAlign: "right", writingDirection: "rtl" },
});
