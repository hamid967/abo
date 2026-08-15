import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAccount } from "@/hooks/use-account";
import { useLocale } from "@/lib/locale-provider";
import { trpc } from "@/lib/trpc";

type Source = { title: string; sourceLabel: string; sourceUrl: string | null; updatedAt: Date };
type ChatMessage = { id: string; role: "user" | "assistant"; text: string; createdAt: string; deliveryStatus: "sent" | "delivered" | "failed"; sources?: Source[] };
type CopiedResponse = { id: string; text: string; copiedAt: string };
type AssistantSuggestion = { label: string; action: "ask" | "request" | "support" };

function formatTime(value: string, locale: string) {
  return new Date(value).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", { hour: "numeric", minute: "2-digit" });
}

export default function AssistantScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAccount();
  const { locale, isArabic, direction } = useLocale();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copyStatus, setCopyStatus] = useState<{ id: string; state: "copied" | "failed" } | null>(null);
  const [copiedHistory, setCopiedHistory] = useState<CopiedResponse[]>([]);
  const copiedHistoryKey = user?.id ? `abu-mishal:copied-assistant-responses:${user.id}` : null;
  const ask = trpc.assistant.ask.useMutation();
  const text = isArabic ? {
    title: "مساعد أبو مشعل", subtitle: "إرشاد مبني على مصادر المعرفة المنشورة", notice: "المساعد معلوماتي فقط، ولا يقدم استشارة قانونية ملزمة أو قراراً حكومياً. عند غياب مصدر موثوق، سيوجهك إلى فريق الدعم.", placeholder: "اكتب سؤالك عن متابعة طلبك أو المتطلبات", send: "إرسال", source: "مصادر المعرفة", updated: "آخر تحديث", support: "تحويل لموظف", empty: "ابدأ سؤالك، وسيرد المساعد بما تغطيه المصادر المعتمدة.", signIn: "سجّل الدخول لاستخدام المساعد الإرشادي.", typing: "المساعد يكتب رداً من المصادر المعتمدة…", suggestions: "أسئلة وإجراءات مقترحة", copy: "نسخ الرد", copied: "تم النسخ", copyFailed: "تعذر النسخ", copiedHistory: "آخر الردود المنسوخة", localOnly: "محفوظة على هذا الجهاز فقط", recopy: "نسخ مجدداً", sent: "تم الإرسال", delivered: "رد موثوق", failed: "تعذر الرد", time: "وقت الرسالة"
  } : {
    title: "Abu Mishal Assistant", subtitle: "Guidance grounded in published knowledge sources", notice: "The assistant is informational only. It does not provide binding legal advice or government decisions. If no trusted source exists, it will direct you to support.", placeholder: "Ask about request follow-up or requirements", send: "Send", source: "Knowledge sources", updated: "Updated", support: "Escalate to support", empty: "Ask a question and the assistant will respond using approved sources.", signIn: "Sign in to use the guidance assistant.", typing: "The assistant is preparing a response from approved sources…", suggestions: "Suggested questions and actions", copy: "Copy response", copied: "Copied", copyFailed: "Copy failed", copiedHistory: "Recently copied responses", localOnly: "Stored on this device only", recopy: "Copy again", sent: "Sent", delivered: "Trusted response", failed: "Response unavailable", time: "Message time"
  };
  const suggestions: AssistantSuggestion[] = isArabic ? [
    { label: "ما حالة معاملتي؟", action: "ask" }, { label: "ما المستندات الناقصة؟", action: "ask" }, { label: "لخّص آخر تحديثات معاملتي.", action: "ask" }, { label: "أريد الاستفسار عن خدمة.", action: "ask" }, { label: "أنشئ لي طلباً جديداً.", action: "request" }, { label: "أريد التواصل مع الموظف.", action: "support" },
  ] : [
    { label: "What is my transaction status?", action: "ask" }, { label: "Which documents are missing?", action: "ask" }, { label: "Summarise my latest transaction updates.", action: "ask" }, { label: "I want to ask about a service.", action: "ask" }, { label: "Create a new request.", action: "request" }, { label: "I want to contact the team.", action: "support" },
  ];

  useEffect(() => {
    let mounted = true;
    if (!copiedHistoryKey) { setCopiedHistory([]); return () => { mounted = false; }; }
    void AsyncStorage.getItem(copiedHistoryKey).then((rawValue) => {
      if (!mounted || !rawValue) return;
      try {
        const parsed: unknown = JSON.parse(rawValue);
        if (Array.isArray(parsed)) setCopiedHistory(parsed.filter((entry): entry is CopiedResponse => Boolean(entry && typeof entry.id === "string" && typeof entry.text === "string" && typeof entry.copiedAt === "string")).slice(0, 8));
      } catch { setCopiedHistory([]); }
    });
    return () => { mounted = false; };
  }, [copiedHistoryKey]);

  const send = async (suggestedQuestion?: string) => {
    const prompt = (suggestedQuestion ?? question).trim();
    if (prompt.length < 3) return;
    setQuestion("");
    const messageId = String(Date.now());
    const createdAt = new Date().toISOString();
    setMessages((current) => [...current, { id: messageId, role: "user", text: prompt, createdAt, deliveryStatus: "sent" }]);
    try {
      const response = await ask.mutateAsync({ question: prompt, language: locale });
      setMessages((current) => [...current, { id: `${messageId}-answer`, role: "assistant", text: response.answer, createdAt: new Date().toISOString(), deliveryStatus: "delivered", sources: response.sources }]);
    } catch {
      setMessages((current) => [...current, { id: `${messageId}-error`, role: "assistant", text: isArabic ? "تعذر إعداد الرد الآن. يمكنك تحويل الاستفسار إلى فريق الدعم ليتابع معك." : "A response could not be prepared. You can escalate this to support for follow-up.", createdAt: new Date().toISOString(), deliveryStatus: "failed" }]);
    }
  };

  const handleSuggestion = (suggestion: AssistantSuggestion) => {
    if (suggestion.action === "request") { router.push("/request/new" as never); return; }
    if (suggestion.action === "support") { router.push("/inquiries" as never); return; }
    void send(suggestion.label);
  };

  const copyAnswer = async (message: Pick<ChatMessage, "id" | "text">) => {
    try {
      const copied = await Clipboard.setStringAsync(message.text);
      if (copied === false) throw new Error("Clipboard write was not acknowledged");
      setCopyStatus({ id: message.id, state: "copied" });
      if (copiedHistoryKey) {
        const entry: CopiedResponse = { id: `${message.id}-${Date.now()}`, text: message.text, copiedAt: new Date().toISOString() };
        const nextHistory = [entry, ...copiedHistory.filter((item) => item.text !== message.text)].slice(0, 8);
        setCopiedHistory(nextHistory);
        void AsyncStorage.setItem(copiedHistoryKey, JSON.stringify(nextHistory));
      }
    } catch { setCopyStatus({ id: message.id, state: "failed" }); }
    setTimeout(() => setCopyStatus((current) => current?.id === message.id ? null : current), 2400);
  };

  const deliveryLabel = (message: ChatMessage) => message.deliveryStatus === "sent" ? text.sent : message.deliveryStatus === "delivered" ? text.delivered : text.failed;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.container}>
    <View style={[styles.header, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق المساعد" : "Close assistant"} onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><Text style={[styles.title, { writingDirection: direction }]}>{text.title}</Text><Text style={[styles.subtitle, { writingDirection: direction }]}>{text.subtitle}</Text></View></View>
    <View style={[styles.notice, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Ionicons name="shield-checkmark-outline" size={18} color="#49665B" /><Text style={[styles.noticeText, { writingDirection: direction }]}>{text.notice}</Text></View>
    {!isAuthenticated ? <Pressable onPress={() => router.push("/account" as never)} style={styles.empty}><Ionicons name="lock-closed-outline" size={32} color="#0B5D45" /><Text style={[styles.emptyText, { writingDirection: direction }]}>{text.signIn}</Text></Pressable> : <>
      <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        {!messages.length ? <><View style={styles.empty}><Ionicons name="sparkles-outline" size={32} color="#0B5D45" /><Text style={[styles.emptyText, { writingDirection: direction }]}>{text.empty}</Text></View>{!ask.isPending ? <View style={styles.suggestionSection}><Text style={[styles.suggestionTitle, { writingDirection: direction }]}>{text.suggestions}</Text><View style={[styles.suggestionList, { alignItems: isArabic ? "flex-end" : "flex-start" }]}>{suggestions.map((suggestion) => <Pressable key={suggestion.label} onPress={() => handleSuggestion(suggestion)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}><Ionicons name={suggestion.action === "request" ? "add-circle-outline" : suggestion.action === "support" ? "help-buoy-outline" : "chatbubble-ellipses-outline"} size={15} color="#0B5D45" /><Text style={[styles.suggestionText, { writingDirection: direction }]}>{suggestion.label}</Text></Pressable>)}</View></View> : null}</> : null}
        {messages.map((message) => <View key={message.id} style={[styles.message, message.role === "user" ? styles.userMessage : styles.assistantMessage]}>
          <Text style={[styles.messageText, message.role === "assistant" && styles.assistantMessageText, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{message.text}</Text>
          <View style={[styles.messageMeta, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Text style={[styles.metaText, message.role === "user" && styles.userMetaText]}>{formatTime(message.createdAt, locale)}</Text><View style={[styles.deliveryBadge, message.deliveryStatus === "failed" && styles.failedBadge]}><Ionicons name={message.deliveryStatus === "failed" ? "alert-circle-outline" : "checkmark-circle-outline"} size={11} color={message.deliveryStatus === "failed" ? "#C84141" : message.role === "user" ? "#E5FFF1" : "#18875F"} /><Text style={[styles.metaText, message.role === "user" && styles.userMetaText, message.deliveryStatus === "failed" && styles.failedText]}>{deliveryLabel(message)}</Text></View></View>
          {message.role === "assistant" ? <View style={[styles.messageActions, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Pressable accessibilityRole="button" accessibilityLabel={text.copy} onPress={() => void copyAnswer(message)} style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}><Ionicons name={copyStatus?.id === message.id && copyStatus.state === "copied" ? "checkmark" : "copy-outline"} size={15} color="#0B5D45" /><Text style={[styles.copyText, { writingDirection: direction }]}>{copyStatus?.id === message.id ? (copyStatus.state === "copied" ? text.copied : text.copyFailed) : text.copy}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={text.support} onPress={() => router.push("/inquiries" as never)} style={({ pressed }) => [styles.escalateButton, pressed && styles.pressed]}><Ionicons name="help-buoy-outline" size={15} color="#116B57" /><Text style={[styles.escalateText, { writingDirection: direction }]}>{text.support}</Text></Pressable></View> : null}
          {message.role === "assistant" && message.sources?.length ? <View style={styles.sources}><Text style={[styles.sourceTitle, { writingDirection: direction }]}>{text.source}</Text>{message.sources.map((source, index) => <View key={`${source.title}-${index}`} style={styles.sourceRow}><Ionicons name="book-outline" size={14} color="#0B5D45" /><View style={styles.sourceCopy}><Text style={[styles.sourceName, { writingDirection: direction }]}>{source.title}</Text><Text style={[styles.sourceMeta, { writingDirection: direction }]}>{source.sourceLabel} · {text.updated} {new Date(source.updatedAt).toLocaleDateString(isArabic ? "ar-SA" : "en-US")}</Text></View></View>)}</View> : null}
        </View>)}
        {ask.isPending ? <View style={[styles.typing, { flexDirection: isArabic ? "row-reverse" : "row" }]}><ActivityIndicator size="small" color="#0B5D45" /><Text style={[styles.typingText, { writingDirection: direction }]}>{text.typing}</Text></View> : null}
        {copiedHistory.length > 0 ? <View style={styles.historySection}><View style={[styles.historyHeading, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Ionicons name="time-outline" size={17} color="#0B5D45" /><View><Text style={[styles.historyTitle, { writingDirection: direction }]}>{text.copiedHistory}</Text><Text style={[styles.historyHint, { writingDirection: direction }]}>{text.localOnly}</Text></View></View>{copiedHistory.map((item) => <View key={item.id} style={styles.historyItem}><Text numberOfLines={3} style={[styles.historyText, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{item.text}</Text><Pressable onPress={() => void copyAnswer(item)} style={({ pressed }) => [styles.recopyButton, pressed && styles.pressed]}><Ionicons name="copy-outline" size={14} color="#0B5D45" /><Text style={[styles.copyText, { writingDirection: direction }]}>{text.recopy}</Text></Pressable></View>)}</View> : null}
      </ScrollView>
      <View style={[styles.composer, { flexDirection: isArabic ? "row-reverse" : "row" }]}><TextInput value={question} onChangeText={setQuestion} multiline placeholder={text.placeholder} placeholderTextColor="#93A39C" style={[styles.input, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]} /><Pressable accessibilityRole="button" accessibilityLabel={text.send} onPress={() => void send()} disabled={ask.isPending} style={({ pressed }) => [styles.send, (pressed || ask.isPending) && styles.pressed]}><Ionicons name="send" size={18} color="#FFFFFF" /></Pressable></View>
      <Pressable onPress={() => router.push("/inquiries" as never)} style={styles.supportButton}><Ionicons name="help-buoy-outline" size={16} color="#0B5D45" /><Text style={[styles.supportText, { writingDirection: direction }]}>{text.support}</Text></Pressable>
    </>}
  </View></ScreenContainer>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 }, header: { alignItems: "center", gap: 12 }, close: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 44, justifyContent: "center", width: 44 }, headerCopy: { alignItems: "flex-end", flex: 1 }, title: { color: "#17382F", fontSize: 22, fontWeight: "800", textAlign: "right" }, subtitle: { color: "#66756E", fontSize: 12, marginTop: 4, textAlign: "right" }, notice: { alignItems: "flex-start", backgroundColor: "#F4F0E6", borderColor: "#E7D9BD", borderRadius: 14, borderWidth: 1, gap: 8, marginTop: 18, padding: 12 }, noticeText: { color: "#49665B", flex: 1, fontSize: 11, lineHeight: 17, textAlign: "right" }, messages: { flexGrow: 1, gap: 10, paddingVertical: 16 }, message: { borderRadius: 15, padding: 12 }, userMessage: { alignSelf: "flex-end", backgroundColor: "#116B57", maxWidth: "86%" }, assistantMessage: { alignSelf: "stretch", backgroundColor: "#F2F8F3", borderColor: "#D7E9DB", borderWidth: 1 }, messageText: { color: "#FFFFFF", fontSize: 13, lineHeight: 21 }, assistantMessageText: { color: "#25463A" }, messageMeta: { alignItems: "center", gap: 8, marginTop: 8 }, metaText: { color: "#6A7C73", fontSize: 9, fontWeight: "700" }, userMetaText: { color: "#D9F5E7" }, deliveryBadge: { alignItems: "center", flexDirection: "row-reverse", gap: 3 }, failedBadge: { }, failedText: { color: "#C84141" }, messageActions: { gap: 7, marginTop: 9 }, copyButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#CFE1D4", borderRadius: 999, borderWidth: 1, flexDirection: "row-reverse", gap: 5, minHeight: 44, paddingHorizontal: 12 }, copyText: { color: "#0B5D45", fontSize: 10, fontWeight: "800" }, escalateButton: { alignItems: "center", backgroundColor: "#EAF6ED", borderRadius: 999, flexDirection: "row-reverse", gap: 5, minHeight: 44, paddingHorizontal: 12 }, escalateText: { color: "#116B57", fontSize: 10, fontWeight: "800" }, historySection: { backgroundColor: "#F9FBF9", borderColor: "#DCE8DF", borderRadius: 16, borderWidth: 1, gap: 10, marginTop: 6, padding: 12 }, historyHeading: { alignItems: "center", gap: 8 }, historyTitle: { color: "#17382F", fontSize: 13, fontWeight: "800", textAlign: "right" }, historyHint: { color: "#6A7C73", fontSize: 10, marginTop: 2, textAlign: "right" }, historyItem: { backgroundColor: "#FFFFFF", borderColor: "#E7EFE8", borderRadius: 12, borderWidth: 1, padding: 10 }, historyText: { color: "#315548", fontSize: 12, lineHeight: 18 }, recopyButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row-reverse", gap: 5, marginTop: 8, minHeight: 44, paddingHorizontal: 5 }, suggestionSection: { backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 16, borderWidth: 1, gap: 10, padding: 12 }, suggestionTitle: { color: "#49665B", fontSize: 12, fontWeight: "800", textAlign: "right" }, suggestionList: { gap: 8 }, suggestion: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#CFE1D4", borderRadius: 11, borderWidth: 1, flexDirection: "row-reverse", gap: 7, maxWidth: "100%", minHeight: 44, paddingHorizontal: 10 }, suggestionText: { color: "#0B5D45", flexShrink: 1, fontSize: 12, fontWeight: "700", textAlign: "right" }, typing: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#F2F8F3", borderColor: "#D7E9DB", borderRadius: 13, borderWidth: 1, gap: 8, paddingHorizontal: 11, paddingVertical: 9 }, typingText: { color: "#49665B", fontSize: 11, fontWeight: "700" }, sources: { borderTopColor: "#D7E9DB", borderTopWidth: 1, gap: 7, marginTop: 11, paddingTop: 10 }, sourceTitle: { color: "#0B5D45", fontSize: 11, fontWeight: "800", textAlign: "right" }, sourceRow: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 7 }, sourceCopy: { alignItems: "flex-end", flex: 1 }, sourceName: { color: "#25463A", fontSize: 11, fontWeight: "800", textAlign: "right" }, sourceMeta: { color: "#6A7C73", fontSize: 10, marginTop: 2, textAlign: "right" }, composer: { alignItems: "flex-end", backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 16, borderWidth: 1, gap: 8, minHeight: 62, padding: 8 }, input: { color: "#17382F", flex: 1, fontSize: 13, maxHeight: 100, paddingHorizontal: 5, textAlignVertical: "center" }, send: { alignItems: "center", backgroundColor: "#116B57", borderRadius: 11, height: 44, justifyContent: "center", width: 44 }, supportButton: { alignItems: "center", alignSelf: "center", flexDirection: "row-reverse", gap: 6, marginTop: 9, minHeight: 44, paddingHorizontal: 8 }, supportText: { color: "#0B5D45", fontSize: 12, fontWeight: "800" }, empty: { alignItems: "center", backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 18, borderStyle: "dashed", borderWidth: 1, marginTop: 20, padding: 28 }, emptyText: { color: "#66756E", fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: "center" }, pressed: { opacity: 0.7 },
});
