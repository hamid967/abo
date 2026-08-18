import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useEffect, useRef, useState } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import {
  completeExpoGoLogin,
  type ExpoGoLoginAttempt,
  startOAuthLogin,
} from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  authenticateBiometric,
  getBiometricAvailability,
  isBiometricEnabled,
  setBiometricEnabled,
  type BiometricAvailability,
} from "@/lib/biometric-auth";

export default function AccountScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isAccountLoading, logout, refresh, role } =
    useAccount();
  const [loginAttempt, setLoginAttempt] = useState<ExpoGoLoginAttempt | null>(
    null,
  );
  const [isStartingLogin, setIsStartingLogin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricInfo, setBiometricInfo] = useState<BiometricAvailability>({
    available: false,
    kind: "none",
    label: "المصادقة البيومترية",
  });
  const [biometricBusy, setBiometricBusy] = useState(false);
  const motion = useReducedMotion();
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;
  const authState = isAccountLoading
    ? "loading"
    : isAuthenticated
      ? "authenticated"
      : loginAttempt
        ? "pending"
        : isStartingLogin
          ? "starting"
          : loginError
            ? "error"
            : "idle";

  useEffect(() => {
    void Promise.all([getBiometricAvailability(), isBiometricEnabled()]).then(
      ([availability, enabled]) => {
        setBiometricInfo(availability);
        setBiometricEnabledState(enabled && availability.available);
      },
    );
  }, []);

  useEffect(() => {
    if (!motion.isReady) return;
    if (motion.reducedMotion) {
      contentOpacity.setValue(1);
      contentTranslateY.setValue(0);
      return;
    }
    contentOpacity.setValue(0.35);
    contentTranslateY.setValue(8);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    authState,
    contentOpacity,
    contentTranslateY,
    motion.isReady,
    motion.reducedMotion,
  ]);

  useEffect(() => {
    if (!loginAttempt) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const result = await completeExpoGoLogin(loginAttempt);
        if (cancelled) return;
        if (result.status === "pending") {
          timer = setTimeout(() => void poll(), 1500);
          return;
        }
        if (!result.sessionToken || !result.user)
          throw new Error("لم تصل جلسة تسجيل دخول صالحة.");
        await Auth.setSessionToken(result.sessionToken);
        await Auth.setUserInfo({
          ...result.user,
          lastSignedIn: new Date(result.user.lastSignedIn),
        });
        await refresh();
        if (!cancelled) setLoginAttempt(null);
      } catch (error) {
        if (cancelled) return;
        setLoginAttempt(null);
        setLoginError(
          error instanceof Error ? error.message : "تعذر إكمال تسجيل الدخول.",
        );
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [loginAttempt, refresh]);

  async function signIn() {
    if (isStartingLogin || loginAttempt) return;
    setLoginError(null);
    setIsStartingLogin(true);
    try {
      const attempt = await startOAuthLogin();
      if (attempt) setLoginAttempt(attempt);
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "تعذر بدء تسجيل الدخول.",
      );
    } finally {
      setIsStartingLogin(false);
    }
  }
  async function toggleBiometric(enabled: boolean) {
    if (biometricBusy) return;
    if (!biometricInfo.available) {
      setLoginError("فعّل البصمة أو Face ID في إعدادات جهازك أولاً.");
      return;
    }
    setBiometricBusy(true);
    try {
      if (enabled) {
        const result = await authenticateBiometric(biometricInfo.label);
        if (!result.success) {
          if (!result.cancelled)
            setLoginError(result.message || "تعذر تفعيل الدخول البيومتري.");
          return;
        }
      }
      await setBiometricEnabled(enabled);
      setBiometricEnabledState(enabled);
      setLoginError(null);
    } finally {
      setBiometricBusy(false);
    }
  }

  async function signOut() {
    await logout();
    router.replace("/(tabs)");
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.container}>
        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إغلاق شاشة الحساب"
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={22} color="#17382F" />
          </Pressable>
          <View style={styles.navCopy}>
            <Text style={styles.brand}>أبو مشعل</Text>
            <Text style={styles.title}>الحساب والمزامنة</Text>
          </View>
        </View>
        <Animated.View
          style={[
            styles.authContent,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          {isAccountLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#0B5D45" />
            </View>
          ) : isAuthenticated ? (
            <>
              <View style={styles.profile}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={31} color="#0B5D45" />
                </View>
                <Text style={styles.name}>{user?.name || "حساب أبو مشعل"}</Text>
                <Text style={styles.email}>
                  {user?.email || "تم تسجيل الدخول بنجاح"}
                </Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>
                    {(
                      {
                        customer: "عميل",
                        employee: "موظف",
                        supervisor: "مشرف",
                        admin: "مدير",
                        super_admin: "مدير عام",
                      } as Record<string, string>
                    )[role] ?? "عميل"}
                  </Text>
                </View>
              </View>
              <View style={styles.accountSummary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>✓</Text>
                  <Text style={styles.summaryLabel}>الحساب موثّق</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="cloud-done" size={21} color="#0B5D45" />
                  <Text style={styles.summaryLabel}>المزامنة فعّالة</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="shield-checkmark" size={21} color="#0B5D45" />
                  <Text style={styles.summaryLabel}>الجهاز محمي</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/security/activity" as never)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={22}
                  color="#0B5D45"
                />
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>الأجهزة المرتبطة</Text>
                  <Text style={styles.cardBody}>
                    راجع الأجهزة الموثوقة، نشاط الدخول، وأزل أي جهاز لا تعرفه.
                  </Text>
                </View>
                <Ionicons name="chevron-back" size={18} color="#789087" />
              </Pressable>
              <View style={styles.biometricCard}>
                <View style={styles.biometricIcon}>
                  <Ionicons
                    name={
                      biometricInfo.kind === "face"
                        ? "scan-outline"
                        : "finger-print-outline"
                    }
                    size={22}
                    color="#0B5D45"
                  />
                </View>
                <View style={styles.biometricCopy}>
                  <Text style={styles.cardTitle}>دخول أسرع وأكثر أماناً</Text>
                  <Text style={styles.cardBody}>
                    {biometricInfo.available
                      ? `استخدم ${biometricInfo.label} لفتح حسابك عند العودة للتطبيق.`
                      : "فعّل البصمة أو Face ID من إعدادات الجهاز لاستخدام هذه الميزة."}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="تفعيل الدخول البيومتري"
                  value={biometricEnabled}
                  disabled={!biometricInfo.available || biometricBusy}
                  onValueChange={(value) => void toggleBiometric(value)}
                  trackColor={{ false: "#D7E1DA", true: "#9AC8A8" }}
                  thumbColor={biometricEnabled ? "#0B5D45" : "#FFFFFF"}
                />
              </View>
              <Pressable
                onPress={() => void signOut()}
                style={({ pressed }) => [
                  styles.signOut,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="log-out-outline" size={19} color="#B42318" />
                <Text style={styles.signOutText}>تسجيل الخروج</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.center}>
              <View style={styles.loginHero}>
                <View style={styles.avatar}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={34}
                    color="#0B5D45"
                  />
                </View>
                <Text style={styles.welcome}>دخول آمن، ومتابعة من أي جهاز</Text>
                <Text style={styles.description}>
                  {loginAttempt
                    ? "أكمل اختيار الحساب في المتصفح، ثم ارجع إلى التطبيق. سيُربط هذا الجهاز تلقائياً بعد التحقق."
                    : "أنشئ حسابك أو سجّل الدخول من الصفحة الآمنة، ثم نربط جهازك ونزامن معاملاتك دون طلب كلمة المرور داخل التطبيق."}
                </Text>
              </View>
              <View style={styles.loginSteps}>
                <LoginStep
                  icon="person-add-outline"
                  title="الحساب"
                  body="اختيار الحساب أو إنشاء حساب جديد"
                  active={!loginAttempt}
                  complete={Boolean(loginAttempt)}
                />
                <View style={styles.stepLine} />
                <LoginStep
                  icon="shield-checkmark-outline"
                  title="التحقق"
                  body="تأكيد الهوية في المتصفح الآمن"
                  active={Boolean(loginAttempt)}
                  complete={false}
                />
                <View style={styles.stepLine} />
                <LoginStep
                  icon="phone-portrait-outline"
                  title="ربط الجهاز"
                  body="تسجيل الجهاز للمزامنة والتنبيهات"
                  active={false}
                  complete={false}
                />
              </View>
              {isStartingLogin ? (
                <View
                  style={styles.loginPendingCard}
                  accessibilityRole="progressbar"
                >
                  <ActivityIndicator size="small" color="#0B5D45" />
                  <Text style={styles.loginPendingText}>
                    جارٍ فتح صفحة الدخول الآمنة…
                  </Text>
                </View>
              ) : null}
              {loginAttempt ? (
                <View
                  style={styles.loginPendingCard}
                  accessibilityRole="progressbar"
                >
                  <ActivityIndicator size="small" color="#0B5D45" />
                  <Text style={styles.loginPendingText}>
                    بانتظار تأكيد الحساب وربط الجهاز…
                  </Text>
                </View>
              ) : null}
              {loginError ? (
                <View style={styles.loginErrorCard} accessibilityRole="alert">
                  <Ionicons
                    name="alert-circle-outline"
                    size={19}
                    color="#B42318"
                  />
                  <Text style={styles.loginError}>{loginError}</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isStartingLogin
                    ? "جارٍ فتح صفحة تسجيل الدخول"
                    : loginAttempt
                      ? "بانتظار إكمال تسجيل الدخول"
                      : "تسجيل الدخول أو إنشاء حساب"
                }
                disabled={Boolean(loginAttempt) || isStartingLogin}
                onPress={() => void signIn()}
                style={({ pressed }) => [
                  styles.signIn,
                  (pressed || loginAttempt || isStartingLogin) &&
                    styles.pressed,
                ]}
              >
                {loginAttempt || isStartingLogin ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                )}
                <Text style={styles.signInText}>
                  {isStartingLogin
                    ? "جارٍ فتح صفحة الدخول"
                    : loginAttempt
                      ? "بانتظار إكمال الدخول"
                      : "تسجيل الدخول أو إنشاء حساب"}
                </Text>
              </Pressable>
              <View style={styles.trustNote}>
                <Ionicons
                  name="lock-closed-outline"
                  size={15}
                  color="#66756E"
                />
                <Text style={styles.trustText}>
                  اتصال مشفّر · لا نخزن كلمة المرور · تنبيه عند دخول جهاز جديد
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

function LoginStep({
  icon,
  title,
  body,
  active,
  complete,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <View style={styles.loginStep}>
      <View
        style={[
          styles.stepIcon,
          active && styles.stepIconActive,
          complete && styles.stepIconComplete,
        ]}
      >
        <Ionicons
          name={complete ? "checkmark" : icon}
          size={18}
          color={active || complete ? "#FFFFFF" : "#789087"}
        />
      </View>
      <View style={styles.stepCopy}>
        <Text style={[styles.stepTitle, active && styles.stepTitleActive]}>
          {title}
        </Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  authContent: { flex: 1 },
  nav: { alignItems: "center", flexDirection: "row-reverse", gap: 12 },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#F0F4F0",
    borderRadius: 13,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  navCopy: { alignItems: "flex-end", flex: 1 },
  brand: {
    color: "#0B5D45",
    fontSize: 12,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  title: {
    color: "#17382F",
    fontSize: 22,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  loginHero: { alignItems: "center", width: "100%" },
  avatar: {
    alignItems: "center",
    backgroundColor: "#E9F5EC",
    borderRadius: 28,
    height: 62,
    justifyContent: "center",
    width: 62,
  },
  welcome: {
    color: "#17382F",
    fontSize: 21,
    fontWeight: "800",
    marginTop: 16,
    textAlign: "center",
    writingDirection: "rtl",
  },
  description: {
    color: "#66756E",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
    writingDirection: "rtl",
  },
  loginSteps: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DFEAE1",
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 22,
    padding: 14,
    width: "100%",
  },
  loginStep: { alignItems: "center", flexDirection: "row-reverse", gap: 11 },
  stepIcon: {
    alignItems: "center",
    backgroundColor: "#EEF3EF",
    borderRadius: 13,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  stepIconActive: { backgroundColor: "#0B5D45" },
  stepIconComplete: { backgroundColor: "#2D9A64" },
  stepCopy: { alignItems: "flex-end", flex: 1 },
  stepTitle: {
    color: "#65766D",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  stepTitleActive: { color: "#17382F" },
  stepBody: {
    color: "#8B9B93",
    fontSize: 10,
    marginTop: 2,
    textAlign: "right",
  },
  stepLine: {
    backgroundColor: "#DCE8DF",
    height: 13,
    marginRight: 18,
    width: 2,
  },
  trustNote: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 6,
    marginTop: 13,
  },
  trustText: {
    color: "#66756E",
    fontSize: 9,
    textAlign: "center",
    writingDirection: "rtl",
  },
  loginError: {
    color: "#B42318",
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "right",
    writingDirection: "rtl",
  },
  loginErrorCard: {
    alignItems: "center",
    backgroundColor: "#FFF4F2",
    borderColor: "#F2C8C3",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    width: "100%",
  },
  loginPendingCard: {
    alignItems: "center",
    backgroundColor: "#F0F8F2",
    borderColor: "#CDE7D2",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 9,
    marginTop: 16,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  loginPendingText: {
    color: "#0B5D45",
    fontSize: 13,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  signIn: {
    alignItems: "center",
    backgroundColor: "#0B5D45",
    borderRadius: 16,
    flexDirection: "row-reverse",
    gap: 8,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 54,
    paddingHorizontal: 22,
    width: "100%",
  },
  signInText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  profile: { alignItems: "center", marginTop: 34 },
  name: {
    color: "#17382F",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 13,
    writingDirection: "rtl",
  },
  email: {
    color: "#66756E",
    fontSize: 13,
    marginTop: 5,
    writingDirection: "rtl",
  },
  roleBadge: {
    backgroundColor: "#E9F5EC",
    borderRadius: 999,
    marginTop: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  roleText: {
    color: "#0B5D45",
    fontSize: 12,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  accountSummary: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DFEAE1",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    marginTop: 24,
    padding: 13,
  },
  summaryItem: { alignItems: "center", flex: 1, gap: 5 },
  summaryValue: { color: "#0B5D45", fontSize: 18, fontWeight: "900" },
  summaryLabel: {
    color: "#456157",
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
  },
  summaryDivider: { backgroundColor: "#E2EAE4", height: 28, width: 1 },
  card: {
    alignItems: "center",
    backgroundColor: "#F2F8F3",
    borderColor: "#D7E9DB",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 12,
    marginTop: 12,
    padding: 15,
  },
  biometricCard: {
    alignItems: "center",
    backgroundColor: "#F8FBF8",
    borderColor: "#D7E9DB",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 12,
    padding: 13,
  },
  biometricIcon: {
    alignItems: "center",
    backgroundColor: "#E9F5EC",
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  biometricCopy: { alignItems: "flex-end", flex: 1 },
  cardCopy: { alignItems: "flex-end", flex: 1 },
  cardTitle: {
    color: "#17382F",
    fontSize: 14,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  cardBody: {
    color: "#53695E",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  signOut: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row-reverse",
    gap: 7,
    marginTop: 18,
    padding: 10,
  },
  signOutText: {
    color: "#B42318",
    fontSize: 13,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  pressed: { opacity: 0.72 },
});
