import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "@/components/ui/app-text";

import { BrandMark } from "@/components/brand-mark";
import { ScreenContainer } from "@/components/screen-container";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useLocale } from "@/lib/locale-provider";

const INTRO_SEEN_KEY = "abu-mishal:intro-seen:v1";

export default function WelcomeScreen() {
  const router = useRouter();
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const { isArabic, direction } = useLocale();
  const motion = useReducedMotion();
  const [ready, setReady] = useState(preview === "1");
  const entrance = useRef(new Animated.Value(0)).current;
  const isPreview = preview === "1";
  const text = isArabic
    ? {
        eyebrow: "أبو مشعل",
        title: "معاملاتك… أوضح وأسرع.",
        description: "مساحة متابعة مستقلة تساعدك على تنظيم طلباتك ومتطلباتها ومواعيدها في تجربة واحدة هادئة وواضحة.",
        primary: "ابدأ طلباً جديداً",
        secondary: "تسجيل الدخول والمتابعة",
        stepsTitle: "كيف يساعدك أبو مشعل؟",
        steps: ["أنشئ طلبك بمتطلبات واضحة", "تابع الحالة والمواعيد من مكان واحد", "اسأل المساعد أو تواصل مع فريق الدعم"],
        journeyTitle: "مسار معاملتك بوضوح",
        journey: ["تم الاستلام", "مراجعة المستندات", "تم التقديم", "تحت الإجراء", "مكتملة"],
        audiences: [{ title: "للأفراد", body: "متابعة هادئة للمواعيد والمتطلبات." }, { title: "للمنشآت", body: "تنظيم معاملات وطلبات فريقك في مكان واحد." }],
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
        journeyTitle: "Your transaction journey",
        journey: ["Received", "Documents reviewed", "Submitted", "In progress", "Completed"],
        audiences: [{ title: "For individuals", body: "Calm tracking for your dates and requirements." }, { title: "For organisations", body: "Keep team requests and transactions in one place." }],
        notice: "Abu Mishal is an independent platform and does not represent any government entity.",
      };

  useEffect(() => {
    if (isPreview) return;
    void AsyncStorage.getItem(INTRO_SEEN_KEY).then((seen) => {
      if (seen === "true") {
        router.replace("/(tabs)" as never);
        return;
      }
      setReady(true);
    });
  }, [isPreview, router]);

  useEffect(() => {
    if (!ready || !motion.isReady) return;
    if (motion.reducedMotion) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    Animated.timing(entrance, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [entrance, motion.isReady, motion.reducedMotion, ready]);

  const finishIntro = (destination: "/(tabs)" | "/request/new" | "/account") => {
    if (!isPreview) void AsyncStorage.setItem(INTRO_SEEN_KEY, "true");
    router.replace(destination as never);
  };

  if (!ready || !motion.isReady) return <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" />;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
      <Animated.View style={{ flex: 1, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [motion.reducedMotion ? 0 : 12, 0] }) }] }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.topLine, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
          <View style={styles.brandPill}><BrandMark size={22} accessibilityLabel="شعار أبو مشعل" /><Text style={[styles.brandPillText, { writingDirection: direction }]}>{text.eyebrow}</Text></View>
          <Pressable onPress={() => finishIntro("/(tabs)")} style={({ pressed }) => [styles.skip, pressed && (motion.reducedMotion ? styles.pressedReduced : styles.pressed)]}><Text style={[styles.skipText, { writingDirection: direction }]}>{isArabic ? "تخطي" : "Skip"}</Text></Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.logoHalo}><BrandMark size={126} accessibilityLabel="شعار أبو مشعل" /></View>
          <View style={styles.sparkOne} /><View style={styles.sparkTwo} />
          <Text style={[styles.heroTitle, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{text.title}</Text>
          <Text style={[styles.heroDescription, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{text.description}</Text>
        </View>

        <View style={styles.journeyCard}>
          <Text style={[styles.journeyTitle, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{text.journeyTitle}</Text>
          <View style={[styles.journeyTrack, { flexDirection: isArabic ? "row-reverse" : "row" }]}>{text.journey.map((step, index) => <View key={step} style={styles.journeyStep}><View style={[styles.journeyDot, index === text.journey.length - 1 && styles.journeyDotComplete]}><Ionicons name={index === text.journey.length - 1 ? "checkmark" : "ellipse"} size={index === text.journey.length - 1 ? 12 : 7} color="#FFFFFF" /></View><Text numberOfLines={2} style={[styles.journeyText, { writingDirection: direction }]}>{step}</Text></View>)}</View>
        </View>

        <View style={styles.stepsCard}>
          <Text style={[styles.stepsTitle, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{text.stepsTitle}</Text>
          {text.steps.map((step, index) => <View key={step} style={[styles.stepRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View><Text style={[styles.stepText, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{step}</Text></View>)}
        </View>

        <View style={[styles.audienceRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}>{text.audiences.map((audience) => <View key={audience.title} style={styles.audienceCard}><Ionicons name={audience.title.includes("منش") || audience.title.includes("organ") ? "business-outline" : "person-outline"} size={18} color="#116B57" /><Text style={[styles.audienceTitle, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{audience.title}</Text><Text style={[styles.audienceBody, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{audience.body}</Text></View>)}</View>

        <View style={styles.actions}>
          <Pressable onPress={() => finishIntro("/request/new")} style={({ pressed }) => [styles.primaryAction, pressed && (motion.reducedMotion ? styles.pressedReduced : styles.pressed)]}><Text style={[styles.primaryActionText, { writingDirection: direction }]}>{text.primary}</Text><Ionicons name={isArabic ? "arrow-back" : "arrow-forward"} size={18} color="#FFFFFF" /></Pressable>
          <Pressable onPress={() => finishIntro("/account")} style={({ pressed }) => [styles.secondaryAction, pressed && (motion.reducedMotion ? styles.pressedReduced : styles.pressed)]}><Text style={[styles.secondaryActionText, { writingDirection: direction }]}>{text.secondary}</Text></Pressable>
        </View>

        <View style={[styles.notice, { flexDirection: isArabic ? "row-reverse" : "row" }]}><Ionicons name="shield-checkmark-outline" size={16} color="#5C6F64" /><Text style={[styles.noticeText, { writingDirection: direction, textAlign: isArabic ? "right" : "left" }]}>{text.notice}</Text></View>
      </ScrollView>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingBottom: 30 },
  topLine: { alignItems: "center", justifyContent: "space-between" },
  brandPill: { alignItems: "center", backgroundColor: "#F1F7F2", borderColor: "#B8E1D0", borderRadius: 999, borderWidth: 1, flexDirection: "row-reverse", gap: 7, paddingHorizontal: 11, paddingVertical: 7 },
  brandPillText: { color: "#0B5D45", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  skip: { padding: 8 },
  skipText: { color: "#5C6F64", fontSize: 13, fontWeight: "700" },
  hero: { marginTop: 34, position: "relative" },
  logoHalo: { alignItems: "center", alignSelf: "center", backgroundColor: "#0B5D45", borderColor: "#D9B45B", borderRadius: 72, borderWidth: 1, elevation: 12, height: 144, justifyContent: "center", shadowColor: "#38C99B", shadowOpacity: 0.34, shadowRadius: 24, width: 144 },
  sparkOne: { backgroundColor: "#F4E7CD", borderRadius: 6, height: 12, position: "absolute", right: 96, top: 9, transform: [{ rotate: "22deg" }], width: 12 },
  sparkTwo: { backgroundColor: "#1A8C68", borderRadius: 4, height: 8, position: "absolute", right: 16, top: 95, transform: [{ rotate: "34deg" }], width: 8 },
  heroTitle: { color: "#17382F", fontSize: 32, fontWeight: "900", letterSpacing: -0.5, lineHeight: 42, marginTop: 24 },
  heroDescription: { color: "#587066", fontSize: 15, lineHeight: 24, marginTop: 13 },
  journeyCard: { backgroundColor: "#0B3B31", borderRadius: 24, marginTop: 26, padding: 18 },
  journeyTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  journeyTrack: { justifyContent: "space-between", marginTop: 16 },
  journeyStep: { alignItems: "center", flex: 1 },
  journeyDot: { alignItems: "center", backgroundColor: "#38C99B", borderRadius: 12, height: 24, justifyContent: "center", width: 24 },
  journeyDotComplete: { backgroundColor: "#C99A46" },
  journeyText: { color: "#D7EBE1", fontSize: 9, lineHeight: 13, marginTop: 7, textAlign: "center" },
  stepsCard: { backgroundColor: "#FFFFFF", borderColor: "#DFEAE1", borderRadius: 24, borderWidth: 1, gap: 14, marginTop: 32, padding: 18 },
  stepsTitle: { color: "#17382F", fontSize: 15, fontWeight: "900", marginBottom: 2 },
  stepRow: { alignItems: "center", gap: 11 },
  stepNumber: { alignItems: "center", backgroundColor: "#EAF6ED", borderRadius: 12, height: 28, justifyContent: "center", width: 28 },
  stepNumberText: { color: "#0B5D45", fontSize: 12, fontWeight: "900" },
  stepText: { color: "#456157", flex: 1, fontSize: 13, lineHeight: 19 },
  audienceRow: { gap: 10, marginTop: 12 },
  audienceCard: { backgroundColor: "#FFFFFF", borderColor: "#E9DFCF", borderRadius: 18, borderWidth: 1, flex: 1, padding: 13 },
  audienceTitle: { color: "#17382F", fontSize: 12, fontWeight: "900", marginTop: 8 },
  audienceBody: { color: "#58635F", fontSize: 10, lineHeight: 16, marginTop: 4 },
  actions: { gap: 10, marginTop: 24 },
  primaryAction: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 16, flexDirection: "row-reverse", gap: 8, justifyContent: "center", minHeight: 54, paddingHorizontal: 16 },
  primaryActionText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  secondaryAction: { alignItems: "center", backgroundColor: "#F3F8F4", borderColor: "#D6E8DB", borderRadius: 16, borderWidth: 1, justifyContent: "center", minHeight: 52, paddingHorizontal: 16 },
  secondaryActionText: { color: "#0B5D45", fontSize: 14, fontWeight: "900" },
  notice: { alignItems: "flex-start", gap: 7, marginTop: 20, paddingHorizontal: 6 },
  noticeText: { color: "#65766D", flex: 1, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  pressedReduced: { opacity: 0.82 },
});
