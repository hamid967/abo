import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_ENABLED_KEY = "abu_mishal_biometric_enabled";
const BIOMETRIC_LOCK_TIMEOUT_KEY = "abu_mishal_biometric_lock_timeout_ms";
export const BIOMETRIC_LOCK_TIMEOUTS = [0, 60_000, 300_000, 900_000, 1_800_000] as const;
export type BiometricLockTimeout = (typeof BIOMETRIC_LOCK_TIMEOUTS)[number];

export type BiometricKind = "face" | "fingerprint" | "iris" | "none";

export type BiometricAvailability = {
  available: boolean;
  kind: BiometricKind;
  label: string;
};

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (Platform.OS === "web") return { available: false, kind: "none", label: "المصادقة البيومترية" };
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const kind = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ? "face"
    : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      ? "fingerprint"
      : types.includes(LocalAuthentication.AuthenticationType.IRIS)
        ? "iris"
        : "none";
  const label = kind === "face" ? "Face ID" : kind === "fingerprint" ? "بصمة الإصبع" : kind === "iris" ? "المصادقة الحيوية" : "المصادقة البيومترية";
  return { available: hasHardware && isEnrolled && kind !== "none", kind, label };
}

export async function isBiometricEnabled(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === "true";
}

export async function getBiometricLockTimeout(): Promise<BiometricLockTimeout> {
  if (Platform.OS === "web") return 0;
  const rawValue = await SecureStore.getItemAsync(BIOMETRIC_LOCK_TIMEOUT_KEY);
  const parsed = Number(rawValue);
  return BIOMETRIC_LOCK_TIMEOUTS.includes(parsed as BiometricLockTimeout) ? parsed as BiometricLockTimeout : 0;
}

export async function setBiometricLockTimeout(timeout: BiometricLockTimeout): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(BIOMETRIC_LOCK_TIMEOUT_KEY, String(timeout));
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (Platform.OS === "web") return;
  if (enabled) await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
  else await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
}

export async function authenticateBiometric(label: string): Promise<{ success: boolean; cancelled: boolean; message?: string }> {
  const availability = await getBiometricAvailability();
  if (!availability.available) return { success: false, cancelled: false, message: "لا توجد بصمة أو ميزة تعرّف حيوي مفعّلة على هذا الجهاز." };
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: `فتح أبو مشعل باستخدام ${label}`,
    promptSubtitle: "تحقق من هويتك للمتابعة بأمان",
    cancelLabel: "إلغاء",
    fallbackLabel: "استخدام رمز الجهاز",
    disableDeviceFallback: false,
  });
  if (result.success) return { success: true, cancelled: false };
  if (result.error === "user_cancel" || result.error === "system_cancel" || result.error === "app_cancel") return { success: false, cancelled: true };
  return { success: false, cancelled: false, message: result.warning || "تعذر التحقق من الهوية. يمكنك استخدام تسجيل الدخول التقليدي." };
}
