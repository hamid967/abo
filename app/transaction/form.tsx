import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { statusDetails, TransactionStatus, transactionStatuses } from "@/lib/transactions";
import { useTransactions } from "@/lib/transactions-provider";
import { canScheduleReminder, isValidReminderTime, reminderOffsetLabels, ReminderOffsetDays, reminderOffsets } from "@/lib/reminders";
import { requestReminderPermission } from "@/lib/notification-service";

const editableStatuses = transactionStatuses.filter((status) => status !== "overdue");

export default function TransactionFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { transactions, addTransaction, updateTransaction } = useTransactions();
  const existing = transactions.find((transaction) => transaction.id === id);
  const [title, setTitle] = useState("");
  const [agency, setAgency] = useState("");
  const [reference, setReference] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<TransactionStatus>("new");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDaysBefore, setReminderDaysBefore] = useState<ReminderOffsetDays>(3);
  const [reminderHour, setReminderHour] = useState("09");
  const [reminderMinute, setReminderMinute] = useState("00");

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setAgency(existing.agency);
    setReference(existing.reference);
    setDueDate(existing.dueDate ?? "");
    setNotes(existing.notes ?? "");
    setStatus(existing.status === "overdue" ? "action_required" : existing.status);
    setReminderEnabled(existing.reminder?.enabled ?? false);
    setReminderDaysBefore(existing.reminder?.daysBefore ?? 3);
    setReminderHour(String(existing.reminder?.hour ?? 9).padStart(2, "0"));
    setReminderMinute(String(existing.reminder?.minute ?? 0).padStart(2, "0"));
  }, [existing]);

  async function handleSave() {
    if (!title.trim() || !agency.trim()) {
      Alert.alert("أكمل البيانات الأساسية", "أدخل اسم المعاملة والجهة الحكومية قبل الحفظ.");
      return;
    }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      Alert.alert("تنسيق التاريخ غير صحيح", "اكتب التاريخ بالصيغة YYYY-MM-DD، مثل 2026-08-15.");
      return;
    }
    if (reminderEnabled && !dueDate) {
      Alert.alert("أضف موعداً أولاً", "يحتاج التذكير إلى تاريخ موعد متوقع للمعاملة.");
      return;
    }
    const hour = Number(reminderHour);
    const minute = Number(reminderMinute);
    if (reminderEnabled && !isValidReminderTime(hour, minute)) {
      Alert.alert("وقت التذكير غير صحيح", "أدخل ساعة من 00 إلى 23 ودقيقة من 00 إلى 59.");
      return;
    }
    if (reminderEnabled && !canScheduleReminder(dueDate, reminderDaysBefore, hour, minute)) {
      Alert.alert("اختر موعداً مستقبلياً", "غيّر تاريخ المتابعة أو وقت التذكير ليكون بعد الوقت الحالي.");
      return;
    }

    if (reminderEnabled) {
      const permissionGranted = await requestReminderPermission();
      if (!permissionGranted) {
        Alert.alert("لم يتم تفعيل الإشعارات", "سيُحفظ التذكير، ويمكنك تفعيل إذن الإشعارات من إعدادات الجهاز لاحقاً.");
      }
    }

    const draft = { title: title.trim(), agency: agency.trim(), reference: reference.trim(), dueDate: dueDate || undefined, notes: notes.trim() || undefined, status, reminder: { enabled: reminderEnabled, daysBefore: reminderDaysBefore, hour, minute } };
    if (existing) await updateTransaction(existing.id, draft);
    else await addTransaction(draft);
    router.back();
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.nav}>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Ionicons name="close" size={23} color="#172033" />
            </Pressable>
            <View style={styles.navText}><Text style={styles.title}>{existing ? "تعديل المعاملة" : "إضافة معاملة"}</Text><Text style={styles.subtitle}>احفظ التفاصيل التي تحتاج الرجوع إليها</Text></View>
          </View>

          <FormField label="اسم المعاملة" value={title} onChangeText={setTitle} placeholder="مثال: تجديد رخصة القيادة" required />
          <FormField label="الجهة الحكومية" value={agency} onChangeText={setAgency} placeholder="مثال: إدارة المرور" required />
          <FormField label="الرقم المرجعي" value={reference} onChangeText={setReference} placeholder="رقم الطلب أو المعاملة" />
          <FormField label="موعد المتابعة" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />

          <View style={styles.reminderCard}>
            <Pressable onPress={() => setReminderEnabled((current) => !current)} style={({ pressed }) => [styles.reminderToggle, pressed && styles.pressed]}>
              <View style={[styles.reminderSwitch, reminderEnabled && styles.reminderSwitchActive]}><View style={[styles.reminderKnob, reminderEnabled && styles.reminderKnobActive]} /></View>
              <View style={styles.reminderCopy}><Text style={styles.reminderTitle}>تذكير بموعد المعاملة</Text><Text style={styles.reminderBody}>{reminderEnabled ? "سيظهر تنبيه محلي قبل الموعد المحدد." : "فعّل تنبيهاً لموعد المتابعة أو الانتهاء."}</Text></View>
              <Ionicons name={reminderEnabled ? "notifications" : "notifications-outline"} size={21} color={reminderEnabled ? "#0B5CAD" : "#667085"} />
            </Pressable>
            {reminderEnabled && (
              <>
                <View style={styles.reminderOptions}>
                  {reminderOffsets.map((offset) => <Pressable key={offset} onPress={() => setReminderDaysBefore(offset)} style={({ pressed }) => [styles.reminderOption, reminderDaysBefore === offset && styles.reminderOptionActive, pressed && styles.pressed]}><Text style={[styles.reminderOptionText, reminderDaysBefore === offset && styles.reminderOptionTextActive]}>{reminderOffsetLabels[offset]}</Text></Pressable>)}
                </View>
                <View style={styles.timeField}>
                  <Text style={styles.timeLabel}>وقت التنبيه</Text>
                  <View style={styles.timeInputs}>
                    <TextInput value={reminderHour} onChangeText={setReminderHour} keyboardType="number-pad" maxLength={2} placeholder="09" placeholderTextColor="#98A2B3" style={styles.timeInput} textAlign="center" />
                    <Text style={styles.timeSeparator}>:</Text>
                    <TextInput value={reminderMinute} onChangeText={setReminderMinute} keyboardType="number-pad" maxLength={2} placeholder="00" placeholderTextColor="#98A2B3" style={styles.timeInput} textAlign="center" />
                  </View>
                  <Text style={styles.timeHint}>الساعة ثم الدقيقة، بحسب توقيت جهازك.</Text>
                </View>
              </>
            )}
          </View>

          <Text style={styles.fieldLabel}>الحالة الحالية</Text>
          <View style={styles.statusChoices}>
            {editableStatuses.map((item) => (
              <Pressable key={item} onPress={() => setStatus(item)} style={({ pressed }) => [styles.statusChoice, status === item && styles.statusChoiceActive, pressed && styles.pressed]}>
                <Text style={[styles.statusChoiceText, status === item && styles.statusChoiceTextActive]}>{statusDetails[item].label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>ملاحظات</Text>
          <TextInput value={notes} onChangeText={setNotes} multiline placeholder="أضف ما تحتاج تذكّره عند المتابعة" placeholderTextColor="#98A2B3" style={[styles.input, styles.notes]} textAlign="right" />

          <Pressable onPress={handleSave} style={({ pressed }) => [styles.saveButton, pressed && styles.savePressed]}>
            <Ionicons name="checkmark" size={21} color="#FFFFFF" />
            <Text style={styles.saveText}>{existing ? "حفظ التعديلات" : "حفظ المعاملة"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function FormField({ label, required, ...props }: { label: string; required?: boolean } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{required ? " *" : ""}</Text>
      <TextInput {...props} placeholderTextColor="#98A2B3" style={styles.input} textAlign="right" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  nav: { alignItems: "center", flexDirection: "row-reverse", gap: 12, marginBottom: 28 },
  closeButton: { alignItems: "center", backgroundColor: "#EEF3F9", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  navText: { alignItems: "flex-end", flex: 1 },
  title: { color: "#172033", fontSize: 22, fontWeight: "800", writingDirection: "rtl" },
  subtitle: { color: "#667085", fontSize: 12, marginTop: 3, writingDirection: "rtl" },
  field: { marginBottom: 18 },
  fieldLabel: { color: "#344054", fontSize: 13, fontWeight: "800", marginBottom: 8, textAlign: "right", writingDirection: "rtl" },
  input: { backgroundColor: "#FFFFFF", borderColor: "#DCE2EA", borderRadius: 14, borderWidth: 1, color: "#172033", fontSize: 15, minHeight: 52, paddingHorizontal: 14, writingDirection: "rtl" },
  notes: { minHeight: 112, paddingTop: 14, textAlignVertical: "top" },
  statusChoices: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  statusChoice: { backgroundColor: "#FFFFFF", borderColor: "#DCE2EA", borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  statusChoiceActive: { backgroundColor: "#EAF3FF", borderColor: "#0B5CAD" },
  statusChoiceText: { color: "#667085", fontSize: 13, fontWeight: "700", writingDirection: "rtl" },
  statusChoiceTextActive: { color: "#0B5CAD" },
  reminderCard: { backgroundColor: "#F7FAFE", borderColor: "#D5E5F7", borderRadius: 16, borderWidth: 1, marginBottom: 20, padding: 14 },
  reminderToggle: { alignItems: "center", flexDirection: "row-reverse", gap: 11 },
  reminderCopy: { alignItems: "flex-end", flex: 1 },
  reminderTitle: { color: "#172033", fontSize: 14, fontWeight: "800", writingDirection: "rtl" },
  reminderBody: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  reminderSwitch: { backgroundColor: "#CBD5E1", borderRadius: 99, padding: 3, width: 39 },
  reminderSwitchActive: { backgroundColor: "#0B5CAD" },
  reminderKnob: { backgroundColor: "#FFFFFF", borderRadius: 20, height: 16, width: 16 },
  reminderKnobActive: { alignSelf: "flex-end" },
  reminderOptions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 14 },
  reminderOption: { backgroundColor: "#FFFFFF", borderColor: "#D5E5F7", borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  reminderOptionActive: { backgroundColor: "#EAF3FF", borderColor: "#0B5CAD" },
  reminderOptionText: { color: "#667085", fontSize: 12, fontWeight: "700", writingDirection: "rtl" },
  reminderOptionTextActive: { color: "#0B5CAD" },
  timeField: { alignItems: "flex-end", borderTopColor: "#D5E5F7", borderTopWidth: 1, marginTop: 14, paddingTop: 14 },
  timeLabel: { color: "#344054", fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
  timeInputs: { alignItems: "center", flexDirection: "row-reverse", gap: 8, marginTop: 8 },
  timeInput: { backgroundColor: "#FFFFFF", borderColor: "#BBD4EE", borderRadius: 10, borderWidth: 1, color: "#172033", fontSize: 16, fontWeight: "800", height: 42, width: 58 },
  timeSeparator: { color: "#0B5CAD", fontSize: 20, fontWeight: "800" },
  timeHint: { color: "#667085", fontSize: 11, marginTop: 7, textAlign: "right", writingDirection: "rtl" },
  saveButton: { alignItems: "center", backgroundColor: "#0B5CAD", borderRadius: 16, flexDirection: "row-reverse", gap: 7, justifyContent: "center", marginTop: 10, minHeight: 54 },
  saveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
  savePressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
});
