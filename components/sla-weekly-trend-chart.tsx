import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { StyleSheet, View } from "react-native";

import { AppText as Text } from "@/components/ui/app-text";
import type { SlaWeeklyTrend } from "@/lib/sla-weekly-trend";

const WIDTH = 320;
const HEIGHT = 132;
const TOP = 16;
const BASELINE = 100;

function pointFor(rate: number, index: number, count: number) {
  const x = 16 + index * ((WIDTH - 32) / Math.max(count - 1, 1));
  const y = TOP + (1 - rate / 100) * (BASELINE - TOP);
  return { x, y };
}

export function SlaWeeklyTrendChart({ trend }: { trend: SlaWeeklyTrend }) {
  const points = trend.points.map((point, index) => pointFor(point.rate, index, trend.points.length));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const trendCopy = trend.direction === "up" ? `تحسّن ${trend.delta} نقطة` : trend.direction === "down" ? `انخفاض ${trend.delta} نقطة` : "أداء مستقر";
  const trendColor = trend.direction === "down" ? "#D92D20" : trend.direction === "up" ? "#14885B" : "#6A7C73";
  const icon = trend.direction === "up" ? "trending-up" : trend.direction === "down" ? "trending-down" : "remove";
  return <View accessibilityLabel={`اتجاه الأداء الأسبوعي: معدل الإنجاز ${trend.weeklyRate}%، ${trendCopy}`} style={styles.card}>
    <View style={styles.header}><View style={styles.copy}><Text style={styles.title}>اتجاه الإنجاز الأسبوعي</Text><Text style={styles.subtitle}>معدل الإكمال اليومي خلال آخر 7 أيام</Text></View><View style={styles.rate}><Text style={styles.rateValue}>{trend.weeklyRate}%</Text><Text style={styles.rateLabel}>معدل الأسبوع</Text></View></View>
    <View style={styles.trend}><Ionicons color={trendColor} name={icon} size={15} /><Text style={[styles.trendText, { color: trendColor }]}>{trendCopy}</Text><Text style={styles.completedText}>· اكتملت {trend.completedTotal} مهمة</Text></View>
    <View style={styles.chart}><Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none"><Line x1="16" y1={TOP} x2={WIDTH - 16} y2={TOP} stroke="#EDF2EE" strokeWidth="1" /><Line x1="16" y1={(TOP + BASELINE) / 2} x2={WIDTH - 16} y2={(TOP + BASELINE) / 2} stroke="#EDF2EE" strokeWidth="1" /><Line x1="16" y1={BASELINE} x2={WIDTH - 16} y2={BASELINE} stroke="#DDE8E0" strokeWidth="1" /><Path d={path} fill="none" stroke="#0B5D45" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map((point, index) => <Circle key={trend.points[index].key} cx={point.x} cy={point.y} r="4" fill="#FFFFFF" stroke="#0B5D45" strokeWidth="2.5" />)}</Svg></View>
    <View style={styles.labels}>{trend.points.map((point) => <View key={point.key} style={styles.label}><Text style={styles.day}>{point.label}</Text><Text style={styles.value}>{point.rate}%</Text></View>)}</View>
  </View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: "#FFFFFF", borderColor: "#DFE9E1", borderRadius: 20, borderWidth: 1, marginTop: 12, padding: 15 }, header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, copy: { alignItems: "flex-end", flex: 1 }, title: { color: "#17382F", fontSize: 15, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, subtitle: { color: "#6B7C73", fontSize: 11, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, rate: { alignItems: "flex-start", marginLeft: 12 }, rateValue: { color: "#0B5D45", fontSize: 22, fontWeight: "800" }, rateLabel: { color: "#6B7C73", fontSize: 10, fontWeight: "700", writingDirection: "rtl" }, trend: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "flex-end", marginTop: 12 }, trendText: { fontSize: 11, fontWeight: "800", marginRight: 4, writingDirection: "rtl" }, completedText: { color: "#74857C", fontSize: 10, writingDirection: "rtl" }, chart: { marginTop: 8 }, labels: { flexDirection: "row-reverse", justifyContent: "space-between", paddingHorizontal: 8 }, label: { alignItems: "center" }, day: { color: "#52685C", fontSize: 10, fontWeight: "800", writingDirection: "rtl" }, value: { color: "#86968D", fontSize: 9, marginTop: 2 } });
