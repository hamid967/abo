import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { BeneficiaryType, TransactionPriority } from "@/lib/transactions";
import { useTransactions } from "@/lib/transactions-provider";
import { useAccount } from "@/hooks/use-account";
import { trpc } from "@/lib/trpc";

const beneficiaryOptions: { value: BeneficiaryType; label: string }[] = [
  { value: "individual", label: "فرد" },
  { value: "establishment", label: "مؤسسة" },
  { value: "company", label: "شركة" },
  { value: "association", label: "جمعية" },
  { value: "nonprofit", label: "جهة غير ربحية" },
  { value: "representative", label: "وكيل عن مستفيد" },
];

const serviceOptions = ["استفسار", "متابعة معاملة", "تقديم طلب جديد", "تجديد ترخيص أو وثيقة", "تحديث أو تصحيح بيانات", "حجز موعد", "اعتراض أو تظلم", "طلب مخصص"];
const agencyOptions = ["وزارة الداخلية", "الجوازات", "الأحوال المدنية", "المرور", "وزارة الموارد البشرية", "وزارة التجارة", "الزكاة والضريبة والجمارك", "البلديات والأمانات", "وزارة العدل", "جهة أخرى"];
const priorities: { value: TransactionPriority; label: string }[] = [{ value: "low", label: "منخفضة" }, { value: "normal", label: "عادية" }, { value: "high", label: "عالية" }, { value: "urgent", label: "عاجلة" }];

