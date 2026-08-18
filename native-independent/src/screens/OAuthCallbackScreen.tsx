import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { completeNativeLogin } from "../auth/nativeOAuth";
import { theme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "OAuthCallback">;

export function OAuthCallbackScreen({ navigation, route }: Props) {
  const hasAuthorizationCode = Boolean(route.params?.code);
  const [message, setMessage] = useState(hasAuthorizationCode ? "نتحقق من الهوية بأمان." : "جارٍ انتظار تأكيد الدخول.");
  useEffect(() => {
    if (!route.params?.attempt) return;
    completeNativeLogin().then((result) => {
      if (result.status === "completed") {
        setMessage("تم تسجيل الدخول بنجاح.");
        navigation.reset({ index: 0, routes: [{ name: "Home" }] });
      }
    }).catch((error) => setMessage(error instanceof Error ? error.message : "تعذر إكمال تسجيل الدخول."));
  }, [navigation, route.params?.attempt]);
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{hasAuthorizationCode ? "جارٍ تأكيد الدخول" : "رابط تسجيل الدخول غير مكتمل"}</Text>
      <Text style={styles.description}>{hasAuthorizationCode ? "يتبادل التطبيق رمز التفويض مع خادم أبو مشعل عبر اتصال آمن. لا تُحفظ رموز الجلسات داخل الرابط العميق." : message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  title: { color: theme.colors.foreground, fontSize: 24, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  description: { color: theme.colors.muted, fontSize: 16, lineHeight: 26, marginTop: 12, textAlign: "right", writingDirection: "rtl" },
});
