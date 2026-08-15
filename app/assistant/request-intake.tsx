import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text, AppTextInput as TextInput } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { useLocale } from "@/lib/locale-provider";
import { trpc } from "@/lib/trpc";

type ChatLine = { id: string; role: "assistant" | "user"; text: string };
type DraftData = Record<string, unknown>;

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export default function RequestIntakeChatScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAccount();
  const { isArabic, locale, direction } = useLocale();
  const start = trpc.executiveAssistant.start.useMutation();
  const send = trpc.executiveAssistant.sendMessage.useMutation();
  const updateDraft = trpc.executiveAssistant.updateDraft.useMutation();
  const handoff = trpc.executiveAssistant.requestHumanHandoff.useMutation();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [draftData, setDraftData] = useState<DraftData>({});
  const startedKey = useRef(uuid());
  const startAttempted = useRef(false);
  const drafts = trpc.executiveAssistant.listDrafts.useQuery(undefined, { enabled: isAuthenticated });
  const detail = trpc.executiveAssistant.detail.useQuery({ conversationId: conversationId ?? "00000000-0000-4000-8000-000000000000" }, { enabled: Boolean(conversationId) });
  const copy = isArabic ? {
    title: "المساعد التنفيذي للطلبات", subtitle: "أرتّب طلبك وأسألك خطوة بخطوة، ثم أعرض ملخصاً واضحاً قبل أي إرسال.", notice: "لا تكتب رقم الهوية أو كلمة المرور أو رمز التحقق أو بيانات البطاقة. أبو مشعل منصة مستقلة ولا يضمن قبول أي جهة للطلب.", signIn: "سجّل الدخول أولاً لحفظ المسودة واستكمالها لاحقاً.", placeholder: "اكتب ما تريد إنجازه…", welcome: "مرحباً، ما الذي تريد إنجازه اليوم؟ اكتب وصفاً عاماً للخدمة أو المعاملة، وسأرتب المسودة معك.", wait: "يجري تنظيم تفاصيل طلبك…", quick: ["أريد تقديم طلب جديد", "أريد متابعة معاملة", "أحتاج إلى حجز موعد", "أرغب في التحدث إلى موظف"], error: "تعذر حفظ هذه الرسالة حالياً. لا تدخل أي بيانات حساسة وحاول مرة أخرى.", sending: "إرسال", resume: "تُحفظ المسودة تلقائياً في حسابك." } : {
    title: "Executive request assistant", subtitle: "I organise your request step by step and show a clear summary before anything is sent.", notice: "Do not enter an ID number, password, verification code, or card details. Abu Mishal is independent and cannot guarantee acceptance by any authority.", signIn: "Sign in first to save and resume your draft.", placeholder: "Describe what you want to do…", welcome: "Welcome. What would you like to accomplish today? Describe the service or transaction generally and I will organise the draft with you.", wait: "Organising your request details…", quick: ["I want to create a new request", "I want to track a transaction", "I need to book an appointment", "I want to speak to a staff member"], error: "This message could not be saved now. Do not enter sensitive data and try again.", sending: "Send", resume: "Your draft is saved to your account automatically." };

  useEffect(() => {
    if (!isAuthenticated || conversationId || drafts.isPending || start.isPending || startAttempted.current) return;
    const saved = drafts.data?.[0];
    if (saved?.conversationId) { setConversationId(saved.conversationId); return; }
    startAttempted.current = true;
    void start.mutateAsync({ language: locale, idempotencyKey: startedKey.current }).then((session) => {
      if (!session.conversation) return;
      setConversationId(session.conversation.id);
      setDraftData(session.draft?.structuredData && typeof session.draft.structuredData === "object" ? session.draft.structuredData as DraftData : {});
      setMessages([{ id: "welcome", role: "assistant", text: copy.welcome }]);
    }).catch(() => setMessages([{ id: "error", role: "assistant", text: copy.error }]));
  }, [conversationId, copy.error, copy.welcome, drafts.data, drafts.isPending, isAuthenticated, locale, start]);

  useEffect(() => {
    if (!detail.data?.conversation || !detail.data.draft) return;
    setDraftData(detail.data.draft.structuredData && typeof detail.data.draft.structuredData === "object" ? detail.data.draft.structuredData as DraftData : {});
    if (detail.data.messages.length) setMessages(detail.data.messages.map((message) => ({ id: message.id, role: message.role === "user" ? "user" : "assistant", text: message.content })));
  }, [detail.data]);

  const sendMessage = async (quickValue?: string) => {
    const message = (quickValue ?? input).trim();
    if (!message || !conversationId || send.isPending) return;
    setInput("");
    const id = `${Date.now()}`;
    setMessages((current) => [...current, { id: `${id}-user`, role: "user", text: message }]);
    try {
      const response = await send.mutateAsync({ conversationId, message, language: locale });
      if (response.draft?.structuredData && typeof response.draft.structuredData === "object") setDraftData(response.draft.structuredData as DraftData);
      setMessages((current) => [...current, { id: `${id}-assistant`, role: "assistant", text: response.reply }]);
    } catch {
      setMessages((current) => [...current, { id: `${id}-error`, role: "assistant", text: copy.error }]);
    }
  };

  const saveField = async (field: "title" | "serviceName" | "entityName" | "description", value: string) => {
    if (!conversationId || !value.trim()) return;
    const session = await updateDraft.mutateAsync({ conversationId, patch: { [field]: value.trim() } });
    if (session?.draft?.structuredData && typeof session.draft.structuredData === "object") setDraftData(session.draft.structuredData as DraftData);
  };

  const requestHandoff = async () => {
    if (!conversationId || handoff.isPending) return;
    try {
      await handoff.mutateAsync({ conversationId, language: locale, reason: isArabic ? "طلب العميل التحويل إلى موظف من المحادثة التنفيذية." : "Customer requested a staff handoff from the executive chat." });
      setMessages((current) => [...current, { id: `${Date.now()}-handoff`, role: "assistant", text: isArabic ? "تم تحويل محادثتك إلى فريق المتابعة. ستظهر الردود في مركز الدعم داخل التطبيق." : "Your chat was handed to the follow-up team. Replies will appear in the in-app support center." }]);
    } catch { setMessages((current) => [...current, { id: `${Date.now()}-handoff-error`, role: "assistant", text: copy.error }]); }
  };

  if (!isAuthenticated) return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.locked}><Ionicons name="lock-closed-outline" size={34} color="#0B5D45" /><Text style={[styles.lockedText, { writingDirection: direction }]}>{copy.signIn}</Text><Pressable onPress={() => router.push("/account" as never)} style={styles.primary}><Text style={styles.primaryText}>{isArabic ? "تسجيل الدخول" : "Sign in"}</Text></Pressable></View></ScreenContainer>;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}><View style={styles.container}>
    <View style={[styles.header, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق المساعد" : "Close assistant"} onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><Text style={[styles.title, { writingDirection: direction }]}>{copy.title}</Text><Text style={[styles.subtitle, { writingDirection: direction }]}>{copy.subtitle}</Text></View></View>
    <View style={[styles.notice, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Ionicons name="shield-checkmark-outline" size={17} color="#49665B" /><Text style={[styles.noticeText, { writingDirection: direction }]}>{copy.notice}</Text></View>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {messages.map((message) => <View key={message.id} style={[styles.message, message.role === "user" ? styles.userMessage : styles.assistantMessage]}><Text style={[styles.messageText, message.role === "assistant" && styles.assistantText, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{message.text}</Text></View>)}
      {!messages.some((message) => message.role === "user") && conversationId ? <View style={[styles.quickList, { alignItems: isArabic ? "flex-end" : "flex-start" }]}>{copy.quick.map((item) => <Pressable key={item} onPress={() => void sendMessage(item)} style={styles.quick}><Text style={[styles.quickText, { writingDirection: direction }]}>{item}</Text></Pressable>)}</View> : null}
      {(start.isPending || send.isPending) ? <View style={[styles.typing, { flexDirection: isArabic ? "row-reverse" : "row" }]}><ActivityIndicator size="small" color="#0B5D45" /><Text style={[styles.typingText, { writingDirection: direction }]}>{copy.wait}</Text></View> : null}
      {conversationId ? <DraftSummary draft={draftData} direction={direction} isArabic={isArabic} saving={updateDraft.isPending} onSave={saveField} /> : null}
    </ScrollView>
    <View style={[styles.composer, { flexDirection: isArabic ? "row-reverse" : "row" }]}><TextInput value={input} onChangeText={setInput} multiline editable={Boolean(conversationId) && !send.isPending} placeholder={copy.placeholder} placeholderTextColor="#93A39C" style={[styles.input, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]} /><Pressable disabled={!conversationId || send.isPending} onPress={() => void sendMessage()} style={[styles.send, (!conversationId || send.isPending) && styles.disabled]}><Ionicons name="send" size={18} color="#FFFFFF" /></Pressable></View>
    <View style={[styles.footerActions, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Pressable onPress={() => void requestHandoff()} disabled={!conversationId || handoff.isPending} style={[styles.handoff, (!conversationId || handoff.isPending) && styles.disabled]}><Ionicons name="person-outline" size={15} color="#0B5D45" /><Text style={styles.handoffText}>{isArabic ? "التحدث مع موظف" : "Talk to a staff member"}</Text></Pressable><Text style={[styles.resume, { writingDirection: direction }]}>{copy.resume}</Text></View>
  </View></KeyboardAvoidingView></ScreenContainer>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, container: { flex: 1, padding: 20 }, header: { alignItems: "center", gap: 12 }, close: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 44, justifyContent: "center", width: 44 }, headerCopy: { alignItems: "flex-end", flex: 1 }, title: { color: "#17382F", fontSize: 21, fontWeight: "800", textAlign: "right" }, subtitle: { color: "#66756E", fontSize: 11, lineHeight: 17, marginTop: 3, textAlign: "right" }, notice: { alignItems: "flex-start", backgroundColor: "#F4F0E6", borderColor: "#E7D9BD", borderRadius: 14, borderWidth: 1, gap: 8, marginTop: 14, padding: 11 }, noticeText: { color: "#49665B", flex: 1, fontSize: 10, lineHeight: 16 }, scroll: { flexGrow: 1, gap: 10, paddingVertical: 15 }, message: { borderRadius: 15, maxWidth: "92%", padding: 12 }, userMessage: { alignSelf: "flex-end", backgroundColor: "#116B57" }, assistantMessage: { alignSelf: "flex-start", backgroundColor: "#F2F8F3", borderColor: "#D7E9DB", borderWidth: 1 }, messageText: { color: "#FFFFFF", fontSize: 13, lineHeight: 21 }, assistantText: { color: "#25463A" }, quickList: { gap: 7 }, quick: { backgroundColor: "#FFFFFF", borderColor: "#CFE1D4", borderRadius: 999, borderWidth: 1, minHeight: 42, paddingHorizontal: 13, justifyContent: "center" }, quickText: { color: "#0B5D45", fontSize: 11, fontWeight: "800" }, typing: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#F2F8F3", borderRadius: 13, gap: 8, padding: 10 }, typingText: { color: "#49665B", fontSize: 11, fontWeight: "700" }, draftCard: { backgroundColor: "#FFFFFF", borderColor: "#CFE1D4", borderRadius: 16, borderWidth: 1, marginTop: 6, padding: 13 }, draftHeading: { color: "#17382F", fontSize: 14, fontWeight: "900", marginBottom: 4 }, draftHint: { color: "#5C7368", fontSize: 10, lineHeight: 15, marginBottom: 9 }, draftField: { borderTopColor: "#EDF1ED", borderTopWidth: 1, paddingTop: 9, marginTop: 8 }, draftLabel: { color: "#49665B", fontSize: 10, fontWeight: "800", marginBottom: 5 }, draftInput: { backgroundColor: "#F9FBF9", borderColor: "#DCE7DE", borderRadius: 10, borderWidth: 1, color: "#17382F", fontSize: 12, minHeight: 40, paddingHorizontal: 9 }, saveDraft: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 10, marginTop: 10, minHeight: 36, justifyContent: "center" }, saveDraftText: { color: "#0B5D45", fontSize: 11, fontWeight: "800" }, composer: { alignItems: "flex-end", backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 16, borderWidth: 1, gap: 8, minHeight: 62, padding: 8 }, input: { color: "#17382F", flex: 1, fontSize: 13, maxHeight: 94, paddingHorizontal: 5, textAlignVertical: "center" }, send: { alignItems: "center", backgroundColor: "#116B57", borderRadius: 11, height: 44, justifyContent: "center", width: 44 }, footerActions: { alignItems: "center", justifyContent: "space-between", marginTop: 8 }, handoff: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 999, flexDirection: "row", gap: 5, minHeight: 34, paddingHorizontal: 10 }, handoffText: { color: "#0B5D45", fontSize: 10, fontWeight: "800" }, resume: { color: "#557267", flex: 1, fontSize: 10, textAlign: "center" }, locked: { alignItems: "center", flex: 1, justifyContent: "center", padding: 28 }, lockedText: { color: "#49665B", fontSize: 14, lineHeight: 22, marginTop: 12, textAlign: "center" }, primary: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 13, marginTop: 14, minHeight: 46, paddingHorizontal: 18, justifyContent: "center" }, primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, disabled: { opacity: 0.55 },
});

function DraftSummary({ draft, direction, isArabic, saving, onSave }: { draft: DraftData; direction: "rtl" | "ltr"; isArabic: boolean; saving: boolean; onSave: (field: "title" | "serviceName" | "entityName" | "description", value: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(String(draft.title ?? ""));
  const [serviceName, setServiceName] = useState(String(draft.serviceName ?? ""));
  const [entityName, setEntityName] = useState(String(draft.entityName ?? ""));
  const [description, setDescription] = useState(String(draft.description ?? ""));
  useEffect(() => { if (!editing) { setTitle(String(draft.title ?? "")); setServiceName(String(draft.serviceName ?? "")); setEntityName(String(draft.entityName ?? "")); setDescription(String(draft.description ?? "")); } }, [draft, editing]);
  const save = async () => { await Promise.all([onSave("title", title), onSave("serviceName", serviceName), onSave("entityName", entityName), onSave("description", description)]); setEditing(false); };
  const fields: [string, string, (value: string) => void, "title" | "serviceName" | "entityName" | "description"][] = [[isArabic ? "العنوان" : "Title", title, setTitle, "title"], [isArabic ? "الخدمة" : "Service", serviceName, setServiceName, "serviceName"], [isArabic ? "الجهة" : "Entity", entityName, setEntityName, "entityName"], [isArabic ? "الوصف" : "Description", description, setDescription, "description"]];
  return <View style={styles.draftCard}><Text style={[styles.draftHeading, { writingDirection: direction, textAlign: direction === "rtl" ? "right" : "left" }]}>{isArabic ? "ملخص المسودة الحي" : "Live draft summary"}</Text><Text style={[styles.draftHint, { writingDirection: direction, textAlign: direction === "rtl" ? "right" : "left" }]}>{isArabic ? "تأكد من هذه المعلومات وعدّلها قبل المراجعة النهائية." : "Check and edit these details before final review."}</Text>{fields.map(([label, value, setter, field]) => <View key={field} style={styles.draftField}><Text style={[styles.draftLabel, { writingDirection: direction, textAlign: direction === "rtl" ? "right" : "left" }]}>{label}</Text>{editing ? <TextInput value={value} onChangeText={setter} multiline={field === "description"} style={[styles.draftInput, { writingDirection: direction, textAlign: direction === "rtl" ? "right" : "left" }]} /> : <Text style={[styles.messageText, styles.assistantText, { writingDirection: direction, textAlign: direction === "rtl" ? "right" : "left" }]}>{value || (isArabic ? "لم يكتمل بعد" : "Not added yet")}</Text>}</View>)}<Pressable onPress={() => editing ? void save() : setEditing(true)} disabled={saving} style={[styles.saveDraft, saving && styles.disabled]}><Text style={styles.saveDraftText}>{editing ? (isArabic ? "حفظ التعديلات" : "Save edits") : (isArabic ? "تعديل الملخص" : "Edit summary")}</Text></Pressable></View>;
}
