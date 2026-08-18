import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import InAppBrowser from "react-native-inappbrowser-reborn";

import { saveSessionToken } from "./secureSession";

const API_BASE_URL = "https://govtrackapp-juokytrr.manus.space";
const ATTEMPT_KEY = "abu-mishal-native-oauth-attempt";

type NativeAttempt = { attemptId: string; proof: string };
type CompletedLogin = { status: "completed"; app_session_id: string; user: { id: number | null; name: string | null; email: string | null } };

function createDeviceId() {
  return `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function beginNativeLogin() {
  const response = await fetch(`${API_BASE_URL}/api/oauth/native/attempt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: createDeviceId(), platform: Platform.OS }),
  });
  if (!response.ok) throw new Error("تعذر بدء تسجيل الدخول. حاول مرة أخرى.");
  const attempt = await response.json() as NativeAttempt & { loginUrl: string };
  await AsyncStorage.setItem(ATTEMPT_KEY, JSON.stringify({ attemptId: attempt.attemptId, proof: attempt.proof }));
  if (await InAppBrowser.isAvailable()) {
    await InAppBrowser.openAuth(attempt.loginUrl, "abumishaal://oauth/callback", { showTitle: false, enableUrlBarHiding: true, enableDefaultShare: false });
    return;
  }
  throw new Error("لا يتوفر متصفح آمن لتسجيل الدخول على هذا الجهاز.");
}

export async function completeNativeLogin() {
  const rawAttempt = await AsyncStorage.getItem(ATTEMPT_KEY);
  if (!rawAttempt) throw new Error("انتهت محاولة تسجيل الدخول. ابدأ محاولة جديدة.");
  const attempt = JSON.parse(rawAttempt) as NativeAttempt;
  const response = await fetch(`${API_BASE_URL}/api/oauth/native/complete?attemptId=${encodeURIComponent(attempt.attemptId)}&proof=${encodeURIComponent(attempt.proof)}`);
  if (response.status === 202) return { status: "pending" as const };
  if (!response.ok) throw new Error("تعذر إكمال تسجيل الدخول. ابدأ محاولة جديدة.");
  const result = await response.json() as CompletedLogin;
  await saveSessionToken(result.app_session_id);
  await AsyncStorage.removeItem(ATTEMPT_KEY);
  return { status: "completed" as const, user: result.user };
}
