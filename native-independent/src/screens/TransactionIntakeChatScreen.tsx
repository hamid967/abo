import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { beginNativeLogin } from "../auth/nativeOAuth";
import { readSessionToken } from "../auth/secureSession";
import { assistantApi } from "../data/executiveAssistant";
import { useTransactionStore } from "../data/transactionStore";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { theme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "TransactionIntake">;
type ChatMessage = { id: string; role: "assistant" | "user"; text: string };

export function TransactionIntakeChatScreen({ navigation }: Props) {
  const { refresh } = useTransactionStore();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(true);
  const [state, setState] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [submissionConsent, setSubmissionConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void (async () => {
    if (!await readSessionToken()) { setBusy(false); return; }
    try {
      const drafts = await assistantApi.listDrafts() as any[];
      const session = drafts?.[0]?.conversationId ? await assistantApi.detail(drafts[0].conversationId) : await assistantApi.start();
      const id = session?.conversation?.id;
      if (!id) throw new Error("CONVERSATION_START_FAILED");
      const detail = session?.messages ? session : await assistantApi.detail(id);
      setConversationId(id); setState(detail?.conversation?.currentState ?? null);
      const restored = Array.isArray(detail?.messages) ? detail.messages.map((item: any) => ({ id: String(item.id), role: item.role === "user" ? "user" : "assistant", text: String(item.content) })) : [];
      setMessages(restored.length ? restored : [{ id: "welcome", role: "assistant", text: "هلا بك، بنستلم معاملتك خطوة بخطوة. وش الخدمة أو المعاملة اللي تبي تبدأ فيها؟" }]);
    } catch { setError("ما قدرنا نفتح مسودتك الحين. جرّب مرة ثانية."); }
    finally { setBusy(false); }
  })(); }, []);

  const send = async () => {
    const message = input.trim();
    if (!message || !conversationId || busy) return;
    const id = `${Date.now()}`; setInput(""); setBusy(true); setError(null);
    setMessages((current) => [...current, { id: `${id}-user`, role: "user", text: message }]);
    try {
      const response = await assistantApi.sendMessage(conversationId, message) as any;
      setMessages((current) => [...current, { id: `${id}-assistant`, role: "assistant", text: String(response?.reply ?? "تم تسجيل ردك.") }]);
      const detail = await assistantApi.detail(conversationId) as any; setState(detail?.conversation?.currentState ?? null);
    } catch { setError("ما قدرنا نحفظ رسالتك. جرّب مرة ثانية."); }
    finally { setBusy(false); }
  };
  const review = async () => { if (!conversationId || busy) return; setBusy(true); try { const result = await assistantApi.validate(conversationId) as any; if (result?.results?.some((item: any) => item.severity === "error")) { setError("بعض البيانات ناقصة. أكمل إجابات المحادثة ثم جرّب."); } else { await assistantApi.prepareReview(conversationId); setState("awaiting_confirmation"); } } catch { setError("تعذر التحقق من المسودة."); } finally { setBusy(false); } };
  const submit = async () => { if (!conversationId || !terms || !privacy || !submissionConsent || busy) return; setBusy(true); try { await assistantApi.recordConsent(conversationId, "terms"); await assistantApi.recordConsent(conversationId, "privacy"); await assistantApi.recordConsent(conversationId, "request_submission"); await assistantApi.submit(conversationId); await refresh(); setState("submitted"); } catch { setError("تعذر إنشاء المعاملة. راجع الموافقات ثم جرّب."); } finally { setBusy(false); } };

  if (busy && !conversationId) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (!conversationId) return <View style={styles.center}><Text style={styles.error}>{error ?? "سجّل دخولك لبدء معاملة محفوظة في حسابك."}</Text><Pressable onPress={() => void beginNativeLogin()} style={styles.primary}><Text style={styles.primaryText}>تسجيل الدخول</Text></Pressable></View>;
  return <View style={styles.screen}><ScrollView contentContainerStyle={styles.content}>{messages.map((message) => <View key={message.id} style={[styles.message, message.role === "user" ? styles.user : styles.assistant]}><Text style={[styles.messageText, message.role === "assistant" && styles.assistantText]}>{message.text}</Text></View>)}{busy ? <ActivityIndicator color={theme.colors.primary} style={styles.spinner} /> : null}{state !== "awaiting_confirmation" && state !== "submitted" ? <Pressable onPress={() => void review()} style={styles.secondary}><Text style={styles.secondaryText}>تحقق واعرض المراجعة</Text></Pressable> : null}{state === "awaiting_confirmation" ? <View style={styles.confirm}><Text style={styles.confirmTitle}>راجع ووافق قبل الإرسال</Text><Consent label="اطلعت على الشروط" value={terms} onChange={setTerms} /><Consent label="اطلعت على سياسة الخصوصية" value={privacy} onChange={setPrivacy} /><Consent label="أوافق صراحة على إنشاء الطلب" value={submissionConsent} onChange={setSubmissionConsent} /><Pressable disabled={!terms || !privacy || !submissionConsent || busy} onPress={() => void submit()} style={[styles.primary, (!terms || !privacy || !submissionConsent || busy) && styles.disabled]}><Text style={styles.primaryText}>تأكيد وإرسال الطلب</Text></Pressable></View> : null}{state === "submitted" ? <Pressable onPress={() => navigation.replace("Transactions")} style={styles.primary}><Text style={styles.primaryText}>فتح المعاملات</Text></Pressable> : null}{error ? <Text style={styles.error}>{error}</Text> : null}</ScrollView>{state !== "submitted" ? <View style={styles.composer}><TextInput value={input} onChangeText={setInput} placeholder="اكتب وصف المعاملة أو إجابتك…" placeholderTextColor="#84948C" multiline style={styles.input} textAlign="right" /><Pressable onPress={() => void send()} disabled={busy} style={[styles.send, busy && styles.disabled]}><Text style={styles.primaryText}>إرسال</Text></Pressable></View> : null}</View>;
}