export default function NewRequestScreen() {
  const router = useRouter();
  const { addTransaction } = useTransactions();
  const { isAuthenticated } = useAccount();
  const createRequest = trpc.requests.create.useMutation();
  const [step, setStep] = useState(0);
  const [beneficiaryType, setBeneficiaryType] = useState<BeneficiaryType>("individual");
  const [serviceType, setServiceType] = useState("");
  const [agency, setAgency] = useState("");
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [city, setCity] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TransactionPriority>("normal");
  const [description, setDescription] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  const stepTitle = useMemo(() => ["نوع المستفيد", "الخدمة والجهة", "بيانات الطلب", "مراجعة وإرسال"][step], [step]);

  function validateCurrentStep() {
    if (step === 1 && (!serviceType || !agency)) return "اختر نوع الخدمة والجهة المرتبطة بالطلب.";
    if (step === 2 && (!title.trim() || !customerName.trim() || !customerPhone.trim())) return "أدخل عنوان الطلب واسم المستفيد ورقم الجوال.";
    if (step === 2 && dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return "اكتب الموعد بالصيغة YYYY-MM-DD، مثل 2026-08-15.";
    if (step === 3 && (!acceptedTerms || !acceptedPrivacy)) return "يلزم قبول الشروط وسياسة الخصوصية قبل إرسال الطلب.";
    return undefined;
  }

  async function continueFlow() {
    const validationMessage = validateCurrentStep();
    if (validationMessage) {
      Alert.alert("تحقق من البيانات", validationMessage);
      return;
    }
    if (step < 3) {
      setStep((current) => current + 1);
      return;
    }

    if (!isAuthenticated) {
      Alert.alert("تسجيل الدخول مطلوب", "سجّل الدخول أولاً لحفظ الطلب ومتابعته عبر أجهزتك.", [{ text: "لاحقاً", style: "cancel" }, { text: "تسجيل الدخول", onPress: () => router.push("/account" as never) }]);
      return;
    }

    try {
      const request = await createRequest.mutateAsync({
        beneficiaryType,
        title: title.trim(),
        description: [description.trim(), `الخدمة: ${serviceType}`, `الجهة المرجعية: ${agency}`, reference.trim() ? `المرجع: ${reference.trim()}` : ""].filter(Boolean).join("\n"),
        customerPhone: customerPhone.trim(),
        city: city.trim() || undefined,
        priority,
        desiredDueAt: dueDate ? new Date(`${dueDate}T12:00:00`) : undefined,
      });
      const transaction = await addTransaction({
        title: title.trim(),
        agency,
        reference: request.requestNumber,
        status: "received",
        beneficiaryType,
        serviceType,
        priority,
        city: city.trim() || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        dueDate: dueDate || undefined,
        notes: description.trim() || undefined,
        nextAction: "تم استلام الطلب. سيُراجع فريق أبو مشعل البيانات ويرسل لك التحديث التالي.",
      });
      router.replace({ pathname: "/transaction/[id]", params: { id: transaction.id } });
    } catch {
      Alert.alert("تعذر إرسال الطلب", "تم الاحتفاظ بالبيانات داخل النموذج. تحقق من الاتصال ثم أعد المحاولة.");
    }
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.nav}>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><Ionicons name="close" size={23} color="#17382F" /></Pressable>
            <View style={styles.navCopy}><Text style={styles.brand}>أبو مشعل</Text><Text style={styles.title}>طلب جديد</Text></View>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressRow}>{[0, 1, 2, 3].map((item) => <View key={item} style={[styles.progressSegment, item <= step && styles.progressSegmentActive]} />)}</View>
            <Text style={styles.progressText}>الخطوة {step + 1} من 4 · {stepTitle}</Text>
          </View>

          {step === 0 && <ChoiceStep title="لمن تُقدَّم الخدمة؟" description="حدد صفة المستفيد لتجهيز طلب ملائم." options={beneficiaryOptions} value={beneficiaryType} onChange={setBeneficiaryType} />}
          {step === 1 && <>
            <ChoiceStep title="ما نوع الخدمة؟" description="اختر ما تريد أن يساعدك أبو مشعل في متابعته." options={serviceOptions.map((label) => ({ value: label, label }))} value={serviceType} onChange={setServiceType} />
            <ChoiceStep title="ما الجهة المرتبطة؟" description="اختر جهة مرجعية؛ المنصة مستقلة ولا تمثل هذه الجهة." options={agencyOptions.map((label) => ({ value: label, label }))} value={agency} onChange={setAgency} />
          </>}
          {step === 2 && <>
            <FormField label="عنوان الطلب" value={title} onChangeText={setTitle} placeholder="مثال: متابعة تجديد رخصة" required />
            <FormField label="اسم المستفيد" value={customerName} onChangeText={setCustomerName} placeholder="الاسم كما تفضّل ظهوره" required />
            <FormField label="رقم الجوال" value={customerPhone} onChangeText={setCustomerPhone} placeholder="05xxxxxxxx" keyboardType="phone-pad" required />
            <FormField label="رقم المعاملة أو المرجع" value={reference} onChangeText={setReference} placeholder="إن وجد" />
            <FormField label="المدينة أو الفرع" value={city} onChangeText={setCity} placeholder="اختياري" />
            <FormField label="الموعد المطلوب" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
            <Text style={styles.fieldLabel}>الأولوية</Text>
            <View style={styles.chips}>{priorities.map((item) => <Pressable key={item.value} onPress={() => setPriority(item.value)} style={({ pressed }) => [styles.chip, priority === item.value && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipText, priority === item.value && styles.chipTextActive]}>{item.label}</Text></Pressable>)}</View>
            <Text style={styles.fieldLabel}>وصف مختصر</Text>
            <TextInput value={description} onChangeText={setDescription} multiline placeholder="اشرح المطلوب أو الإجراء السابق بإيجاز" placeholderTextColor="#93A39C" style={[styles.input, styles.notes]} textAlign="right" />
          </>}
          {step === 3 && <>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewTitle}>راجع طلبك قبل الإرسال</Text>
              <ReviewRow label="المستفيد" value={`${beneficiaryOptions.find((item) => item.value === beneficiaryType)?.label} · ${customerName}`} />
              <ReviewRow label="الخدمة" value={serviceType} />
              <ReviewRow label="الجهة" value={agency} />
              <ReviewRow label="الإجراء التالي" value="يراجع فريق أبو مشعل الطلب ويرسل لك تحديثاً." />
            </View>
            <Pressable onPress={() => setAcceptedTerms((value) => !value)} style={({ pressed }) => [styles.agreement, pressed && styles.pressed]}>
              <Ionicons name={acceptedTerms ? "checkbox" : "square-outline"} size={23} color={acceptedTerms ? "#0B5D45" : "#66756E"} />
              <Text style={styles.agreementText}>أقر بصحة البيانات وأوافق على شروط استخدام منصة أبو مشعل المستقلة.</Text>
            </Pressable>
            <Pressable onPress={() => setAcceptedPrivacy((value) => !value)} style={({ pressed }) => [styles.agreement, pressed && styles.pressed]}>
              <Ionicons name={acceptedPrivacy ? "checkbox" : "square-outline"} size={23} color={acceptedPrivacy ? "#0B5D45" : "#66756E"} />
              <Text style={styles.agreementText}>أوافق على سياسة الخصوصية، وأفهم أن المتطلبات النهائية تحددها الجهة الحكومية المختصة.</Text>
            </Pressable>
          </>}

          <View style={styles.footer}>
            {step > 0 && <Pressable onPress={() => setStep((current) => current - 1)} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Text style={styles.backText}>السابق</Text></Pressable>}
            <Pressable disabled={createRequest.isPending} onPress={continueFlow} style={({ pressed }) => [styles.nextButton, createRequest.isPending && styles.disabled, pressed && styles.nextPressed]}><Text style={styles.nextText}>{createRequest.isPending ? "جارٍ الإرسال..." : step === 3 ? "إرسال الطلب" : "متابعة"}</Text><Ionicons name={step === 3 ? "send" : "arrow-back"} size={18} color="#FFFFFF" /></Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function ChoiceStep<T extends string>({ title, description, options, value, onChange }: { title: string; description: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View style={styles.stepSection}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepDescription}>{description}</Text><View style={styles.choiceList}>{options.map((option) => <Pressable key={option.value} onPress={() => onChange(option.value)} style={({ pressed }) => [styles.choice, value === option.value && styles.choiceActive, pressed && styles.pressed]}><Ionicons name={value === option.value ? "checkmark-circle" : "ellipse-outline"} size={21} color={value === option.value ? "#0B5D45" : "#96A69E"} /><Text style={[styles.choiceText, value === option.value && styles.choiceTextActive]}>{option.label}</Text></Pressable>)}</View></View>;
}

