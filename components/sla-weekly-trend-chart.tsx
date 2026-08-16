import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText as Text } from "@/components/ui/app-text";
import type { SlaTrendPeriodDays, SlaWeeklyTrend } from "@/lib/sla-weekly-trend";

const WIDTH = 320;
const HEIGHT = 132;
const TOP = 16;
const BASELINE = 100;

function pointFor(rate: number, index: number, count: number) {
  const x = 16 + index * ((WIDTH - 32) / Math.max(count - 1, 1));
  const y = TOP + (1 - rate / 100) * (BASELINE - TOP);
  return { x, y };
}

export function SlaWeeklyTrendChart({ trend, onPeriodChange }: { trend: SlaWeeklyTrend; onPeriodChange: (period: SlaTrendPeriodDays) => void }) {
  const points = trend.points.map((point, index) => pointFor(point.rate, index, trend.points.length));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const trendCopy = trend.direction === "up" ? `تحسّن ${trend.delta} نقطة` : trend.direction === "down" ? `انخفاض ${trend.delta} نقطة` : "أداء مستقر";
  const trendColor = trend.direction === "down" ? "#D92D20" : trend.direction === "up" ? "#14885B" : "#6A7C73";
  const icon = trend.direction === "up" ? "trending-up" : trend.direction === "down" ? "trending-down" : "remove";
  const comparisonColor = trend.weekComparisonDirection === "down" ? "#D92D20" : trend.weekComparisonDirection === "up" ? "#14885B" : "#6A7C73";
  const comparisonIcon = trend.weekComparisonDirection === "up" ? "arrow-up" : trend.weekComparisonDirection === "down" ? "arrow-down" : "remove";
  const comparisonCopy = trend.weekComparisonDirection === "up" ? `أفضل بـ ${trend.weekComparisonDelta} نقطة` : trend.weekComparisonDirection === "down" ? `أقل بـ ${trend.weekComparisonDelta} نقطة` : "بلا تغيير";
  const periodTitle = trend.periodDays === 30 ? "آخر 30 يوماً" : "آخر 7 أيام";
  const labelInterval = trend.periodDays === 30 ? 5 : 1;
  return <View accessibilityLabel={`اتجاه الأداء خلال ${periodTitle}: معدل الإنجاز ${trend.weeklyRate}%، مقارنة بالفترة السابقة ${trend.previousWeekRate}%، ${comparisonCopy}`} style={styles.card}>
    <View style={styles.header}><View style={styles.copy}><Text style={styles.title}>اتجاه الإنجاز</Text><Text style={styles.subtitle}>معدل الإكمال اليومي خلال {periodTitle}</Text></View><View style={styles.rate}><Text style={styles.rateValue}>{trend.weeklyRate}%</Text><Text style={styles.rateLabel}>معدل الفترة</Text></View></View>
    <View style={styles.periodPicker}>{([7, 30] as SlaTrendPeriodDays[]).map((period) => <Pressable key={period} accessibilityRole="button" accessibilityLabel={`عرض مقارنة آخر ${period} يوماً`} onPress={() => onPeriodChange(period)} style={({ pressed }) => [styles.periodButton, trend.periodDays === period && styles.periodButtonActive, pressed && styles.pressed]}><Text style={[styles.periodText, trend.periodDays === period && styles.periodTextActive]}>{period} يوم</Text></Pressable>)}</View>
    <View style={styles.trend}><Ionicons color={trendColor} name={icon} size={15} /><Text style={[styles.trendText, { color: trendColor }]}>{trendCopy}</Text><Text style={styles.completedText}>· اكتملت {trend.completedTotal} مهمة</Text></View>
    <View style={styles.comparison}><View style={styles.comparisonBlock}><Text style={styles.comparisonLabel}>الأسبوع الحالي</Text><Text style={styles.comparisonValue}>{trend.weeklyRate}%</Text><Text style={styles.comparisonMeta}>{trend.completedTotal} مهمة مكتملة</Text></View><View style={styles.comparisonDelta}><Ionicons color={comparisonColor} name={comparisonIcon} size={15} /><Text style={[styles.comparisonDeltaText, { color: comparisonColor }]}>{comparisonCopy}</Text></View><View style={styles.comparisonBlock}><Text style={styles.comparisonLabel}>الأسبوع السابق</Text><Text style={styles.comparisonValue}>{trend.previousWeekRate}%</Text><Text style={styles.comparisonMeta}>{trend.previousCompletedTotal} مهمة مكتملة</Text></View></View>
    <View style={styles.chart}><Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none"><Line x1="16" y1={TOP} x2={WIDTH - 16} y2={TOP} stroke="#EDF2EE" strokeWidth="1" /><Line x1="16" y1={(TOP + BASELINE) / 2} x2={WIDTH - 16} y2={(TOP + BASELINE) / 2} stroke="#EDF2EE" strokeWidth="1" /><Line x1="16" y1={BASELINE} x2={WIDTH - 16} y2={BASELINE} stroke="#DDE8E0" strokeWidth="1" /><Path d={path} fill="none" stroke="#0B5D45" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map((point, index) => <Circle key={trend.points[index].key} cx={point.x} cy={point.y} r="4" fill="#FFFFFF" stroke="#0B5D45" strokeWidth="2.5" />)}</Svg></View>
    <View style={styles.labels}>{trend.points.map((point, index) => (index % labelInterval === 0 || index === trend.points.length - 1) ? <View key={point.key} style={styles.label}><Text style={styles.day}>{point.label}</Text><Text style={styles.value}>{point.rate}%</Text></View> : <View key={point.key} style={styles.labelSpacer} />)}</View>
  </View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: "#FFFFFF", borderColor: "#DFE9E1", borderRadius: 20, borderWidth: 1, marginTop: 12, padding: 15 }, header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, copy: { alignItems: "flex-end", flex: 1 }, title: { color: "#17382F", fontSize: 15, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, subtitle: { color: "#6B7C73", fontSize: 11, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, rate: { alignItems: "flex-start", marginLeft: 12 }, rateValue: { color: "#0B5D45", fontSize: 22, fontWeight: "800" }, rateLabel: { color: "#6B7C73", fontSize: 10, fontWeight: "700", writingDirection: "rtl" }, periodPicker: { alignSelf: "flex-end", backgroundColor: "#F2F6F3", borderRadius: 11, flexDirection: "row-reverse", gap: 3, marginTop: 12, padding: 3 }, periodButton: { borderRadius: 8, minWidth: 55, paddingHorizontal: 9, paddingVertical: 6 }, periodButtonActive: { backgroundColor: "#FFFFFF" }, periodText: { color: "#74857C", fontSize: 10, fontWeight: "800", textAlign: "center", writingDirection: "rtl" }, periodTextActive: { color: "#0B5D45" }, pressed: { opacity: 0.7 }, trend: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "flex-end", marginTop: 12 }, trendText: { fontSize: 11, fontWeight: "800", marginRight: 4, writingDirection: "rtl" }, completedText: { color: "#74857C", fontSize: 10, writingDirection: "rtl" }, comparison: { alignItems: "center", backgroundColor: "#F7FAF8", borderRadius: 14, flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 12, padding: 10 }, comparisonBlock: { alignItems: "center", flex: 1 }, comparisonLabel: { color: "#6B7C73", fontSize: 10, fontWeight: "700", writingDirection: "rtl" }, comparisonValue: { color: "#17382F", fontSize: 17, fontWeight: "800", marginTop: 3 }, comparisonMeta: { color: "#819189", fontSize: 9, marginTop: 2, writingDirection: "rtl" }, comparisonDelta: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2EAE4", borderRadius: 10, borderWidth: 1, flexDirection: "row-reverse", gap: 3, paddingHorizontal: 7, paddingVertical: 5 }, comparisonDeltaText: { fontSize: 9, fontWeight: "800", writingDirection: "rtl" }, chart: { marginTop: 8 }, labels: { flexDirection: "row-reverse", justifyContent: "space-between", paddingHorizontal: 8 }, label: { alignItems: "center", flex: 1 }, labelSpacer: { flex: 1 }, day: { color: "#52685C", fontSize: 10, fontWeight: "800", writingDirection: "rtl" }, value: { color: "#86968D", fontSize: 9, marginTop: 2 } });