function Consent({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { return <View style={styles.consent}><Switch value={value} onValueChange={onChange} /><Text style={styles.consentText}>{label}</Text></View>; }
const styles = StyleSheet.create({ screen: { backgroundColor: theme.colors.background, flex: 1 }, content: { padding: 18 }, center: { alignItems: "center", backgroundColor: theme.colors.background, flex: 1, justifyContent: "center", padding: 22 }, message: { borderRadius: 15, marginBottom: 9, maxWidth: "88%", padding: 12 }, user: { alignSelf: "flex-start", backgroundColor: theme.colors.primary }, assistant: { alignSelf: "flex-end", backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }, messageText: { color: "#FFFFFF", fontSize: 14, lineHeight: 21, textAlign: "right", writingDirection: "rtl" }, assistantText: { color: theme.colors.foreground }, spinner: { marginVertical: 14 }, composer: { alignItems: "flex-end", backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border, borderTopWidth: 1, flexDirection: "row-reverse", gap: 8, padding: 12 }, input: { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderRadius: 12, borderWidth: 1, color: theme.colors.foreground, flex: 1, minHeight: 48, padding: 10, writingDirection: "rtl" }, send: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14 }, primary: { alignItems: "center", backgroundColor: theme.colors.primary, borderRadius: 12, marginTop: 14, padding: 14 }, primaryText: { color: "#FFFFFF", fontWeight: "900", writingDirection: "rtl" }, secondary: { alignItems: "center", backgroundColor: "#E8F4ED", borderRadius: 12, marginTop: 12, padding: 13 }, secondaryText: { color: theme.colors.primary, fontWeight: "900", writingDirection: "rtl" }, confirm: { backgroundColor: "#F0F8F3", borderRadius: 14, marginTop: 16, padding: 14 }, confirmTitle: { color: theme.colors.foreground, fontSize: 16, fontWeight: "900", textAlign: "right", writingDirection: "rtl" }, consent: { alignItems: "center", flexDirection: "row-reverse", gap: 10, marginTop: 10 }, consentText: { color: theme.colors.foreground, flex: 1, textAlign: "right", writingDirection: "rtl" }, error: { color: "#B42318", lineHeight: 21, marginTop: 12, textAlign: "center", writingDirection: "rtl" }, disabled: { opacity: 0.45 } });