function FormField({ label, required, ...props }: { label: string; required?: boolean } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}{required ? " *" : ""}</Text><TextInput {...props} placeholderTextColor="#93A39C" style={styles.input} textAlign="right" /></View>;
}

function ReviewRow({ label, value }: { label: string; value: string | undefined }) {
  return <View style={styles.reviewRow}><Text style={styles.reviewValue}>{value || "غير محدد"}</Text><Text style={styles.reviewLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 20, paddingBottom: 32 }, nav: { alignItems: "center", flexDirection: "row-reverse", gap: 12, marginBottom: 20 }, closeButton: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, navCopy: { alignItems: "flex-end", flex: 1 }, brand: { color: "#0B5D45", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, title: { color: "#17382F", fontSize: 22, fontWeight: "800", marginTop: 2, writingDirection: "rtl" }, progressCard: { backgroundColor: "#F3F8F4", borderColor: "#D9E8DD", borderRadius: 16, borderWidth: 1, marginBottom: 24, padding: 14 }, progressRow: { flexDirection: "row-reverse", gap: 6 }, progressSegment: { backgroundColor: "#D8E5DD", borderRadius: 99, flex: 1, height: 5 }, progressSegmentActive: { backgroundColor: "#0B5D45" }, progressText: { color: "#557267", fontSize: 12, fontWeight: "700", marginTop: 9, textAlign: "right", writingDirection: "rtl" }, stepSection: { marginBottom: 24 }, stepTitle: { color: "#17382F", fontSize: 19, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, stepDescription: { color: "#66756E", fontSize: 13, lineHeight: 20, marginTop: 5, textAlign: "right", writingDirection: "rtl" }, choiceList: { gap: 10, marginTop: 16 }, choice: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8E2", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 10, minHeight: 54, paddingHorizontal: 14 }, choiceActive: { backgroundColor: "#F2FAF5", borderColor: "#0B5D45" }, choiceText: { color: "#43544C", fontSize: 14, fontWeight: "700", writingDirection: "rtl" }, choiceTextActive: { color: "#0B5D45" }, field: { marginBottom: 17 }, fieldLabel: { color: "#344D42", fontSize: 13, fontWeight: "800", marginBottom: 8, textAlign: "right", writingDirection: "rtl" }, input: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 14, borderWidth: 1, color: "#17382F", fontSize: 15, minHeight: 52, paddingHorizontal: 14, writingDirection: "rtl" }, notes: { minHeight: 108, paddingTop: 13, textAlignVertical: "top" }, chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 20 }, chip: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 }, chipActive: { backgroundColor: "#E9F5EC", borderColor: "#0B5D45" }, chipText: { color: "#66756E", fontSize: 12, fontWeight: "700", writingDirection: "rtl" }, chipTextActive: { color: "#0B5D45" }, reviewCard: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 18, borderWidth: 1, padding: 16 }, reviewTitle: { color: "#17382F", fontSize: 16, fontWeight: "800", marginBottom: 12, textAlign: "right", writingDirection: "rtl" }, reviewRow: { borderTopColor: "#EDF1ED", borderTopWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 11 }, reviewLabel: { color: "#66756E", fontSize: 12, writingDirection: "rtl" }, reviewValue: { color: "#30493E", flex: 1, fontSize: 12, fontWeight: "700", textAlign: "right", writingDirection: "rtl" }, agreement: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 10, marginTop: 18 }, agreementText: { color: "#50665B", flex: 1, fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" }, footer: { flexDirection: "row-reverse", gap: 10, marginTop: 28 }, nextButton: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 15, flex: 1, flexDirection: "row-reverse", gap: 7, justifyContent: "center", minHeight: 53 }, nextText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", writingDirection: "rtl" }, backButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#CFE0D4", borderRadius: 15, borderWidth: 1, justifyContent: "center", minWidth: 92 }, backText: { color: "#0B5D45", fontSize: 14, fontWeight: "800", writingDirection: "rtl" }, pressed: { opacity: 0.72 }, nextPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] }, disabled: { opacity: 0.55 },
});
