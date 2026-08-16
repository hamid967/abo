import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text, AppTextInput as TextInput } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { useLocale } from "@/lib/locale-provider";
import { trpc } from "@/lib/trpc";

function formatTime(value: Date | string, locale: string) {
  return new Date(value).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", { hour: "numeric", minute: "2-digit" });
}

export default function AbuMishalChatScreen() {
  const router = useRouter();
  const { isAuthenticated, user, role } = useAccount();
  const { locale, isArabic, direction } = useLocale();
  const [draft, setDraft] = useState("");
  const isAdmin = role === "admin" || role === "super_admin";
  const mine = trpc.abuMishalChat.mine.useQuery(undefined, { enabled: isAuthenticated && !isAdmin, refetchInterval: 4_000 });
  const chatId = mine.data?.id;
  const detail = trpc.abuMishalChat.detail.useQuery({ ticketId: chatId ?? 1 }, { enabled: Boolean(chatId) && isAuthenticated, refetchInterval: 4_000 });
  const markRead = trpc.abuMishalChat.markRead.useMutation();
  const send = trpc.abuMishalChat.send.useMutation({ onSuccess: async () => { setDraft(""); await mine.refetch(); await detail.refetch(); } });
  const messages = detail.data?.messages ?? [];
  const text = useMemo(() => isArabic ? {
    title: "محادثة أبو مشعل", subtitle: "تواصل مباشر مع فريق أبو مشعل داخل التطبيق", notice: "المحادثة للمتابعة والدعم داخل أبو مشعل، والمنصة مستقلة ولا تمثل جهة حكومية.", placeholder: "اكتب رسالتك هنا…", send: "إرسال", empty: "ابدأ رسالتك، وفريق أبو مشعل بيوصل له كلامك ويرد عليك هنا.", signIn: "سجّل دخولك عشان تبدأ محادثة آمنة مع أبو مشعل.", admin: "أنت داخل بحساب أدمن. افتح صندوق المحادثات للرد على العملاء.", inbox: "فتح صندوق المحادثات", seen: "تمت القراءة", delivered: "تم الإرسال", new: "جديد" } : {
    title: "Abu Mishal chat", subtitle: "Message the Abu Mishal team in the app", notice: "This chat is for in-app support and follow-up. Abu Mishal is independent and does not represent a government entity.", placeholder: "Write your message…", send: "Send", empty: "Start a message and the Abu Mishal team will reply here.", signIn: "Sign in to start a secure chat with Abu Mishal.", admin: "You are signed in as an administrator. Open the inbox to reply to customers.", inbox: "Open chat inbox", seen: "Read", delivered: "Sent", new: "New" }, [isArabic]);

  useEffect(() => {
    if (chatId && messages.length && !markRead.isPending) markRead.mutate({ ticketId: chatId });
  }, [chatId, markRead, messages.length]);

  const submit = async () => {
    if (!draft.trim() || send.isPending) return;
    try { await send.mutateAsync({ ticketId: chatId, body: draft.trim() }); }
    catch { Alert.alert(isArabic ? "ما قدرنا نرسل الرسالة" : "Message could not be sent", isArabic ? "تأكد من الاتصال وجرّب مرة ثانية." : "Check your connection and try again."); }
  };

  if (!isAuthenticated) return <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.container}><View style={styles.center}><Ionicons name="lock-closed-outline" size={34} color="#0B5D45" /><Text style={[styles.centerText, { writingDirection: direction }]}>{text.signIn}</Text><Pressable onPress={() => router.push("/account" as never)} style={styles.primary}><Text style={styles.primaryText}>{isArabic ? "تسجيل الدخول" : "Sign in"}</Text></Pressable></View></ScreenContainer>;
  if (isAdmin) return <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.container}><View style={styles.center}><Ionicons name="chatbubbles-outline" size={38} color="#0B5D45" /><Text style={[styles.centerText, { writingDirection: direction }]}>{text.admin}</Text><Pressable onPress={() => router.replace("/admin/chats" as never)} style={styles.primary}><Text style={styles.primaryText}>{text.inbox}</Text></Pressable></View></ScreenContainer>;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.container}><KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={[styles.header, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "رجوع" : "Back"} onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-forward" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><View style={[styles.titleRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}><View style={styles.avatar}><Ionicons name="chatbubble-ellipses" size={16} color="#FFFFFF" /></View><View><Text style={[styles.title, { writingDirection: direction }]}>{text.title}</Text><Text style={[styles.subtitle, { writingDirection: direction }]}>{text.subtitle}</Text></View></View></View></View>
    <View style={[styles.notice, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Ionicons name="shield-checkmark-outline" size={17} color="#49665B" /><Text style={[styles.noticeText, { writingDirection: direction }]}>{text.notice}</Text></View>
    <FlatList data={messages} keyExtractor={(item) => String(item.id)} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} ListEmptyComponent={mine.isLoading || detail.isLoading ? <ActivityIndicator color="#0B5D45" style={styles.loading} /> : <View style={styles.empty}><Ionicons name="hand-left-outline" size={31} color="#0B5D45" /><Text style={[styles.emptyText, { writingDirection: direction }]}>{text.empty}</Text></View>} renderItem={({ item }) => {
      const own = item.authorUserId === user?.id;
      return <View style={[styles.bubble, own ? styles.ownBubble : styles.teamBubble]}><Text style={[styles.bubbleText, own && styles.ownBubbleText, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{item.body}</Text><View style={[styles.metaRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Text style={[styles.meta, own && styles.ownMeta]}>{formatTime(item.createdAt, locale)}</Text>{own ? <View style={styles.readState}><Ionicons name={item.readAt ? "checkmark-done" : "checkmark"} size={14} color={item.readAt ? "#BDEED4" : "#DFF6E9"} /><Text style={styles.ownMeta}>{item.readAt ? text.seen : text.delivered}</Text></View> : null}</View></View>;
    }} />
    <View style={[styles.composer, { flexDirection: isArabic ? "row-reverse" : "row" }]}><TextInput value={draft} onChangeText={setDraft} multiline placeholder={text.placeholder} placeholderTextColor="#93A39C" style={[styles.input, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]} /><Pressable accessibilityRole="button" accessibilityLabel={text.send} onPress={() => void submit()} disabled={send.isPending || !draft.trim()} style={({ pressed }) => [styles.send, (pressed || send.isPending || !draft.trim()) && styles.disabled]}>{send.isPending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}</Pressable></View>
  </KeyboardAvoidingView></ScreenContainer>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 18 }, keyboardArea: { alignSelf: "center", flex: 1, maxWidth: 780, width: "100%" }, header: { alignItems: "center", gap: 11 }, back: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, headerCopy: { flex: 1 }, titleRow: { alignItems: "center", gap: 9 }, avatar: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 14, height: 30, justifyContent: "center", width: 30 }, title: { color: "#17382F", fontSize: 19, fontWeight: "800", textAlign: "right" }, subtitle: { color: "#66756E", fontSize: 11, marginTop: 2, textAlign: "right" }, notice: { alignItems: "flex-start", backgroundColor: "#F4F0E6", borderColor: "#E7D9BD", borderRadius: 14, borderWidth: 1, gap: 8, marginTop: 14, padding: 10 }, noticeText: { color: "#49665B", flex: 1, fontSize: 10, lineHeight: 16, textAlign: "right" }, list: { flexGrow: 1, gap: 9, paddingBottom: 8, paddingTop: 16 }, bubble: { borderRadius: 17, maxWidth: "86%", padding: 11 }, ownBubble: { alignSelf: "flex-end", backgroundColor: "#116B57" }, teamBubble: { alignSelf: "flex-start", backgroundColor: "#F3F8F4", borderColor: "#D7E9DB", borderWidth: 1 }, bubbleText: { color: "#294A3D", fontSize: 13, lineHeight: 20 }, ownBubbleText: { color: "#FFFFFF" }, metaRow: { alignItems: "center", gap: 7, marginTop: 7 }, meta: { color: "#6A7C73", fontSize: 9 }, ownMeta: { color: "#DDF6E8", fontSize: 9 }, readState: { alignItems: "center", flexDirection: "row", gap: 2 }, composer: { alignItems: "flex-end", backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 17, borderWidth: 1, gap: 8, minHeight: 58, padding: 7 }, input: { color: "#17382F", flex: 1, fontSize: 13, maxHeight: 90, paddingHorizontal: 5, textAlignVertical: "center" }, send: { alignItems: "center", backgroundColor: "#116B57", borderRadius: 11, height: 43, justifyContent: "center", width: 43 }, disabled: { opacity: 0.55 }, center: { alignItems: "center", flex: 1, justifyContent: "center", padding: 30 }, centerText: { color: "#49665B", fontSize: 14, lineHeight: 22, marginTop: 12, textAlign: "center" }, primary: { backgroundColor: "#0B5D45", borderRadius: 12, marginTop: 16, minHeight: 45, paddingHorizontal: 18, justifyContent: "center" }, primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, empty: { alignItems: "center", backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 18, borderStyle: "dashed", borderWidth: 1, marginTop: 28, padding: 26 }, emptyText: { color: "#66756E", fontSize: 13, lineHeight: 20, marginTop: 9, textAlign: "center" }, loading: { marginTop: 32 } });
