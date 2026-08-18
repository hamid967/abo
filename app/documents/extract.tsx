import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import { trpc } from "@/lib/trpc";

export default function ExtractDocumentScreen() {
  const router = useRouter();
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const id = Number(documentId);
  const utils = trpc.useUtils();
  const [consented, setConsented] = useState(false);
  const [preview, setPreview] = useState<{ extractionId: string; documentType: string | null; expiryDate: string | null; fields: { label: string; value: string; confidence: "high" | "medium" | "low" }[]; reviewNote: string } | null>(null);
  const extract = trpc.documents.extractFields.useMutation();
  const confirm = trpc.documents.confirmExtractedFields.useMutation();
  const analyze = async () => {
    if (!consented) return;
    try {
      setPreview(await extract.mutateAsync({ documentId: id, consentToProcess: true, language: "ar" }));
    } catch (error) {
      const message = error instanceof Error && error.message.includes("DOCUMENT_IMAGE_REQUIRED") ? "الاستخراج الذكي متاح حالياً لصور JPG وPNG فقط." : "ما قدرنا نحلل الصورة الآن، جرّب مرة ثانية.";
      Alert.alert("تحليل المستند", message);
    }
  };
  const confirmPreview = async () => {
    if (!preview) return;
    try {
      await confirm.mutateAsync({ extractionId: preview.extractionId });
      await utils.documents.list.invalidate();
      Alert.alert("تم حفظ الحقول", "تم حفظ نوع المستند فقط بعد تأكيدك. راجع القيم الظاهرة قبل استخدامها في أي طلب.");
      router.back();
    } catch {
      Alert.alert("ما قدرنا نحفظ الحقول", "جرّب مرة ثانية.");
    }
  };
  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-forward" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><Text style={styles.title}>استخراج حقول المستند</Text><Text style={styles.subtitle}>معاينة ذكية للمراجعة، وليست تحققاً رسمياً من صحة المستند.</Text></View></View><View style={styles.notice}><Ionicons name="scan-outline" size={20} color="#0B5D45" /><Text style={styles.noticeText}>نستخرج حقولاً ظاهرة فقط من الصورة. لا تحفظ النتيجة في ملفك إلا بعد تأكيدك، ولا تعتمدها كقرار أو إثبات رسمي.</Text></View>{!preview ? <><Pressable onPress={() => setConsented((value) => !value)} style={styles.consent}><Ionicons name={consented ? "checkbox" : "square-outline"} size={22} color="#0B5D45" /><Text style={styles.consentText}>أوافق على معالجة هذه الصورة لاستخراج حقول ظاهرة للمراجعة.</Text></Pressable><Pressable disabled={!consented || extract.isPending} onPress={() => void analyze()} style={[styles.primary, (!consented || extract.isPending) && styles.disabled]}>{extract.isPending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="sparkles-outline" size={19} color="#FFFFFF" /><Text style={styles.primaryText}>تحليل الصورة</Text></>}</Pressable></> : <><View style={styles.resultCard}><Text style={styles.resultTitle}>نتيجة أولية للمراجعة</Text><Field label="نوع المستند" value={preview.documentType ?? "غير واضح"} /><Field label="تاريخ الانتهاء" value={preview.expiryDate ?? "غير ظاهر"} />{preview.fields.map((field) => <Field key={`${field.label}-${field.value}`} label={`${field.label} · ${field.confidence === "high" ? "ثقة عالية" : field.confidence === "medium" ? "ثقة متوسطة" : "ثقة منخفضة"}`} value={field.value} />)}<Text style={styles.note}>{preview.reviewNote}</Text></View><Pressable disabled={confirm.isPending} onPress={() => void confirmPreview()} style={[styles.primary, confirm.isPending && styles.disabled]}>{confirm.isPending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" /><Text style={styles.primaryText}>تأكيد حفظ نوع المستند</Text></>}</Pressable><Pressable onPress={() => setPreview(null)} style={styles.secondary}><Text style={styles.secondaryText}>إعادة التحليل</Text></Pressable></>}</ScrollView></ScreenContainer>;
}

function Field({ label, value }: { label: string; value: string }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{value}</Text></View>; }

const styles = StyleSheet.create({ content: { padding: 18, paddingBottom: 42 }, header: { alignItems: "center", flexDirection: "row-reverse", gap: 11 }, back: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, headerCopy: { alignItems: "flex-end", flex: 1 }, title: { color: "#17382F", fontSize: 20, fontWeight: "900", textAlign: "right", writingDirection: "rtl" }, subtitle: { color: "#66756E", fontSize: 11, lineHeight: 17, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, notice: { alignItems: "flex-start", backgroundColor: "#F1F8F3", borderColor: "#D7E9DB", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 9, marginTop: 20, padding: 13 }, noticeText: { color: "#49665B", flex: 1, fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" }, consent: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 9, marginTop: 20, padding: 10 }, consentText: { color: "#344054", flex: 1, fontSize: 13, lineHeight: 21, textAlign: "right", writingDirection: "rtl" }, primary: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 14, flexDirection: "row-reverse", gap: 7, justifyContent: "center", marginTop: 16, minHeight: 52 }, primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", writingDirection: "rtl" }, disabled: { opacity: 0.55 }, resultCard: { backgroundColor: "#FFFFFF", borderColor: "#D7E9DB", borderRadius: 18, borderWidth: 1, marginTop: 20, padding: 14 }, resultTitle: { color: "#17382F", fontSize: 15, fontWeight: "900", textAlign: "right", writingDirection: "rtl" }, field: { borderBottomColor: "#E8EEE9", borderBottomWidth: 1, paddingVertical: 11 }, fieldLabel: { color: "#66756E", fontSize: 11, textAlign: "right", writingDirection: "rtl" }, fieldValue: { color: "#17382F", fontSize: 14, fontWeight: "800", marginTop: 4, textAlign: "right", writingDirection: "rtl" }, note: { color: "#6E6749", fontSize: 11, lineHeight: 18, marginTop: 12, textAlign: "right", writingDirection: "rtl" }, secondary: { alignItems: "center", marginTop: 9, padding: 12 }, secondaryText: { color: "#0B5D45", fontSize: 13, fontWeight: "800", writingDirection: "rtl" } });
