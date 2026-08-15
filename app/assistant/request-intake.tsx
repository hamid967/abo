import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text, AppTextInput as TextInput } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { useLocale } from "@/lib/locale-provider";
import { type BeneficiaryType, type TransactionPriority } from "@/lib/transactions";
import { useTransactions } from "@/lib/transactions-provider";
import { trpc } from "@/lib/trpc";

type IntakeStage = "service" | "agency" | "title" | "description";
type ChatMessage = { id: string; role: "assistant" | "user"; text: string };

const stages: IntakeStage[] = ["service", "agency", "title", "description"];
const beneficiaryOptions: { value: BeneficiaryType; label: string }[] = [
  { value: "individual", label: "فرد" }, { value: "establishment", label: "مؤسسة" }, { value: "company", label: "شركة" }, { value: "association", label: "جمعية" }, { value: "nonprofit", label: "جهة غير ربحية" }, { value: "representative", label: "وكيل عن مستفيد" },
];
const priorityOptions: { value: TransactionPriority; label: string }[] = [{ value: "low", label: "منخفضة" }, { value: "normal", label: "عادية" }, { value: "high", label: "عالية" }, { value: "urgent", label: "عاجلة" }];

export default function RequestIntakeChatScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAccount();
  const { isArabic, locale, direction } = useLocale();
  const { addTransaction } = useTransactions();
  const guide = trpc.assistant.intakeGuide.useMutation();
  const createRequest = trpc.requests.create.useMutation();
  const [stageIndex, setStageIndex] = useState(0);
  const [input, setInput] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [agency, setAgency] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [beneficiaryType, setBeneficiaryType] = useState<BeneficiaryType>("individual");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [city, setCity] = useState("");
  const [priority, setPriority] = useState<TransactionPriority>("normal");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  const copy = isArabic ? {
    title: "تعبئة طلب عبر المحادثة", subtitle: "سنرتّب بياناتك خطوة بخطوة ثم تعرضها للمراجعة قبل الإرسال.", notice: "لا تكتب رقم الهوية أو كلمة المرور أو رمز التحقق أو بيانات البطاقة. أبو مشعل منصة مستقلة ولا يضمن قبول أي جهة للطلب.", signIn: "سجّل الدخول أولاً لحفظ الطلب ومتابعته.", type: "اكتب إجابتك هنا…", send: "إرسال", review: "مراجعة الطلب", submit: "إرسال الطلب", sending: "جارٍ الإرسال…", restart: "بدء مسودة جديدة", details: "بيانات التواصل والمراجعة", name: "اسم المستفيد", phone: "رقم الجوال", city: "المدينة أو الفرع (اختياري)", beneficiary: "صفة المستفيد", priority: "الأولوية", terms: "أقر بصحة البيانات وأوافق على شروط استخدام منصة أبو مشعل المستقلة.", privacy: "أوافق على سياسة الخصوصية وأفهم أن المتطلبات النهائية تحددها الجهة الحكومية المختصة.", edit: "تعديل الإجابات", missing: "أكمل اسم المستفيد ورقم الجوال، ثم وافق على الشروط والخصوصية قبل الإرسال.", failed: "تعذر التواصل مع المساعد الآن. يمكنك متابعة التعبئة أو المحاولة لاحقاً.", requestFailed: "تعذر إرسال الطلب. احتفظنا بالمسودة داخل الشاشة؛ تحقق من الاتصال ثم أعد المحاولة.", complete: "اكتملت إجابات المحادثة. راجع بيانات التواصل والموافقة قبل إنشاء الطلب.", prompts: { service: "ما نوع الخدمة التي تريد متابعتها أو تقديم طلب بشأنها؟", agency: "ما الجهة المرجعية المرتبطة بالطلب؟ يمكنك كتابة «جهة أخرى» عند عدم توفرها.", title: "اكتب عنواناً قصيراً وواضحاً للطلب، مثل: متابعة تجديد رخصة.", description: "اشرح المطلوب أو ما تم سابقاً بإيجاز، من دون أي بيانات حساسة." }, quickService: ["متابعة معاملة", "تقديم طلب جديد", "تجديد ترخيص أو وثيقة", "تحديث أو تصحيح بيانات", "حجز موعد"], quickAgency: ["وزارة الداخلية", "الجوازات", "الأحوال المدنية", "المرور", "وزارة التجارة", "جهة أخرى"]
  } : {
    title: "Fill a request by chat", subtitle: "We will organise the request step by step and show a review before submission.", notice: "Do not enter an ID number, password, verification code, or card details. Abu Mishal is independent and cannot guarantee acceptance by any authority.", signIn: "Sign in first to save and track the request.", type: "Type your answer…", send: "Send", review: "Review request", submit: "Submit request", sending: "Submitting…", restart: "Start a new draft", details: "Contact details and review", name: "Beneficiary name", phone: "Mobile number", city: "City or branch (optional)", beneficiary: "Beneficiary type", priority: "Priority", terms: "I confirm the data is accurate and accept the independent Abu Mishal platform terms.", privacy: "I accept the privacy policy and understand final requirements are set by the relevant authority.", edit: "Edit answers", missing: "Add the beneficiary name and mobile number, then accept the terms and privacy policy before submitting.", failed: "The assistant is unavailable right now. You can continue the form or try again later.", requestFailed: "The request could not be submitted. Keep this draft open, check the connection, and try again.", complete: "The chat answers are complete. Review contact details and consent before creating the request.", prompts: { service: "What type of service would you like to track or request?", agency: "Which reference authority is related to this request? You may enter “Other authority”.", title: "Write a clear, short request title, for example: License renewal follow-up.", description: "Briefly explain what you need or what happened previously, without sensitive data." }, quickService: ["Transaction follow-up", "New request", "License or document renewal", "Data update or correction", "Appointment booking"], quickAgency: ["Ministry of Interior", "Passports", "Civil Affairs", "Traffic", "Ministry of Commerce", "Other authority"]
  };

  const initialMessages = useMemo<ChatMessage[]>(() => [{ id: "intro", role: "assistant", text: copy.prompts.service }], [copy.prompts.service]);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const stage = stages[stageIndex];
  const reviewing = stageIndex >= stages.length;
  const context = { serviceType, agency, title, description };

  const assignStageValue = (value: string) => {
    if (stage === "service") setServiceType(value);
    if (stage === "agency") setAgency(value);
    if (stage === "title") setTitle(value);
    if (stage === "description") setDescription(value);
  };

  const sendAnswer = async (quickValue?: string) => {
    const value = (quickValue ?? input).trim();
    if (!value || !stage || guide.isPending) return;
    setInput("");
    assignStageValue(value);
    const messageId = `${Date.now()}`;
    setMessages((current) => [...current, { id: `${messageId}-user`, role: "user", text: value }]);
    try {
      const nextContext = { ...context, [stage === "service" ? "serviceType" : stage]: value };
      const response = await guide.mutateAsync({ message: value, stage, language: locale, context: nextContext });
      const nextStage = stages[stageIndex + 1];
      setMessages((current) => [...current, { id: `${messageId}-reply`, role: "assistant", text: response.tip ? `${response.reply}\n\n${response.tip}` : response.reply }, { id: `${messageId}-next`, role: "assistant", text: nextStage ? copy.prompts[nextStage] : copy.complete }]);
    } catch {
      setMessages((current) => [...current, { id: `${messageId}-error`, role: "assistant", text: copy.failed }]);
    } finally {
      setStageIndex((current) => Math.min(current + 1, stages.length));
    }
  };

  const submit = async () => {
    if (!customerName.trim() || !customerPhone.trim() || !acceptedTerms || !acceptedPrivacy) { Alert.alert(copy.review, copy.missing); return; }
    try {
      const request = await createRequest.mutateAsync({ beneficiaryType, title: title.trim(), description: [`${isArabic ? "الخدمة" : "Service"}: ${serviceType}`, `${isArabic ? "الجهة المرجعية" : "Reference authority"}: ${agency}`, description.trim()].filter(Boolean).join("\n"), customerPhone: customerPhone.trim(), city: city.trim() || undefined, priority });
      const transaction = await addTransaction({ title: title.trim(), agency, reference: request.requestNumber, status: "received", beneficiaryType, serviceType, priority, city: city.trim() || undefined, customerName: customerName.trim(), customerPhone: customerPhone.trim(), notes: description.trim() || undefined, nextAction: isArabic ? "تم استلام الطلب. سيراجع فريق أبو مشعل البيانات ويرسل لك التحديث التالي." : "The request was received. Abu Mishal will review the data and send the next update." });
      router.replace({ pathname: "/transaction/[id]", params: { id: transaction.id } });
    } catch { Alert.alert(copy.review, copy.requestFailed); }
  };

  const restart = () => {
    setStageIndex(0); setInput(""); setServiceType(""); setAgency(""); setTitle(""); setDescription(""); setCustomerName(""); setCustomerPhone(""); setCity(""); setPriority("normal"); setBeneficiaryType("individual"); setAcceptedTerms(false); setAcceptedPrivacy(false); setMessages([{ id: `${Date.now()}-restart`, role: "assistant", text: copy.prompts.service }]);
  };

  if (!isAuthenticated) return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.locked}><Ionicons name="lock-closed-outline" size={34} color="#0B5D45" /><Text style={[styles.lockedText, { writingDirection: direction }]}>{copy.signIn}</Text><Pressable onPress={() => router.push("/account" as never)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{isArabic ? "تسجيل الدخول" : "Sign in"}</Text></Pressable></View></ScreenContainer>;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}><View style={styles.container}>
    <View style={[styles.header, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Pressable onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><Text style={[styles.title, { writingDirection: direction }]}>{copy.title}</Text><Text style={[styles.subtitle, { writingDirection: direction }]}>{copy.subtitle}</Text></View></View>
    <View style={[styles.notice, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Ionicons name="shield-checkmark-outline" size={17} color="#49665B" /><Text style={[styles.noticeText, { writingDirection: direction }]}>{copy.notice}</Text></View>
    <View style={styles.progress}><View style={styles.progressRow}>{stages.map((item, index) => <View key={item} style={[styles.progressSegment, index <= stageIndex && styles.progressActive]} />)}</View><Text style={[styles.progressText, { writingDirection: direction }]}>{reviewing ? copy.review : `${stageIndex + 1}/${stages.length}`}</Text></View>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {messages.map((message) => <View key={message.id} style={[styles.message, message.role === "user" ? styles.userMessage : styles.assistantMessage]}><Text style={[styles.messageText, message.role === "assistant" && styles.assistantText, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{message.text}</Text></View>)}
      {!reviewing && !guide.isPending && (stage === "service" || stage === "agency") ? <View style={[styles.quickList, { alignItems: isArabic ? "flex-end" : "flex-start" }]}>{(stage === "service" ? copy.quickService : copy.quickAgency).map((item) => <Pressable key={item} onPress={() => void sendAnswer(item)} style={styles.quick}><Text style={[styles.quickText, { writingDirection: direction }]}>{item}</Text></Pressable>)}</View> : null}
      {guide.isPending ? <View style={[styles.typing, { flexDirection: isArabic ? "row-reverse" : "row" }]}><ActivityIndicator size="small" color="#0B5D45" /><Text style={[styles.typingText, { writingDirection: direction }]}>{isArabic ? "المساعد يرتب مسودتك…" : "The assistant is organising your draft…"}</Text></View> : null}
      {reviewing ? <View style={styles.reviewCard}><Text style={[styles.reviewTitle, { writingDirection: direction }]}>{copy.details}</Text><ReviewRow label={isArabic ? "الخدمة" : "Service"} value={serviceType} direction={direction} /><ReviewRow label={isArabic ? "الجهة" : "Authority"} value={agency} direction={direction} /><ReviewRow label={isArabic ? "العنوان" : "Title"} value={title} direction={direction} /><ReviewRow label={isArabic ? "الوصف" : "Description"} value={description} direction={direction} /><Field label={copy.name} value={customerName} onChangeText={setCustomerName} direction={direction} /><Field label={copy.phone} value={customerPhone} onChangeText={setCustomerPhone} direction={direction} keyboardType="phone-pad" /><Field label={copy.city} value={city} onChangeText={setCity} direction={direction} /><Text style={[styles.fieldLabel, { writingDirection: direction }]}>{copy.beneficiary}</Text><View style={styles.chips}>{beneficiaryOptions.map((item) => <Chip key={item.value} label={item.label} selected={beneficiaryType === item.value} onPress={() => setBeneficiaryType(item.value)} />)}</View><Text style={[styles.fieldLabel, { writingDirection: direction }]}>{copy.priority}</Text><View style={styles.chips}>{priorityOptions.map((item) => <Chip key={item.value} label={item.label} selected={priority === item.value} onPress={() => setPriority(item.value)} />)}</View><Agreement label={copy.terms} checked={acceptedTerms} onPress={() => setAcceptedTerms((value) => !value)} direction={direction} /><Agreement label={copy.privacy} checked={acceptedPrivacy} onPress={() => setAcceptedPrivacy((value) => !value)} direction={direction} /><View style={styles.reviewActions}><Pressable onPress={() => setStageIndex(0)} style={styles.secondaryButton}><Text style={styles.secondaryText}>{copy.edit}</Text></Pressable><Pressable disabled={createRequest.isPending} onPress={() => void submit()} style={[styles.primaryButton, createRequest.isPending && styles.disabled]}><Text style={styles.primaryButtonText}>{createRequest.isPending ? copy.sending : copy.submit}</Text></Pressable></View></View> : null}
    </ScrollView>
    {!reviewing ? <View style={[styles.composer, { flexDirection: isArabic ? "row-reverse" : "row" }]}><TextInput value={input} onChangeText={setInput} multiline placeholder={copy.type} placeholderTextColor="#93A39C" style={[styles.input, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]} /><Pressable disabled={guide.isPending} onPress={() => void sendAnswer()} style={[styles.send, guide.isPending && styles.disabled]}><Ionicons name="send" size={18} color="#FFFFFF" /></Pressable></View> : null}
    <Pressable onPress={restart} style={styles.restart}><Ionicons name="refresh-outline" size={15} color="#0B5D45" /><Text style={[styles.restartText, { writingDirection: direction }]}>{copy.restart}</Text></Pressable>
  </View></KeyboardAvoidingView></ScreenContainer>;
}

function Field({ label, direction, ...props }: { label: string; direction: "rtl" | "ltr" } & React.ComponentProps<typeof TextInput>) { return <View style={styles.field}><Text style={[styles.fieldLabel, { writingDirection: direction }]}>{label}</Text><TextInput {...props} placeholderTextColor="#93A39C" style={[styles.fieldInput, { writingDirection: direction, textAlign: direction === "rtl" ? "right" : "left" }]} /></View>; }
function ReviewRow({ label, value, direction }: { label: string; value: string; direction: "rtl" | "ltr" }) { return <View style={styles.reviewRow}><Text style={[styles.reviewValue, { writingDirection: direction, textAlign: direction === "rtl" ? "right" : "left" }]}>{value}</Text><Text style={[styles.reviewLabel, { writingDirection: direction }]}>{label}</Text></View>; }
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; }
function Agreement({ label, checked, onPress, direction }: { label: string; checked: boolean; onPress: () => void; direction: "rtl" | "ltr" }) { return <Pressable onPress={onPress} style={[styles.agreement, { flexDirection: direction === "rtl" ? "row-reverse" : "row" }]}><Ionicons name={checked ? "checkbox" : "square-outline"} size={22} color={checked ? "#0B5D45" : "#66756E"} /><Text style={[styles.agreementText, { writingDirection: direction, textAlign: direction === "rtl" ? "right" : "left" }]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, container: { flex: 1, padding: 20 }, header: { alignItems: "center", gap: 12 }, close: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 44, justifyContent: "center", width: 44 }, headerCopy: { alignItems: "flex-end", flex: 1 }, title: { color: "#17382F", fontSize: 21, fontWeight: "800", textAlign: "right" }, subtitle: { color: "#66756E", fontSize: 11, lineHeight: 17, marginTop: 3, textAlign: "right" }, notice: { alignItems: "flex-start", backgroundColor: "#F4F0E6", borderColor: "#E7D9BD", borderRadius: 14, borderWidth: 1, gap: 8, marginTop: 14, padding: 11 }, noticeText: { color: "#49665B", flex: 1, fontSize: 10, lineHeight: 16 }, progress: { marginTop: 14 }, progressRow: { flexDirection: "row-reverse", gap: 6 }, progressSegment: { backgroundColor: "#D8E5DD", borderRadius: 99, flex: 1, height: 5 }, progressActive: { backgroundColor: "#0B5D45" }, progressText: { color: "#557267", fontSize: 10, fontWeight: "800", marginTop: 6, textAlign: "right" }, scroll: { flexGrow: 1, gap: 10, paddingVertical: 15 }, message: { borderRadius: 15, maxWidth: "92%", padding: 12 }, userMessage: { alignSelf: "flex-end", backgroundColor: "#116B57" }, assistantMessage: { alignSelf: "flex-start", backgroundColor: "#F2F8F3", borderColor: "#D7E9DB", borderWidth: 1 }, messageText: { color: "#FFFFFF", fontSize: 13, lineHeight: 21 }, assistantText: { color: "#25463A" }, quickList: { gap: 7 }, quick: { backgroundColor: "#FFFFFF", borderColor: "#CFE1D4", borderRadius: 999, borderWidth: 1, minHeight: 42, paddingHorizontal: 13, justifyContent: "center" }, quickText: { color: "#0B5D45", fontSize: 11, fontWeight: "800" }, typing: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#F2F8F3", borderRadius: 13, gap: 8, padding: 10 }, typingText: { color: "#49665B", fontSize: 11, fontWeight: "700" }, composer: { alignItems: "flex-end", backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 16, borderWidth: 1, gap: 8, minHeight: 62, padding: 8 }, input: { color: "#17382F", flex: 1, fontSize: 13, maxHeight: 94, paddingHorizontal: 5, textAlignVertical: "center" }, send: { alignItems: "center", backgroundColor: "#116B57", borderRadius: 11, height: 44, justifyContent: "center", width: 44 }, reviewCard: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 18, borderWidth: 1, padding: 14 }, reviewTitle: { color: "#17382F", fontSize: 15, fontWeight: "800", marginBottom: 9, textAlign: "right" }, reviewRow: { borderTopColor: "#EDF1ED", borderTopWidth: 1, flexDirection: "row-reverse", gap: 12, justifyContent: "space-between", paddingVertical: 9 }, reviewLabel: { color: "#66756E", fontSize: 11 }, reviewValue: { color: "#30493E", flex: 1, fontSize: 11, fontWeight: "700" }, field: { marginTop: 13 }, fieldLabel: { color: "#344D42", fontSize: 12, fontWeight: "800", marginBottom: 6, textAlign: "right" }, fieldInput: { backgroundColor: "#F9FBF9", borderColor: "#DCE7DE", borderRadius: 12, borderWidth: 1, color: "#17382F", fontSize: 13, minHeight: 46, paddingHorizontal: 11 }, chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }, chip: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 }, chipSelected: { backgroundColor: "#E9F5EC", borderColor: "#0B5D45" }, chipText: { color: "#66756E", fontSize: 10, fontWeight: "700" }, chipTextSelected: { color: "#0B5D45" }, agreement: { alignItems: "flex-start", gap: 8, marginTop: 14 }, agreementText: { color: "#50665B", flex: 1, fontSize: 11, lineHeight: 17 }, reviewActions: { flexDirection: "row-reverse", gap: 8, marginTop: 18 }, primaryButton: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 13, flex: 1, justifyContent: "center", minHeight: 46, paddingHorizontal: 12 }, primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, secondaryButton: { alignItems: "center", borderColor: "#CFE0D4", borderRadius: 13, borderWidth: 1, justifyContent: "center", minHeight: 46, paddingHorizontal: 11 }, secondaryText: { color: "#0B5D45", fontSize: 12, fontWeight: "800" }, restart: { alignItems: "center", alignSelf: "center", flexDirection: "row-reverse", gap: 5, marginTop: 8, minHeight: 40, paddingHorizontal: 8 }, restartText: { color: "#0B5D45", fontSize: 11, fontWeight: "800" }, locked: { alignItems: "center", flex: 1, justifyContent: "center", padding: 28 }, lockedText: { color: "#49665B", fontSize: 14, lineHeight: 22, marginTop: 12, textAlign: "center" }, disabled: { opacity: 0.55 },
});
