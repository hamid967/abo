import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useLocale } from "@/lib/locale-provider";

const logo = require("@/assets/images/icon.png");

export default function WelcomeScreen() {
  const router = useRouter();
  const { isArabic, direction } = useLocale();
  const text = isArabic
    ? {
        eyebrow: "أبو مشعل",
        title: "كل معاملة أوضح، وكل خطوة أقرب.",
        description: "مساحة متابعة مستقلة تساعدك على تنظيم طلباتك ومتطلباتها ومواعيدها في تجربة واحدة هادئة وواضحة.",
        primary: "ابدأ طلباً جديداً",
        secondary: "تسجيل الدخول والمتابعة",
        stepsTitle: "كيف يساعدك أبو مشعل؟",
        steps: ["أنشئ طلبك بمتطلبات واضحة", "تابع الحالة والمواعيد من مكان واحد", "اسأل المساعد أو تواصل مع فريق الدعم"],
        notice: "أبو مشعل منصة مستقلة ولا يمثل أي جهة حكومية.",
      }
    : {
        eyebrow: "ABU MISHAL",
        title: "Clearer requests. Closer next steps.",
        description: "An independent workspace that helps you organise requests, requirements and reminders in one calm, focused experience.",
        primary: "Start a new request",
        secondary: "Sign in and continue",
        stepsTitle: "How Abu Mishal helps",
        steps: ["Create a request with clear requirements", "Track status and important dates in one place", "Ask the assistant or contact support"],
        notice: "Abu Mishal is an independent platform and does not represent any government entity.",
      };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.topLine, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
          <View style={styles.brandPill}><Image source={logo} style={styles.smallLogo} /><Text style={[styles.brandPillText, { writingDirection: direction }]}>{text.eyebrow}</Text></View>
          <Pressable onPress={() => router.replace("/(tabs)" as never)} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}><Text style={[styles.skipText, { writingDirection: direction }]}>{isArabic ? "تخطي" : "Skip"}</Text></Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.logoHalo}><Image source={logo} style={styles.logo} /></View>
          <View style={styles.sparkOne} /><View style={styles.sparkTwo} />
          <Text style={[styles.heroTitle, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{text.title}</Text>
          <Text style={[styles.heroDescription, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{text.description}</Text>
        </View>

        <View style={styles.stepsCard}>
          <Text style={[styles.stepsTitle, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{text.stepsTitle}</Text>
          {text.steps.map((step, index) => <View key={step} style={[styles.stepRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View><Text style={[styles.stepText, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{step}</Text></View>)}
        </View>

        <View style={styles.actions}>
          <Pressable onPress={() => router.replace("/request/new" as never)} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><Text style={[styles.primaryActionText, { writingDirection: direction }]}>{text.primary}</Text><Ionicons name={isArabic ? "arrow-back" : "arrow-forward"} size={18} color="#FFFFFF" /></Pressable>
          <Pressable onPress={() => router.replace("/account" as never)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Text style={[styles.secondaryActionText, { writingDirection: direction }]}>{text.secondary}</Text></Pressable>
        </View>

        <View style={[styles.notice, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Ionicons name="shield-checkmark-outline" size={16} color="#5C6F64" /><Text style={[styles.noticeText, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{text.notice}</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingBottom: 30 },
  topLine: { alignItems: "center", justifyContent: "space-between" },
  brandPill: { alignItems: "center", backgroundColor: "#F1F7F2", borderColor: "#DCEBE0", borderRadius: 999, borderWidth: 1, flexDirection: "row-reverse", gap: 7, paddingHorizontal: 11, paddingVertical: 7 },
  smallLogo: { borderRadius: 7, height: 20, width: 20 },
  brandPillText: { color: "#0B5D45", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  skip: { padding: 8 },
  skipText: { color: "#5C6F64", fontSize: 13, fontWeight: "700" },
  hero: { marginTop: 34, position: "relative" },
  logoHalo: { alignItems: "center", alignSelf: "flex-end", backgroundColor: "#E7F3EA", borderRadius: 42, height: 84, justifyContent: "center", width: 84 },
  logo: { borderRadius: 31, height: 62, width: 62 },
  sparkOne: { backgroundColor: "#F4E7CD", borderRadius: 6, height: 12, position: "absolute", right: 96, top: 9, transform: [{ rotate: "22deg" }], width: 12 },
  sparkTwo: { backgroundColor: "#1A8C68", borderRadius: 4, height: 8, position: "absolute", right: 16, top: 95, transform: [{ rotate: "34deg" }], width: 8 },
  heroTitle: { color: "#17382F", fontSize: 32, fontWeight: "900", letterSpacing: -0.5, lineHeight: 42, marginTop: 24 },
  heroDescription: { color: "#587066", fontSize: 15, lineHeight: 24, marginTop: 13 },
  stepsCard: { backgroundColor: "#FFFFFF", borderColor: "#DFEAE1", borderRadius: 24, borderWidth: 1, gap: 14, marginTop: 32, padding: 18 },
  stepsTitle: { color: "#17382F", fontSize: 15, fontWeight: "900", marginBottom: 2 },
  stepRow: { alignItems: "center", gap: 11 },
  stepNumber: { alignItems: "center", backgroundColor: "#EAF6ED", borderRadius: 12, height: 28, justifyContent: "center", width: 28 },
  stepNumberText: { color: "#0B5D45", fontSize: 12, fontWeight: "900" },
  stepText: { color: "#456157", flex: 1, fontSize: 13, lineHeight: 19 },
  actions: { gap: 10, marginTop: 24 },
  primaryAction: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 16, flexDirection: "row-reverse", gap: 8, justifyContent: "center", minHeight: 54, paddingHorizontal: 16 },
  primaryActionText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  secondaryAction: { alignItems: "center", backgroundColor: "#F3F8F4", borderColor: "#D6E8DB", borderRadius: 16, borderWidth: 1, justifyContent: "center", minHeight: 52, paddingHorizontal: 16 },
  secondaryActionText: { color: "#0B5D45", fontSize: 14, fontWeight: "900" },
  notice: { alignItems: "flex-start", gap: 7, marginTop: 20, paddingHorizontal: 6 },
  noticeText: { color: "#65766D", flex: 1, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
