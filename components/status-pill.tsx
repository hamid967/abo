import { StyleSheet, Text, View } from "react-native";

import { statusDetails, TransactionStatus } from "@/lib/transactions";

export function StatusPill({ status }: { status: TransactionStatus }) {
  const detail = statusDetails[status];
  const tone = toneStyles[detail.tone];

  return (
    <View style={[styles.pill, tone.background]}>
      <View style={[styles.dot, tone.dot]} />
      <Text style={[styles.label, tone.text]}>{detail.label}</Text>
    </View>
  );
}

const toneStyles = {
  blue: StyleSheet.create({
    background: { backgroundColor: "#EAF3FF" },
    dot: { backgroundColor: "#0B5CAD" },
    text: { color: "#0B5CAD" },
  }),
  amber: StyleSheet.create({
    background: { backgroundColor: "#FFF4E5" },
    dot: { backgroundColor: "#B45309" },
    text: { color: "#9A4A08" },
  }),
  green: StyleSheet.create({
    background: { backgroundColor: "#EAF7EE" },
    dot: { backgroundColor: "#15803D" },
    text: { color: "#146C34" },
  }),
  red: StyleSheet.create({
    background: { backgroundColor: "#FFF0EF" },
    dot: { backgroundColor: "#B42318" },
    text: { color: "#9F1B12" },
  }),
};

const styles = StyleSheet.create({
  pill: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    flexDirection: "row-reverse",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dot: { borderRadius: 4, height: 7, width: 7 },
  label: { fontSize: 12, fontWeight: "700", writingDirection: "rtl" },
});
