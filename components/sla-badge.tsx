import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText as Text } from "@/components/ui/app-text";
import { getSlaStatus, type SlaState } from "@/lib/sla-status";

const tone: Record<SlaState, { background: string; border: string; text: string; dot: string }> = {
  on_track: { background: "#ECF8F0", border: "#B9DFC5", text: "#166B43", dot: "#1E8C5A" },
  at_risk: { background: "#FFF7E8", border: "#F2D49C", text: "#995C0A", dot: "#D88712" },
  critical: { background: "#FFF1E8", border: "#F2B79A", text: "#B54708", dot: "#D95D16" },
  overdue: { background: "#FEF1F1", border: "#F1B7B7", text: "#B42318", dot: "#D92D20" },
  completed: { background: "#F1F5F2", border: "#DDE7DF", text: "#5D7266", dot: "#7B9385" },
  unset: { background: "#F5F7F6", border: "#E0E7E2", text: "#6E8176", dot: "#9AACA0" },
};

export function SlaBadge({ dueAt, status, compact = false }: { dueAt?: string; status?: string; compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const sla = getSlaStatus(dueAt, status, now);
  const colors = tone[sla.state];
  return <View accessibilityRole="text" accessibilityLabel={sla.accessibilityLabel} style={[styles.badge, compact && styles.compact, { backgroundColor: colors.background, borderColor: colors.border }]}><View style={[styles.dot, { backgroundColor: colors.dot }]} /><Text numberOfLines={1} style={[styles.label, { color: colors.text }]}>{sla.label}</Text></View>;
}

const styles = StyleSheet.create({ badge: { alignItems: "center", alignSelf: "flex-end", borderRadius: 999, borderWidth: 1, flexDirection: "row-reverse", gap: 5, marginTop: 7, maxWidth: "100%", paddingHorizontal: 8, paddingVertical: 5 }, compact: { alignSelf: "stretch", marginTop: 8 }, dot: { borderRadius: 4, height: 7, width: 7 }, label: { fontSize: 10, fontWeight: "800", writingDirection: "rtl" } });
