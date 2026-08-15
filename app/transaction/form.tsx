import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { statusDetails, TransactionStatus, transactionStatuses } from "@/lib/transactions";
import { useTransactions } from "@/lib/transactions-provider";

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

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setAgency(existing.agency);
    setReference(existing.reference);
    setDueDate(existing.dueDate ?? "");
    setNotes(existing.notes ?? "");
    setStatus(existing.status === "overdue" ? "action_required" : existing.status);
  }, [existing]);

  function handleSave() {
    if (!title.trim() || !agency.trim()) {
      Alert.alert("أكمل البيانات الأساسية", "أدخل اسم المعاملة والجهة الحكومية قبل الحفظ.");
      return;
    }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      Alert.alert("تنسيق التاريخ غير صحيح", "اكتب التاريخ بالصيغة YYYY-MM-DD، مثل 2026-08-15.");
      return;
    }

    const draft = { title: title.trim(), agency: agency.trim(), reference: reference.trim(), dueDate: dueDate || undefined, notes: notes.trim() || undefined, status };
    if (existing) updateTransaction(existing.id, draft);
    else addTransaction(draft);
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
  saveButton: { alignItems: "center", backgroundColor: "#0B5CAD", borderRadius: 16, flexDirection: "row-reverse", gap: 7, justifyContent: "center", marginTop: 10, minHeight: 54 },
  saveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
  savePressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
});
