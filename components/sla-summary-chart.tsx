import Svg, { Circle } from "react-native-svg";
import { StyleSheet, View } from "react-native";

import type { SlaDashboardSummary } from "@/lib/sla-dashboard";
import { AppText as Text } from "@/components/ui/app-text";

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function SlaSummaryChart({ summary }: { summary: SlaDashboardSummary }) {
  const completedOffset = CIRCUMFERENCE * (1 - summary.completedPercent / 100);
  return <View accessibilityLabel={`ملخص SLA: ${summary.completedPercent}% منجزة و${summary.overduePercent}% متأخرة`} style={styles.card}>
    <View style={styles.topRow}><View style={styles.copy}><Text style={styles.title}>ملخص التزام المهام</Text><Text style={styles.subtitle}>من إجمالي {summary.total} مهمة ظاهرة لحسابك</Text></View><View style={styles.donut}><Svg width={100} height={100} viewBox="0 0 100 100"><Circle cx="50" cy="50" r={RADIUS} stroke="#E7EFE9" strokeWidth="10" fill="none" /><Circle cx="50" cy="50" r={RADIUS} stroke="#14885B" strokeWidth="10" fill="none" strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`} strokeDashoffset={completedOffset} strokeLinecap="round" rotation="-90" origin="50, 50" /></Svg><View style={styles.donutLabel}><Text style={styles.donutPercent}>{summary.completedPercent}%</Text><Text style={styles.donutCaption}>منجزة</Text></View></View></View>
    <View style={styles.bar}><View style={[styles.barSegment, styles.completedSegment, { flex: summary.completedPercent || 0.001 }]} /><View style={[styles.barSegment, styles.overdueSegment, { flex: summary.overduePercent || 0.001 }]} /><View style={[styles.barSegment, styles.activeSegment, { flex: summary.activePercent || 0.001 }]} /></View>
    <View style={styles.metrics}><Metric color="#14885B" label="منجزة" value={`${summary.completedPercent}%`} count={summary.completed} /><Metric color="#D92D20" label="متأخرة" value={`${summary.overduePercent}%`} count={summary.overdue} /><Metric color="#D88712" label="قيد المتابعة" value={`${summary.activePercent}%`} count={summary.active} /></View>
  </View>;
}

function Metric({ color, label, value, count }: { color: string; label: string; value: string; count: number }) { return <View style={styles.metric}><View style={styles.metricTitle}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.metricLabel}>{label}</Text></View><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricCount}>{count} مهمة</Text></View>; }

const styles = StyleSheet.create({ card: { backgroundColor: "#FFFFFF", borderColor: "#DFE9E1", borderRadius: 20, borderWidth: 1, marginTop: 16, padding: 15 }, topRow: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, copy: { alignItems: "flex-end", flex: 1, paddingLeft: 10 }, title: { color: "#17382F", fontSize: 15, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, subtitle: { color: "#6B7C73", fontSize: 11, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, donut: { alignItems: "center", height: 100, justifyContent: "center", width: 100 }, donutLabel: { alignItems: "center", justifyContent: "center", position: "absolute" }, donutPercent: { color: "#17382F", fontSize: 18, fontWeight: "800" }, donutCaption: { color: "#6B7C73", fontSize: 10, fontWeight: "700", writingDirection: "rtl" }, bar: { borderRadius: 99, flexDirection: "row-reverse", height: 9, marginTop: 14, overflow: "hidden", width: "100%" }, barSegment: { height: "100%" }, completedSegment: { backgroundColor: "#14885B" }, overdueSegment: { backgroundColor: "#D92D20" }, activeSegment: { backgroundColor: "#D88712" }, metrics: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 13 }, metric: { alignItems: "flex-end", flex: 1 }, metricTitle: { alignItems: "center", flexDirection: "row-reverse", gap: 4 }, dot: { borderRadius: 4, height: 8, width: 8 }, metricLabel: { color: "#6A7C73", fontSize: 10, fontWeight: "700", writingDirection: "rtl" }, metricValue: { color: "#17382F", fontSize: 16, fontWeight: "800", marginTop: 3 }, metricCount: { color: "#82938A", fontSize: 10, marginTop: 1, writingDirection: "rtl" } });
