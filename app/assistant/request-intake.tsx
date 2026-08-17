import Ionicons from "@expo/vector-icons/Ionicons";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { PlaybookJourney } from "@/components/playbook-journey";
import { AppText as Text, AppTextInput as TextInput } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { useLocale } from "@/lib/locale-provider";
import { trpc } from "@/lib/trpc";

type ChatLine = { id: string; role: "assistant" | "user"; text: string };
type DraftData = Record<string, unknown>;
type EditableField = "beneficiaryType" | "serviceName" | "entityName" | "title" | "description" | "city" | "branch" | "priority" | "requestedDate" | "beneficiaryName" | "phoneNumber" | "email";
type ValidationItem = { code: string; severity: "error" | "warning" | "info" | "passed"; field?: string; messageAr: string; messageEn: string };
const draftFieldDefinitions: { key: EditableField; ar: string; en: string }[] = [
  { key: "beneficiaryType", ar: "صفة المستفيد", en: "Beneficiary type" }, { key: "beneficiaryName", ar: "اسم المستفيد", en: "Beneficiary name" }, { key: "serviceName", ar: "الخدمة", en: "Service" }, { key: "entityName", ar: "الجهة", en: "Entity" }, { key: "title", ar: "عنوان الطلب", en: "Title" }, { key: "description", ar: "الوصف", en: "Description" }, { key: "city", ar: "المدينة", en: "City" }, { key: "branch", ar: "الفرع", en: "Branch" }, { key: "priority", ar: "الأولوية", en: "Priority" }, { key: "requestedDate", ar: "الموعد المطلوب", en: "Requested date" }, { key: "phoneNumber", ar: "رقم الجوال", en: "Mobile" }, { key: "email", ar: "البريد الإلكتروني", en: "Email" },
];

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export default function RequestIntakeChatScreen() {
  const router = useRouter();
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const { isAuthenticated } = useAccount();
  const { isArabic, locale, direction } = useLocale();
  const start = trpc.executiveAssistant.start.useMutation();
  const send = trpc.executiveAssistant.sendMessage.useMutation();
  const updateDraft = trpc.executiveAssistant.updateDraft.useMutation();
  const validateDraft = trpc.executiveAssistant.validateDraft.useMutation();
  const prepareReview = trpc.executiveAssistant.prepareReview.useMutation();
  const recordConsent = trpc.executiveAssistant.recordConsent.useMutation();
  const submitDraft = trpc.executiveAssistant.submitDraft.useMutation();
  const handoff = trpc.executiveAssistant.requestHumanHandoff.useMutation();
  const uploadDocument = trpc.documents.upload.useMutation();
  const attachDocument = trpc.executiveAssistant.attachDocument.useMutation();
  const removeDocument = trpc.executiveAssistant.removeDocument.useMutation();
  const cancelDraft = trpc.executiveAssistant.cancelDraft.useMutation();
  const deleteConversationData = trpc.executiveAssistant.deleteConversationData.useMutation();
  const transcribeVoice = trpc.voice.transcribeIntake.useMutation();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [draftData, setDraftData] = useState<DraftData>({});
  const [validation, setValidation] = useState<ValidationItem[]>([]);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [submissionConsent, setSubmissionConsent] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ requestId: number; transactionId: number | null; requestNumber?: string } | null>(null);
  const startedKey = useRef(uuid());
  const startAttempted = useRef(false);
  const isTransactionFlow = flow === "transaction";
  const drafts = trpc.executiveAssistant.listDrafts.useQuery(undefined, { enabled: isAuthenticated });
  const detail = trpc.executiveAssistant.detail.useQuery({ conversationId: conversationId ?? "00000000-0000-4000-8000-000000000000" }, { enabled: Boolean(conversationId) });
  const draftDocuments = trpc.executiveAssistant.listDraftDocuments.useQuery({ conversationId: conversationId ?? "00000000-0000-4000-8000-000000000000" }, { enabled: Boolean(conversationId) });
  const serviceId = detail.data?.draft?.serviceId;
  const activePlaybook = trpc.playbooks.activeForService.useQuery({ serviceId: serviceId ?? 0 }, { enabled: Boolean(serviceId) });
  const state = detail.data?.conversation?.currentState;
  const completion = detail.data?.draft?.completionPercentage ?? drafts.data?.[0]?.completionPercentage ?? 0;
  const busy = start.isPending || send.isPending || updateDraft.isPending || validateDraft.isPending || prepareReview.isPending || recordConsent.isPending || submitDraft.isPending || uploadDocument.isPending || attachDocument.isPending || removeDocument.isPending || cancelDraft.isPending || deleteConversationData.isPending || transcribeVoice.isPending;
  const copy = useMemo(() => isArabic ? {
    title: "المساعد التنفيذي للطلبات", subtitle: "أرتّب طلبك خطوة بخطوة، وأوقف قبل الإرسال عشان تراجع وتوافق بوضوح.", notice: "لا ترسل كلمة مرور أو رمز التحقق أو بيانات بطاقة. أبو مشعل منصة مستقلة ولا يمثل جهة حكومية.", signIn: "سجّل دخولك أول عشان نحفظ المسودة ونكملها معك لاحقاً.", placeholder: "اكتب وش تبي تنجز…", welcome: "أهلًا بك، أنا أبو مشعل. أساعدك في تجهيز طلبك خطوة بخطوة. اكتب الخدمة أو المعاملة اللي تبي تتابعها، حتى لو ما تعرف اسمها الرسمي.", wait: "قاعد أرتّب تفاصيل طلبك…", quick: ["أبي أقدم معاملة جديدة", "أبي أتابع معاملة موجودة", "وش المستندات المطلوبة؟", "أبي أحجز موعد", "أبي أرفع مستند", "عندي استفسار أو شكوى", "ما أعرف نوع الخدمة"], error: "ما قدرنا نحفظ الإجراء الحين. بياناتك الموجودة ما راح تضيع؛ جرّب مرة ثانية.", sending: "إرسال", resume: "مسودتك تنحفظ في حسابك تلقائياً.", review: "تحقق واعرض المراجعة", validationTitle: "نتيجة التحقق", confirmationTitle: "راجع ووافق قبل الإرسال", confirm: "تأكيد وإرسال الطلب", consentTerms: "اطلعت على الشروط", consentPrivacy: "اطلعت على سياسة الخصوصية", consentSubmit: "أوافق صراحةً على إنشاء الطلب داخل أبو مشعل", submitted: "تم إنشاء طلبك داخل أبو مشعل", open: "فتح المعاملة", progress: "اكتمال الطلب" } : {
    title: "Executive request assistant", subtitle: "I organise the request step by step and always pause for your review and explicit consent.", notice: "Do not send passwords, verification codes, or card details. Abu Mishal is independent and does not represent a government authority.", signIn: "Sign in first so your draft can be saved and resumed.", placeholder: "Describe what you want to do…", welcome: "Welcome. I am Abu Mishal. Describe the service or transaction you need, even if you do not know its official name.", wait: "Organising your request…", quick: ["Create a new request", "Track an existing transaction", "Show required documents", "Book an appointment", "Upload a document", "Create an inquiry or complaint", "I do not know the service"], error: "The action could not be saved now. Your existing data is safe; try again.", sending: "Send", resume: "Your draft is saved to your account automatically.", review: "Validate and review", validationTitle: "Validation result", confirmationTitle: "Review and consent before submission", confirm: "Confirm and submit request", consentTerms: "I reviewed the terms", consentPrivacy: "I reviewed the privacy policy", consentSubmit: "I explicitly consent to create this request in Abu Mishal", submitted: "Your request was created in Abu Mishal", open: "Open transaction", progress: "Request completion" }, [isArabic]);

  useEffect(() => {
    if (!isAuthenticated || conversationId || drafts.isPending || start.isPending || startAttempted.current) return;
    const saved = drafts.data?.[0];
    if (saved?.conversationId) { setConversationId(saved.conversationId); return; }
    startAttempted.current = true;
    void start.mutateAsync({ language: locale, idempotencyKey: startedKey.current }).then((session) => {
      if (!session.conversation) return;
      setConversationId(session.conversation.id);
      setDraftData(session.draft?.structuredData && typeof session.draft.structuredData === "object" ? session.draft.structuredData as DraftData : {});
      setMessages([{ id: "welcome", role: "assistant", text: isTransactionFlow ? (isArabic ? "هلا بك، بنستلم معاملتك خطوة بخطوة. أول شيء: المعاملة تخص فرد، منشأة، شركة، جمعية، أو تمثيل عن مستفيد؟" : "Welcome. We will collect your transaction step by step. First, is it for an individual, establishment, company, association, or a representative?") : copy.welcome }]);
    }).catch(() => setMessages([{ id: "error", role: "assistant", text: copy.error }]));
  }, [conversationId, copy.error, copy.welcome, drafts.data, drafts.isPending, isAuthenticated, isTransactionFlow, isArabic, locale, start]);

  useEffect(() => {
    if (!detail.data?.conversation || !detail.data.draft) return;
    setDraftData(detail.data.draft.structuredData && typeof detail.data.draft.structuredData === "object" ? detail.data.draft.structuredData as DraftData : {});
    if (detail.data.messages.length) setMessages(detail.data.messages.map((message) => ({ id: message.id, role: message.role === "user" ? "user" : "assistant", text: message.content })));
  }, [detail.data]);

  async function sendMessage(quickValue?: string) {
    const message = (quickValue ?? input).trim();
    if (!message || !conversationId || send.isPending) return;
    setInput("");
    const id = `${Date.now()}`;
    setMessages((current) => [...current, { id: `${id}-user`, role: "user", text: message }]);
    try {
      const response = await send.mutateAsync({ conversationId, message, language: locale });
      if (response.draft?.structuredData && typeof response.draft.structuredData === "object") setDraftData(response.draft.structuredData as DraftData);
      setMessages((current) => [...current, { id: `${id}-assistant`, role: "assistant", text: response.reply }]);
      await detail.refetch();
    } catch { setMessages((current) => [...current, { id: `${id}-error`, role: "assistant", text: copy.error }]); }
  }

  async function toggleVoiceInput() {
    setVoiceError(null);
    try {
      if (recorderState.isRecording) {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        if (!uri) throw new Error("VOICE_RECORDING_UNAVAILABLE");
        const audioFile = new ExpoFile(uri);
        const audioBase64 = await audioFile.base64();
        try { audioFile.delete(); } catch { /* Cache cleanup is best-effort. */ }
        const result = await transcribeVoice.mutateAsync({ audioBase64, mimeType: Platform.OS === "web" ? "audio/webm" : "audio/m4a", language: locale });
        setInput(result.text);
        return;
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setVoiceError(isArabic ? "ما تم السماح للميكروفون. فعّله من إعدادات الجهاز إذا حاب تستخدم الإدخال الصوتي." : "Microphone permission was not granted. Enable it in device settings to use voice input.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      const code = error instanceof Error ? error.message : "VOICE_TRANSCRIPTION_FAILED";
      setVoiceError(isArabic ? (code.includes("TOO_LARGE") ? "المقطع أطول من الحد المسموح. سجّل رسالة أقصر ثم جرّب." : "ما قدرنا نحوّل التسجيل إلى نص. جرّب مرة ثانية أو اكتب رسالتك.") : (code.includes("TOO_LARGE") ? "The recording exceeds the allowed limit. Record a shorter message and try again." : "The recording could not be converted to text. Try again or type your message."));
    }
  }

  async function saveField(field: EditableField, value: string) {
    if (!conversationId || !value.trim()) return;
    const patch = field === "beneficiaryType" ? { beneficiaryType: value as "individual" | "establishment" | "company" | "association" | "nonprofit" | "representative" } : field === "priority" ? { priority: value as "low" | "normal" | "high" | "urgent" } : { [field]: value.trim() };
    const session = await updateDraft.mutateAsync({ conversationId, patch });
    if (session?.draft?.structuredData && typeof session.draft.structuredData === "object") setDraftData(session.draft.structuredData as DraftData);
    setValidation([]);
    setTerms(false); setPrivacy(false); setSubmissionConsent(false);
    await detail.refetch();
  }

  async function reviewDraft() {
    if (!conversationId) return;
    try {
      const result = await validateDraft.mutateAsync({ conversationId });
      setValidation(result.results as ValidationItem[]);
      if (!result.results.some((item) => item.severity === "error")) {
        await prepareReview.mutateAsync({ conversationId });
        await detail.refetch();
      }
    } catch { setMessages((current) => [...current, { id: `${Date.now()}-review-error`, role: "assistant", text: copy.error }]); }
  }

  async function confirmAndSubmit() {
    if (!conversationId || !terms || !privacy || !submissionConsent) return;
    try {
      await Promise.all(["terms", "privacy", "request_submission"].map((consentType) => recordConsent.mutateAsync({ conversationId, consentType: consentType as "terms" | "privacy" | "request_submission" })));
      const result = await submitDraft.mutateAsync({ conversationId, language: locale });
      setSubmitted(result);
      await detail.refetch();
    } catch { setMessages((current) => [...current, { id: `${Date.now()}-submit-error`, role: "assistant", text: copy.error }]); }
  }

  async function requestHandoff() {
    if (!conversationId || handoff.isPending) return;
    try {
      await handoff.mutateAsync({ conversationId, language: locale, reason: isArabic ? "طلب العميل التحويل إلى موظف من المحادثة التنفيذية." : "Customer requested a staff handoff from the executive chat." });
      setMessages((current) => [...current, { id: `${Date.now()}-handoff`, role: "assistant", text: isArabic ? "تم تحويل المحادثة لفريق المتابعة، وبتلقى الردود في مركز الدعم." : "The conversation was handed to the follow-up team. Replies will appear in the support centre." }]);
    } catch { setMessages((current) => [...current, { id: `${Date.now()}-handoff-error`, role: "assistant", text: copy.error }]); }
  }

  async function pickAndAttachDocument() {
    if (!conversationId || busy) return;
    setDocumentError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType;
      const supported = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] as const;
      if (!mimeType || !supported.includes(mimeType as (typeof supported)[number])) throw new Error("UNSUPPORTED_DOCUMENT_TYPE");
      if (!asset.size || asset.size > 5 * 1024 * 1024) throw new Error("DOCUMENT_TOO_LARGE");
      const contentsBase64 = await new ExpoFile(asset.uri).base64();
      const uploaded = await uploadDocument.mutateAsync({ fileName: asset.name, mimeType: mimeType as (typeof supported)[number], fileSizeBytes: asset.size, contentsBase64 });
      await attachDocument.mutateAsync({ conversationId, documentId: uploaded.id });
      await draftDocuments.refetch();
    } catch (error) {
      const code = error instanceof Error ? error.message : "UPLOAD_FAILED";
      setDocumentError(isArabic ? (code.includes("TOO_LARGE") ? "حجم الملف أكبر من 5 ميجابايت." : code.includes("UNSUPPORTED") ? "نوع الملف غير مدعوم. ارفع PDF أو JPG أو PNG أو DOCX." : "ما قدرنا نرفع المستند الحين. جرّب مرة ثانية.") : (code.includes("TOO_LARGE") ? "The file exceeds 5 MB." : code.includes("UNSUPPORTED") ? "Unsupported file type. Use PDF, JPG, PNG, or DOCX." : "The document could not be uploaded. Try again."));
    }
  }

  async function removeAttachedDocument(documentId: number) {
    if (!conversationId || busy) return;
    try { await removeDocument.mutateAsync({ conversationId, documentId }); await draftDocuments.refetch(); }
    catch { setDocumentError(isArabic ? "ما قدرنا نحذف المستند الحين." : "The document could not be removed."); }
  }

  async function startNewDraft() {
    if (!conversationId || busy || state === "submitted") return;
    try {
      await cancelDraft.mutateAsync({ conversationId });
      const session = await start.mutateAsync({ language: locale, idempotencyKey: uuid() });
      if (!session.conversation) return;
      setConversationId(session.conversation.id);
      setDraftData({}); setMessages([{ id: "welcome", role: "assistant", text: copy.welcome }]); setValidation([]); setTerms(false); setPrivacy(false); setSubmissionConsent(false); setSubmitted(null);
      await drafts.refetch();
    } catch { setMessages((current) => [...current, { id: `${Date.now()}-restart-error`, role: "assistant", text: copy.error }]); }
  }

  function confirmDeleteConversation() {
    if (!conversationId || busy) return;
    Alert.alert(isArabic ? "حذف محتوى المحادثة؟" : "Delete conversation content?", isArabic ? "بنحذف الرسائل من حسابك. إذا أرسلت الطلب من قبل، بيبقى سجل الطلب محفوظ حسب السياسة." : "Messages will be deleted from your account. A submitted request remains retained under the applicable policy.", [
      { text: isArabic ? "تراجع" : "Cancel", style: "cancel" },
      { text: isArabic ? "حذف" : "Delete", style: "destructive", onPress: () => void deleteConversationData.mutateAsync({ conversationId }).then(async (result) => { setMessages([]); if (!result.submittedRequestPreserved) { setConversationId(null); setDraftData({}); setValidation([]); startAttempted.current = false; await drafts.refetch(); } else { await detail.refetch(); } }).catch(() => setMessages((current) => [...current, { id: `${Date.now()}-delete-error`, role: "assistant", text: copy.error }])) },
    ]);
  }

  if (!isAuthenticated) return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.locked}><Ionicons name="lock-closed-outline" size={34} color="#0B5D45" /><Text style={[styles.lockedText, { writingDirection: direction }]}>{copy.signIn}</Text><Pressable onPress={() => router.push("/account" as never)} style={styles.primary}><Text style={styles.primaryText}>{isArabic ? "تسجيل الدخول" : "Sign in"}</Text></Pressable></View></ScreenContainer>;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}><View style={styles.container}>
    <View style={[styles.header, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق المساعد" : "Close assistant"} onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><Text style={[styles.title, { writingDirection: direction }]}>{isTransactionFlow ? (isArabic ? "إضافة معاملة عبر المحادثة" : "Add a transaction by chat") : copy.title}</Text><Text style={[styles.subtitle, { writingDirection: direction }]}>{isTransactionFlow ? (isArabic ? "أجمع البيانات الأساسية، أعرض الملخص، ثم أنت توافق قبل الإنشاء." : "I collect the core details, show the summary, then wait for your approval before creation.") : copy.subtitle}</Text></View></View>
    <View style={[styles.notice, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Ionicons name="shield-checkmark-outline" size={17} color="#49665B" /><Text style={[styles.noticeText, { writingDirection: direction }]}>{copy.notice}</Text></View>
    <View style={styles.progressCard}><View style={styles.progressTop}><Text style={styles.progressValue}>{completion}%</Text><Text style={styles.progressLabel}>{copy.progress}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${completion}%` }]} /></View></View>
    {isTransactionFlow ? <TransactionIntakeSteps draft={draftData} isArabic={isArabic} /> : null}
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {activePlaybook.data ? <PlaybookJourney playbook={activePlaybook.data} isArabic={isArabic} direction={direction} /> : null}
      {messages.map((message) => <View key={message.id} style={[styles.message, message.role === "user" ? styles.userMessage : styles.assistantMessage]}><Text style={[styles.messageText, message.role === "assistant" && styles.assistantText, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{message.text}</Text></View>)}
      {!messages.some((message) => message.role === "user") && conversationId ? <View style={[styles.quickList, { alignItems: isArabic ? "flex-end" : "flex-start" }]}>{(isTransactionFlow ? (isArabic ? ["المستفيد فرد", "المستفيد منشأة", "المستفيد شركة"] : ["The beneficiary is an individual", "The beneficiary is an establishment", "The beneficiary is a company"]) : copy.quick).map((item) => <Pressable key={item} onPress={() => void sendMessage(item)} style={styles.quick}><Text style={[styles.quickText, { writingDirection: direction }]}>{item}</Text></Pressable>)}</View> : null}
      {busy ? <View style={[styles.typing, { flexDirection: isArabic ? "row-reverse" : "row" }]}><ActivityIndicator size="small" color="#0B5D45" /><Text style={[styles.typingText, { writingDirection: direction }]}>{copy.wait}</Text></View> : null}
      {conversationId ? <DraftSummary draft={draftData} direction={direction} isArabic={isArabic} saving={updateDraft.isPending} onSave={saveField} /> : null}
      {conversationId ? <DocumentSection documents={draftDocuments.data ?? []} isArabic={isArabic} loading={uploadDocument.isPending || attachDocument.isPending || removeDocument.isPending} error={documentError} onAdd={pickAndAttachDocument} onRemove={removeAttachedDocument} /> : null}
      {validation.length ? <ValidationCard items={validation} isArabic={isArabic} title={copy.validationTitle} /> : null}
      {state !== "awaiting_confirmation" && state !== "submitted" && conversationId ? <Pressable disabled={busy} onPress={() => void reviewDraft()} style={[styles.reviewButton, busy && styles.disabled]}><Ionicons name="checkmark-done-outline" size={18} color="#FFFFFF" /><Text style={styles.primaryText}>{copy.review}</Text></Pressable> : null}
      {state === "awaiting_confirmation" && !submitted ? <View style={styles.confirmCard}><Text style={styles.confirmTitle}>{copy.confirmationTitle}</Text><ConsentRow value={terms} onChange={setTerms} label={copy.consentTerms} /><ConsentRow value={privacy} onChange={setPrivacy} label={copy.consentPrivacy} /><ConsentRow value={submissionConsent} onChange={setSubmissionConsent} label={copy.consentSubmit} /><Pressable disabled={!terms || !privacy || !submissionConsent || busy} onPress={() => void confirmAndSubmit()} style={[styles.reviewButton, (!terms || !privacy || !submissionConsent || busy) && styles.disabled]}><Ionicons name="send-outline" size={18} color="#FFFFFF" /><Text style={styles.primaryText}>{copy.confirm}</Text></Pressable></View> : null}
      {submitted ? <View style={styles.successCard}><Ionicons name="checkmark-circle" size={34} color="#1E8C5A" /><Text style={styles.successTitle}>{copy.submitted}</Text><Text style={styles.successNumber}>{submitted.requestNumber ?? `#${submitted.requestId}`}</Text>{submitted.transactionId ? <Pressable onPress={() => router.replace(`/transaction/${submitted.transactionId}` as never)} style={styles.openButton}><Text style={styles.openText}>{copy.open}</Text></Pressable> : null}</View> : null}
      {conversationId ? <View style={styles.lifecycleCard}><Text style={styles.lifecycleHint}>{isArabic ? "إدارة المسودة وبيانات المحادثة" : "Manage draft and conversation data"}</Text><View style={styles.lifecycleActions}>{state !== "submitted" ? <Pressable disabled={busy} onPress={() => void startNewDraft()} style={[styles.lifecycleButton, busy && styles.disabled]}><Ionicons name="add-circle-outline" size={16} color="#0B5D45" /><Text style={styles.lifecycleText}>{isArabic ? "بدء طلب جديد" : "Start new request"}</Text></Pressable> : null}<Pressable disabled={busy} onPress={confirmDeleteConversation} style={[styles.lifecycleButton, styles.destructiveButton, busy && styles.disabled]}><Ionicons name="trash-outline" size={16} color="#A63D3D" /><Text style={styles.destructiveText}>{isArabic ? "حذف المحادثة" : "Delete conversation"}</Text></Pressable></View></View> : null}
    </ScrollView>
    {!submitted ? <><View style={[styles.composer, { flexDirection: isArabic ? "row-reverse" : "row" }]}><TextInput value={input} onChangeText={setInput} multiline editable={Boolean(conversationId) && !send.isPending && !recorderState.isRecording} placeholder={isTransactionFlow ? (isArabic ? "اكتب إجابتك أو وصف المعاملة…" : "Type your answer or describe the transaction…") : copy.placeholder} placeholderTextColor="#93A39C" style={[styles.input, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]} /><Pressable accessibilityRole="button" accessibilityLabel={recorderState.isRecording ? (isArabic ? "إيقاف التسجيل وتحويله إلى نص" : "Stop recording and transcribe") : (isArabic ? "بدء إدخال صوتي" : "Start voice input")} disabled={!conversationId || transcribeVoice.isPending || (busy && !recorderState.isRecording)} onPress={() => void toggleVoiceInput()} style={[styles.documentAdd, recorderState.isRecording && { backgroundColor: "#A63D3D" }, (!conversationId || transcribeVoice.isPending || (busy && !recorderState.isRecording)) && styles.disabled]}>{transcribeVoice.isPending ? <ActivityIndicator size="small" color="#0B5D45" /> : <Ionicons name={recorderState.isRecording ? "stop" : "mic-outline"} size={19} color={recorderState.isRecording ? "#FFFFFF" : "#0B5D45"} />}</Pressable><Pressable accessibilityLabel={copy.sending} disabled={!conversationId || send.isPending || recorderState.isRecording} onPress={() => void sendMessage()} style={[styles.send, (!conversationId || send.isPending || recorderState.isRecording) && styles.disabled]}><Ionicons name="send" size={18} color="#FFFFFF" /></Pressable></View>{recorderState.isRecording ? <View style={[styles.notice, { flexDirection: isArabic ? "row-reverse" : "row", marginTop: 8 }]}><Ionicons name="radio" size={13} color="#A63D3D" /><Text style={[styles.noticeText, { writingDirection: direction }]}>{isArabic ? "جارٍ التسجيل. اضغط إيقاف لتحويل كلامك إلى نص ومراجعته قبل الإرسال." : "Recording. Tap stop to convert your speech to text for review before sending."}</Text></View> : null}{voiceError ? <Text style={styles.documentError}>{voiceError}</Text> : null}<View style={[styles.footerActions, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Pressable onPress={() => void requestHandoff()} disabled={!conversationId || handoff.isPending} style={[styles.handoff, (!conversationId || handoff.isPending) && styles.disabled]}><Ionicons name="person-outline" size={15} color="#0B5D45" /><Text style={styles.handoffText}>{isArabic ? "التحدث مع موظف" : "Talk to staff"}</Text></Pressable><Text style={[styles.resume, { writingDirection: direction }]}>{copy.resume}</Text></View></> : null}
  </View></KeyboardAvoidingView></ScreenContainer>;
}

function DocumentSection({ documents, isArabic, loading, error, onAdd, onRemove }: { documents: { documentId: number; fileName: string; mimeType: string; fileSizeBytes: number; classificationStatus: string }[]; isArabic: boolean; loading: boolean; error: string | null; onAdd: () => Promise<void>; onRemove: (documentId: number) => Promise<void> }) {
  return <View style={styles.documentCard}><View style={styles.documentHeader}><Pressable accessibilityRole="button" disabled={loading} onPress={() => void onAdd()} style={[styles.documentAdd, loading && styles.disabled]}>{loading ? <ActivityIndicator size="small" color="#0B5D45" /> : <Ionicons name="attach-outline" size={17} color="#0B5D45" />}<Text style={styles.documentAddText}>{isArabic ? "إضافة مستند" : "Add document"}</Text></Pressable><View><Text style={styles.confirmTitle}>{isArabic ? "مستندات الطلب" : "Request documents"}</Text><Text style={styles.documentHint}>{isArabic ? "PDF أو JPG أو PNG أو DOCX — بحد أقصى 5 م.ب" : "PDF, JPG, PNG, or DOCX — up to 5 MB"}</Text></View></View>{documents.length ? documents.map((document) => <View key={document.documentId} style={styles.documentRow}><Pressable accessibilityRole="button" accessibilityLabel={isArabic ? `حذف ${document.fileName}` : `Remove ${document.fileName}`} disabled={loading} onPress={() => void onRemove(document.documentId)} style={styles.removeDocument}><Ionicons name="trash-outline" size={16} color="#A63D3D" /></Pressable><View style={styles.documentCopy}><Text style={styles.documentName} numberOfLines={1}>{document.fileName}</Text><Text style={styles.documentMeta}>{Math.max(1, Math.round(document.fileSizeBytes / 1024))} KB · {isArabic ? "بانتظار التصنيف" : "Pending classification"}</Text></View><Ionicons name="document-text-outline" size={20} color="#0B5D45" /></View>) : <Text style={styles.emptyDocuments}>{isArabic ? "ما أضفت أي مستند للحين." : "No documents added yet."}</Text>}{error ? <Text style={styles.documentError}>{error}</Text> : null}</View>;
}

function ConsentRow({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label: string }) {
  return <View style={styles.consentRow}><Switch value={value} onValueChange={onChange} trackColor={{ false: "#D7E1DA", true: "#9AC8A8" }} thumbColor={value ? "#0B5D45" : "#FFFFFF"} /><Text style={styles.consentText}>{label}</Text></View>;
}

function ValidationCard({ items, isArabic, title }: { items: ValidationItem[]; isArabic: boolean; title: string }) {
  const colors = { error: "#B42318", warning: "#9A5A12", info: "#306A8A", passed: "#1E7A50" };
  return <View style={styles.validationCard}><Text style={styles.confirmTitle}>{title}</Text>{items.map((item, index) => <View key={`${item.code}-${index}`} style={styles.validationRow}><View style={[styles.validationDot, { backgroundColor: colors[item.severity] }]} /><Text style={styles.validationText}>{isArabic ? item.messageAr : item.messageEn}</Text></View>)}</View>;
}

function DraftSummary({ draft, direction, isArabic, saving, onSave }: { draft: DraftData; direction: "rtl" | "ltr"; isArabic: boolean; saving: boolean; onSave: (field: EditableField, value: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<EditableField, string>>(() => Object.fromEntries(draftFieldDefinitions.map((field) => [field.key, String(draft[field.key] ?? "")])) as Record<EditableField, string>);
  useEffect(() => { if (!editing) setValues(Object.fromEntries(draftFieldDefinitions.map((field) => [field.key, String(draft[field.key] ?? "")])) as Record<EditableField, string>); }, [draft, editing]);
  async function save() { for (const field of draftFieldDefinitions) if (values[field.key].trim()) await onSave(field.key, values[field.key]); setEditing(false); }
  return <View style={styles.draftCard}><Text style={[styles.draftHeading, { writingDirection: direction, textAlign: direction === "rtl" ? "right" : "left" }]}>{isArabic ? "ملخص طلبك" : "Your request summary"}</Text><Text style={styles.draftHint}>{isArabic ? "راجع البيانات وعدّلها قبل التحقق النهائي." : "Review and edit the details before final validation."}</Text>{draftFieldDefinitions.map((field) => <View key={field.key} style={styles.draftField}><Text style={styles.draftLabel}>{isArabic ? field.ar : field.en}</Text>{editing ? <TextInput value={values[field.key]} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))} multiline={field.key === "description"} style={styles.draftInput} /> : <Text style={[styles.draftValue, { writingDirection: direction }]}>{values[field.key] || (isArabic ? "ناقص" : "Missing")}</Text>}</View>)}<Pressable onPress={() => editing ? void save() : setEditing(true)} disabled={saving} style={[styles.saveDraft, saving && styles.disabled]}><Text style={styles.saveDraftText}>{editing ? (isArabic ? "حفظ التعديلات" : "Save edits") : (isArabic ? "تعديل الملخص" : "Edit summary")}</Text></Pressable></View>;
}

function TransactionIntakeSteps({ draft, isArabic }: { draft: DraftData; isArabic: boolean }) {
  const fields = isArabic ? [
    ["beneficiaryType", "المستفيد"], ["serviceName", "الخدمة"], ["entityName", "الجهة"], ["title", "عنوان المعاملة"], ["description", "الوصف"], ["beneficiaryName", "اسم المستفيد"], ["phoneNumber", "رقم الجوال"],
  ] : [
    ["beneficiaryType", "Beneficiary"], ["serviceName", "Service"], ["entityName", "Entity"], ["title", "Transaction title"], ["description", "Description"], ["beneficiaryName", "Beneficiary name"], ["phoneNumber", "Mobile"],
  ];
  const complete = fields.filter(([key]) => typeof draft[key] === "string" && String(draft[key]).trim()).length;
  return <View style={styles.intakeSteps}><View style={styles.intakeStepsHeader}><Text style={styles.intakeStepsValue}>{complete}/{fields.length}</Text><Text style={styles.intakeStepsTitle}>{isArabic ? "بيانات الاستلام" : "Intake details"}</Text></View><View style={styles.stepChips}>{fields.map(([key, label]) => <View key={key} style={[styles.stepChip, typeof draft[key] === "string" && String(draft[key]).trim() && styles.stepChipDone]}><Ionicons name={typeof draft[key] === "string" && String(draft[key]).trim() ? "checkmark-circle" : "ellipse-outline"} size={13} color={typeof draft[key] === "string" && String(draft[key]).trim() ? "#1E8C5A" : "#7A8D82"} /><Text style={[styles.stepChipText, typeof draft[key] === "string" && String(draft[key]).trim() && styles.stepChipTextDone]}>{label}</Text></View>)}</View></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, container: { flex: 1, padding: 18 }, header: { alignItems: "center", gap: 12 }, close: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 44, justifyContent: "center", width: 44 }, headerCopy: { alignItems: "flex-end", flex: 1 }, title: { color: "#17382F", fontSize: 20, fontWeight: "800", textAlign: "right" }, subtitle: { color: "#66756E", fontSize: 11, lineHeight: 17, marginTop: 3, textAlign: "right" }, notice: { alignItems: "flex-start", backgroundColor: "#F4F0E6", borderColor: "#E7D9BD", borderRadius: 14, borderWidth: 1, gap: 8, marginTop: 12, padding: 10 }, noticeText: { color: "#49665B", flex: 1, fontSize: 10, lineHeight: 16 }, progressCard: { marginTop: 10 }, progressTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, progressValue: { color: "#0B5D45", fontSize: 11, fontWeight: "800" }, progressLabel: { color: "#49665B", fontSize: 10 }, progressTrack: { backgroundColor: "#E1E9E3", borderRadius: 4, height: 7, marginTop: 5, overflow: "hidden" }, progressFill: { backgroundColor: "#1E8C5A", borderRadius: 4, height: 7 }, intakeSteps: { backgroundColor: "#F7FBF8", borderColor: "#D7E9DB", borderRadius: 14, borderWidth: 1, marginTop: 10, padding: 10 }, intakeStepsHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, intakeStepsTitle: { color: "#25463A", fontSize: 11, fontWeight: "900", writingDirection: "rtl" }, intakeStepsValue: { color: "#0B5D45", fontSize: 11, fontWeight: "900" }, stepChips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 8 }, stepChip: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DFE9E2", borderRadius: 999, borderWidth: 1, flexDirection: "row-reverse", gap: 4, paddingHorizontal: 8, paddingVertical: 5 }, stepChipDone: { backgroundColor: "#EAF6ED", borderColor: "#B9DFC4" }, stepChipText: { color: "#66756E", fontSize: 9, fontWeight: "800", writingDirection: "rtl" }, stepChipTextDone: { color: "#176C47" }, scroll: { flexGrow: 1, gap: 10, paddingVertical: 13 }, message: { borderRadius: 15, maxWidth: "92%", padding: 12 }, userMessage: { alignSelf: "flex-end", backgroundColor: "#116B57" }, assistantMessage: { alignSelf: "flex-start", backgroundColor: "#F2F8F3", borderColor: "#D7E9DB", borderWidth: 1 }, messageText: { color: "#FFFFFF", fontSize: 13, lineHeight: 21 }, assistantText: { color: "#25463A" }, quickList: { gap: 7 }, quick: { backgroundColor: "#FFFFFF", borderColor: "#CFE1D4", borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: 13 }, quickText: { color: "#0B5D45", fontSize: 11, fontWeight: "800" }, typing: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#F2F8F3", borderRadius: 13, gap: 8, padding: 10 }, typingText: { color: "#49665B", fontSize: 11, fontWeight: "700" }, draftCard: { backgroundColor: "#FFFFFF", borderColor: "#CFE1D4", borderRadius: 16, borderWidth: 1, marginTop: 6, padding: 13 }, draftHeading: { color: "#17382F", fontSize: 15, fontWeight: "900" }, draftHint: { color: "#5C7368", fontSize: 10, lineHeight: 15, marginTop: 3 }, draftField: { borderTopColor: "#EDF1ED", borderTopWidth: 1, marginTop: 8, paddingTop: 8 }, draftLabel: { color: "#49665B", fontSize: 10, fontWeight: "800", textAlign: "right" }, draftValue: { color: "#25463A", fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right" }, draftInput: { backgroundColor: "#F9FBF9", borderColor: "#DCE7DE", borderRadius: 10, borderWidth: 1, color: "#17382F", fontSize: 12, marginTop: 4, minHeight: 40, paddingHorizontal: 9, textAlign: "right" }, saveDraft: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 10, justifyContent: "center", marginTop: 10, minHeight: 38 }, saveDraftText: { color: "#0B5D45", fontSize: 11, fontWeight: "800" }, documentCard: { backgroundColor: "#FFFFFF", borderColor: "#CFE1D4", borderRadius: 16, borderWidth: 1, gap: 9, padding: 13 }, documentHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, documentAdd: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 10, flexDirection: "row", gap: 5, minHeight: 38, paddingHorizontal: 10 }, documentAddText: { color: "#0B5D45", fontSize: 10, fontWeight: "800" }, documentHint: { color: "#66756E", fontSize: 9, marginTop: 3, textAlign: "right" }, documentRow: { alignItems: "center", borderTopColor: "#EDF1ED", borderTopWidth: 1, flexDirection: "row", gap: 8, paddingTop: 9 }, documentCopy: { flex: 1 }, documentName: { color: "#25463A", fontSize: 11, fontWeight: "800", textAlign: "right" }, documentMeta: { color: "#74847C", fontSize: 9, marginTop: 2, textAlign: "right" }, removeDocument: { alignItems: "center", height: 34, justifyContent: "center", width: 34 }, emptyDocuments: { color: "#74847C", fontSize: 10, textAlign:
  "right" }, documentError: { color: "#A63D3D", fontSize: 10, lineHeight: 16, textAlign: "right" }, validationCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7DF", borderRadius: 15, borderWidth: 1, gap: 8, padding: 12 }, validationRow: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 8 }, validationDot: { borderRadius: 5, height: 9, marginTop: 4, width: 9 }, validationText: { color: "#42564C", flex: 1, fontSize: 11, lineHeight: 17, textAlign: "right" }, reviewButton: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 13, flexDirection: "row-reverse", gap: 7, justifyContent: "center", minHeight: 48, paddingHorizontal: 14 }, confirmCard: { backgroundColor: "#FFFDF7", borderColor: "#E8DDBB", borderRadius: 16, borderWidth: 1, gap: 10, padding: 13 }, confirmTitle: { color: "#17382F", fontSize: 13, fontWeight: "900", textAlign: "right" }, consentRow: { alignItems: "center", flexDirection: "row-reverse", gap: 9 }, consentText: { color: "#42564C", flex: 1, fontSize: 11, lineHeight: 17, textAlign: "right" }, successCard: { alignItems: "center", backgroundColor: "#EDFAF2", borderColor: "#B9E2C9", borderRadius: 17, borderWidth: 1, gap: 7, padding: 18 }, successTitle: { color: "#175D3F", fontSize: 15, fontWeight: "900" }, successNumber: { color: "#0B5D45", fontSize: 13, fontWeight: "800" }, openButton: { backgroundColor: "#0B5D45", borderRadius: 11, marginTop: 5, paddingHorizontal: 16, paddingVertical: 10 }, openText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" }, lifecycleCard: { backgroundColor: "#FAFBFA", borderColor: "#E1E9E3", borderRadius: 14, borderWidth: 1, gap: 8, padding: 11 }, lifecycleHint: { color: "#66756E", fontSize: 9, textAlign: "right" }, lifecycleActions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }, lifecycleButton: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 10, flexDirection: "row-reverse", gap: 5, minHeight: 38, paddingHorizontal: 10 }, lifecycleText: { color: "#0B5D45", fontSize: 10, fontWeight: "800" }, destructiveButton: { backgroundColor: "#FEF3F2" }, destructiveText: { color: "#A63D3D", fontSize: 10, fontWeight: "800" }, composer: { alignItems: "flex-end", backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 16, borderWidth: 1, gap: 8, minHeight: 62, padding: 8 }, input: { color: "#17382F", flex: 1, fontSize: 13, maxHeight: 94, paddingHorizontal: 5, textAlignVertical: "center" }, send: { alignItems: "center", backgroundColor: "#116B57", borderRadius: 11, height: 44, justifyContent: "center", width: 44 }, footerActions: { alignItems: "center", justifyContent: "space-between", marginTop: 8 }, handoff: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 999, flexDirection: "row", gap: 5, minHeight: 34, paddingHorizontal: 10 }, handoffText: { color: "#0B5D45", fontSize: 10, fontWeight: "800" }, resume: { color: "#557267", flex: 1, fontSize: 10, textAlign: "center" }, locked: { alignItems: "center", flex: 1, justifyContent: "center", padding: 28 }, lockedText: { color: "#49665B", fontSize: 14, lineHeight: 22, marginTop: 12, textAlign: "center" }, primary: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 13, justifyContent: "center", marginTop: 14, minHeight: 46, paddingHorizontal: 18 }, primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, disabled: { opacity: 0.55 },
});
