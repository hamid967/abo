import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text, AppTextInput as TextInput } from "@/components/ui/app-text";
import { canScheduleReminder, reminderOffsetLabels, reminderOffsets } from "@/lib/reminders";
import { requestReminderPermission } from "@/lib/notification-service";
import { transactionFormDefaults, transactionFormSchema, TransactionFormValues } from "@/lib/transaction-form-validation";
import { statusDetails, transactionStatuses } from "@/lib/transactions";
import { useTransactions } from "@/lib/transactions-provider";

const editableStatuses = transactionStatuses.filter((status) => !["overdue", "rejected", "cancelled", "archived"].includes(status));

export default function TransactionFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { transactions, addTransaction, updateTransaction } = useTransactions();
  const existing = transactions.find((transaction) => transaction.id === id);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setError,
    watch,
  } = useForm<TransactionFormValues>({
    defaultValues: transactionFormDefaults,
    resolver: zodResolver(transactionFormSchema),
  });
  const reminderEnabled = watch("reminderEnabled");

  useEffect(() => {
    if (!existing) {
      reset(transactionFormDefaults);
      return;
    }
    reset({
      title: existing.title,
      agency: existing.agency,
      reference: existing.reference,
      dueDate: existing.dueDate ?? "",
      notes: existing.notes ?? "",
      status: existing.status === "overdue" ? "awaiting_customer_documents" : existing.status,
      reminderEnabled: existing.reminder?.enabled ?? false,
      reminderDaysBefore: existing.reminder?.daysBefore ?? 3,
      reminderHour: String(existing.reminder?.hour ?? 9).padStart(2, "0"),
      reminderMinute: String(existing.reminder?.minute ?? 0).padStart(2, "0"),
    });
  }, [existing, reset]);

  const onSubmit = async (values: TransactionFormValues) => {
    const hour = Number(values.reminderHour);
    const minute = Number(values.reminderMinute);
    if (values.reminderEnabled && !canScheduleReminder(values.dueDate, values.reminderDaysBefore, hour, minute)) {
      setError("dueDate", { message: "اختر موعداً مستقبلياً للتذكير." });
      return;
    }

    try {
      if (values.reminderEnabled) {
        const permissionGranted = await requestReminderPermission();
        if (!permissionGranted) {
          Alert.alert("لم يتم تفعيل الإشعارات", "سيُحفظ التذكير، ويمكنك تفعيل إذن الإشعارات من إعدادات الجهاز لاحقاً.");
        }
      }

      const draft = {
        title: values.title.trim(),
        agency: values.agency.trim(),
        reference: values.reference.trim(),
        dueDate: values.dueDate || undefined,
        notes: values.notes.trim() || undefined,
        status: values.status,
        reminder: { enabled: values.reminderEnabled, daysBefore: values.reminderDaysBefore, hour, minute },
      };
      if (existing) await updateTransaction(existing.id, draft);
      else await addTransaction(draft);
      router.back();
    } catch {
      Alert.alert("ما قدرنا نحفظ المعاملة", "تحقق من اتصالك ثم جرّب مرة ثانية.");
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.nav}>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><Ionicons name="close" size={23} color="#172033" /></Pressable>
            <View style={styles.navText}><Text style={styles.title}>{existing ? "تعديل المعاملة" : "إضافة معاملة"}</Text><Text style={styles.subtitle}>احفظ التفاصيل التي تحتاج الرجوع إليها</Text></View>
          </View>

          {!existing ? <Pressable accessibilityRole="button" accessibilityLabel="إضافة معاملة عبر المحادثة الذكية" onPress={() => router.replace("/assistant/request-intake?flow=transaction" as never)} style={({ pressed }) => [styles.smartIntakeCard, pressed && styles.pressed]}><Ionicons name="chatbubbles-outline" size={22} color="#0B5D45" /><View style={styles.smartIntakeCopy}><Text style={styles.smartIntakeTitle}>تبي تضيفها بالمحادثة؟</Text><Text style={styles.smartIntakeBody}>أبو مشعل يجمع بيانات المعاملة سؤالاً بسؤال، ثم يعرضها لك للمراجعة قبل الإنشاء.</Text></View><Ionicons name="chevron-back" size={18} color="#0B5D45" /></Pressable> : null}

          <Controller control={control} name="title" render={({ field: { onChange, value } }) => <FormField label="اسم المعاملة" value={value} onChangeText={onChange} placeholder="مثال: تجديد رخصة القيادة" error={errors.title?.message} required />} />
          <Controller control={control} name="agency" render={({ field: { onChange, value } }) => <FormField label="الجهة الحكومية" value={value} onChangeText={onChange} placeholder="مثال: إدارة المرور" error={errors.agency?.message} required />} />
          <Controller control={control} name="reference" render={({ field: { onChange, value } }) => <FormField label="الرقم المرجعي" value={value} onChangeText={onChange} placeholder="رقم الطلب أو المعاملة" error={errors.reference?.message} />} />
          <Controller control={control} name="dueDate" render={({ field: { onChange, value } }) => <FormField label="موعد المتابعة" value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" error={errors.dueDate?.message} />} />

          <View style={styles.reminderCard}>
            <Controller control={control} name="reminderEnabled" render={({ field: { onChange, value } }) => <Pressable onPress={() => onChange(!value)} style={({ pressed }) => [styles.reminderToggle, pressed && styles.pressed]}><View style={[styles.reminderSwitch, value && styles.reminderSwitchActive]}><View style={[styles.reminderKnob, value && styles.reminderKnobActive]} /></View><View style={styles.reminderCopy}><Text style={styles.reminderTitle}>تذكير بموعد المعاملة</Text><Text style={styles.reminderBody}>{value ? "سيظهر تنبيه محلي قبل الموعد المحدد." : "فعّل تنبيهاً لموعد المتابعة أو الانتهاء."}</Text></View><Ionicons name={value ? "notifications" : "notifications-outline"} size={21} color={value ? "#0B5CAD" : "#667085"} /></Pressable>} />
            {reminderEnabled && <>
              <Controller control={control} name="reminderDaysBefore" render={({ field: { onChange, value } }) => <View style={styles.reminderOptions}>{reminderOffsets.map((offset) => <Pressable key={offset} onPress={() => onChange(offset)} style={({ pressed }) => [styles.reminderOption, value === offset && styles.reminderOptionActive, pressed && styles.pressed]}><Text style={[styles.reminderOptionText, value === offset && styles.reminderOptionTextActive]}>{reminderOffsetLabels[offset]}</Text></Pressable>)}</View>} />
              <View style={styles.timeField}><Text style={styles.timeLabel}>وقت التنبيه</Text><View style={styles.timeInputs}><Controller control={control} name="reminderHour" render={({ field: { onChange, value } }) => <TextInput value={value} onChangeText={onChange} keyboardType="number-pad" maxLength={2} placeholder="09" placeholderTextColor="#98A2B3" style={styles.timeInput} textAlign="center" />} /><Text style={styles.timeSeparator}>:</Text><Controller control={control} name="reminderMinute" render={({ field: { onChange, value } }) => <TextInput value={value} onChangeText={onChange} keyboardType="number-pad" maxLength={2} placeholder="00" placeholderTextColor="#98A2B3" style={styles.timeInput} textAlign="center" />} /></View><Text style={styles.timeHint}>{errors.reminderHour?.message ?? errors.reminderMinute?.message ?? "الساعة ثم الدقيقة، بحسب توقيت جهازك."}</Text></View>
            </>}
          </View>

          <Text style={styles.fieldLabel}>الحالة الحالية</Text>
          <Controller control={control} name="status" render={({ field: { onChange, value } }) => <View style={styles.statusChoices}>{editableStatuses.map((item) => <Pressable key={item} onPress={() => onChange(item)} style={({ pressed }) => [styles.statusChoice, value === item && styles.statusChoiceActive, pressed && styles.pressed]}><Text style={[styles.statusChoiceText, value === item && styles.statusChoiceTextActive]}>{statusDetails[item].label}</Text></Pressable>)}</View>} />

          <Controller control={control} name="notes" render={({ field: { onChange, value } }) => <View style={styles.field}><Text style={styles.fieldLabel}>ملاحظات</Text><TextInput value={value} onChangeText={onChange} multiline placeholder="أضف ما تحتاج تذكّره عند المتابعة" placeholderTextColor="#98A2B3" style={[styles.input, styles.notes]} textAlign="right" /><FieldError message={errors.notes?.message} /></View>} />

          <Pressable disabled={isSubmitting} onPress={handleSubmit(onSubmit)} style={({ pressed }) => [styles.saveButton, (pressed || isSubmitting) && styles.savePressed]}><Ionicons name="checkmark" size={21} color="#FFFFFF" /><Text style={styles.saveText}>{isSubmitting ? "قاعدين نحفظ…" : existing ? "حفظ التعديلات" : "حفظ المعاملة"}</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function FormField({ label, required, error, ...props }: { label: string; required?: boolean; error?: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}{required ? " *" : ""}</Text><TextInput {...props} placeholderTextColor="#98A2B3" style={[styles.input, error ? styles.inputError : undefined]} textAlign="right" /><FieldError message={error} /></View>;
}

function FieldError({ message }: { message?: string }) {
  return message ? <Text style={styles.fieldError}>{message}</Text> : null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 20, paddingBottom: 32 }, nav: { alignItems: "center", flexDirection: "row-reverse", gap: 12, marginBottom: 28 }, closeButton: { alignItems: "center", backgroundColor: "#EEF3F9", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, navText: { alignItems: "flex-end", flex: 1 }, title: { color: "#172033", fontSize: 22, fontWeight: "800", writingDirection: "rtl" }, subtitle: { color: "#667085", fontSize: 12, marginTop: 3, writingDirection: "rtl" }, smartIntakeCard: { alignItems: "center", backgroundColor: "#F2F9F4", borderColor: "#BFDCC7", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginBottom: 22, padding: 13 }, smartIntakeCopy: { alignItems: "flex-end", flex: 1 }, smartIntakeTitle: { color: "#17382F", fontSize: 13, fontWeight: "900", writingDirection: "rtl" }, smartIntakeBody: { color: "#49665B", fontSize: 11, lineHeight: 17, marginTop: 3, textAlign: "right", writingDirection: "rtl" }, field: { marginBottom: 18 }, fieldLabel: { color: "#344054", fontSize: 13, fontWeight: "800", marginBottom: 8, textAlign: "right", writingDirection: "rtl" }, input: { backgroundColor: "#FFFFFF", borderColor: "#DCE2EA", borderRadius: 14, borderWidth: 1, color: "#172033", fontSize: 15, minHeight: 52, paddingHorizontal: 14, writingDirection: "rtl" }, inputError: { borderColor: "#C43B3B" }, fieldError: { color: "#B42318", fontSize: 11, marginTop: 6, textAlign: "right", writingDirection: "rtl" }, notes: { minHeight: 112, paddingTop: 14, textAlignVertical: "top" }, statusChoices: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 20 }, statusChoice: { backgroundColor: "#FFFFFF", borderColor: "#DCE2EA", borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 }, statusChoiceActive: { backgroundColor: "#EAF3FF", borderColor: "#0B5CAD" }, statusChoiceText: { color: "#667085", fontSize: 13, fontWeight: "700", writingDirection: "rtl" }, statusChoiceTextActive: { color: "#0B5CAD" }, reminderCard: { backgroundColor: "#F7FAFE", borderColor: "#D5E5F7", borderRadius: 16, borderWidth: 1, marginBottom: 20, padding: 14 }, reminderToggle: { alignItems: "center", flexDirection: "row-reverse", gap: 11 }, reminderCopy: { alignItems: "flex-end", flex: 1 }, reminderTitle: { color: "#172033", fontSize: 14, fontWeight: "800", writingDirection: "rtl" }, reminderBody: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right", writingDirection: "rtl" }, reminderSwitch: { backgroundColor: "#CBD5E1", borderRadius: 99, padding: 3, width: 39 }, reminderSwitchActive: { backgroundColor: "#0B5CAD" }, reminderKnob: { backgroundColor: "#FFFFFF", borderRadius: 20, height: 16, width: 16 }, reminderKnobActive: { alignSelf: "flex-end" }, reminderOptions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 14 }, reminderOption: { backgroundColor: "#FFFFFF", borderColor: "#D5E5F7", borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 }, reminderOptionActive: { backgroundColor: "#EAF3FF", borderColor: "#0B5CAD" }, reminderOptionText: { color: "#667085", fontSize: 12, fontWeight: "700", writingDirection: "rtl" }, reminderOptionTextActive: { color: "#0B5CAD" }, timeField: { alignItems: "flex-end", borderTopColor: "#D5E5F7", borderTopWidth: 1, marginTop: 14, paddingTop: 14 }, timeLabel: { color: "#344054", fontSize: 13, fontWeight: "800", writingDirection: "rtl" }, timeInputs: { alignItems: "center", flexDirection: "row-reverse", gap: 8, marginTop: 8 }, timeInput: { backgroundColor: "#FFFFFF", borderColor: "#BBD4EE", borderRadius: 10, borderWidth: 1, color: "#172033", fontSize: 16, fontWeight: "800", height: 42, width: 58 }, timeSeparator: { color: "#0B5CAD", fontSize: 20, fontWeight: "800" }, timeHint: { color: "#667085", fontSize: 11, marginTop: 7, textAlign: "right", writingDirection: "rtl" }, saveButton: { alignItems: "center", backgroundColor: "#0B5CAD", borderRadius: 16, flexDirection: "row-reverse", gap: 7, justifyContent: "center", marginTop: 10, minHeight: 54 }, saveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", writingDirection: "rtl" }, pressed: { opacity: 0.72 }, savePressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
});
