import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { AppText as Text } from "@/components/ui/app-text";

type PlaybookJourneyProps = {
  playbook: {
    playbookName: string;
    versionNumber: number;
    requirements: unknown;
    exceptions: unknown;
    steps: {
      stepKey: string;
      title: string;
      instructions: string | null;
      actionType: string;
      isRequired: boolean;
      expectedDurationMinutes: number | null;
    }[];
  };
  isArabic: boolean;
  direction: "rtl" | "ltr";
};

function durationLabel(minutes: number, isArabic: boolean) {
  if (minutes < 60) return isArabic ? `${minutes} دقيقة` : `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  if (hours < 24) return isArabic ? `${hours} ساعة` : `${hours} hr`;
  const days = Math.round((hours / 24) * 10) / 10;
  return isArabic ? `${days} يوم` : `${days} days`;
}

export function PlaybookJourney({
  playbook,
  isArabic,
  direction,
}: PlaybookJourneyProps) {
  const requirements = Array.isArray(playbook.requirements)
    ? playbook.requirements.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const exceptions = Array.isArray(playbook.exceptions)
    ? playbook.exceptions.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const estimatedMinutes = playbook.steps.reduce(
    (total, step) => total + (step.expectedDurationMinutes ?? 0),
    0,
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.mark}>
          <Ionicons name="map-outline" size={18} color="#0B5D45" />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { writingDirection: direction }]}>
            {isArabic
              ? `خطة الخدمة: ${playbook.playbookName}`
              : `Service plan: ${playbook.playbookName}`}
          </Text>
          <Text style={[styles.meta, { writingDirection: direction }]}>
            {isArabic
              ? `الإصدار ${playbook.versionNumber} — تظهر لك قبل الإرسال`
              : `Version ${playbook.versionNumber} — shown before submission`}
          </Text>
        </View>
      </View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryBadge}>
          <Ionicons name="list-outline" size={13} color="#0B5D45" />
          <Text style={styles.summaryText}>
            {isArabic
              ? `${playbook.steps.length} خطوات`
              : `${playbook.steps.length} steps`}
          </Text>
        </View>
        {estimatedMinutes > 0 ? (
          <View style={styles.summaryBadge}>
            <Ionicons name="time-outline" size={13} color="#0B5D45" />
            <Text style={styles.summaryText}>
              {isArabic ? "تقديري: " : "Estimate: "}
              {durationLabel(estimatedMinutes, isArabic)}
            </Text>
          </View>
        ) : null}
      </View>
      {requirements.length ? (
        <View style={styles.section}>
          <Text style={[styles.heading, { writingDirection: direction }]}>
            {isArabic ? "متطلبات الخدمة" : "Service requirements"}
          </Text>
          {requirements.map((requirement) => (
            <View key={requirement} style={styles.row}>
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color="#0B5D45"
              />
              <Text style={[styles.rowText, { writingDirection: direction }]}>
                {requirement}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {exceptions.length ? (
        <View
          style={[
            styles.warning,
            { flexDirection: isArabic ? "row-reverse" : "row" },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={16} color="#9A5A12" />
          <Text style={[styles.warningText, { writingDirection: direction }]}>
            {exceptions.join(" · ")}
          </Text>
        </View>
      ) : null}
      <View style={styles.section}>
        <Text style={[styles.heading, { writingDirection: direction }]}>
          {isArabic ? "خطوات الرحلة" : "Journey steps"}
        </Text>
        {playbook.steps.map((step, index) => (
          <View key={step.stepKey} style={styles.row}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <View style={styles.stepCopy}>
              <Text style={[styles.rowText, { writingDirection: direction }]}>
                {step.title}
                {step.isRequired ? (isArabic ? " · مطلوب" : " · Required") : ""}
              </Text>
              {step.instructions ? (
                <Text
                  style={[styles.instructions, { writingDirection: direction }]}
                >
                  {step.instructions}
                </Text>
              ) : null}
              {step.expectedDurationMinutes ? (
                <Text style={styles.duration}>
                  {isArabic ? "المدة المتوقعة: " : "Expected: "}
                  {durationLabel(step.expectedDurationMinutes, isArabic)}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F8FCF8",
    borderColor: "#CDE4D2",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 13,
  },
  header: { alignItems: "center", flexDirection: "row-reverse", gap: 9 },
  mark: {
    alignItems: "center",
    backgroundColor: "#E5F3E8",
    borderRadius: 11,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  copy: { alignItems: "flex-end", flex: 1 },
  title: {
    color: "#17382F",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  meta: { color: "#5F7B6B", fontSize: 10, marginTop: 3, textAlign: "right" },
  summaryRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  summaryBadge: {
    alignItems: "center",
    backgroundColor: "#EAF6ED",
    borderRadius: 999,
    flexDirection: "row-reverse",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  summaryText: { color: "#176C47", fontSize: 9, fontWeight: "800" },
  section: { gap: 6 },
  heading: {
    color: "#0B5D45",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "right",
  },
  row: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 7 },
  rowText: {
    color: "#385347",
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "right",
  },
  stepNumber: {
    backgroundColor: "#DCEFE0",
    borderRadius: 10,
    color: "#0B5D45",
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  stepCopy: { flex: 1 },
  instructions: {
    color: "#6A7F72",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
    textAlign: "right",
  },
  duration: { color: "#0B5D45", fontSize: 9, fontWeight: "700", marginTop: 3 },
  warning: {
    alignItems: "flex-start",
    backgroundColor: "#FFF6E8",
    borderColor: "#F0D6A7",
    borderRadius: 10,
    borderWidth: 1,
    gap: 7,
    padding: 9,
  },
  warningText: {
    color: "#7A5315",
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "right",
  },
});
