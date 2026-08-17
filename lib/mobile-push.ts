import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { requestReminderPermission } from "@/lib/notification-service";

const DEVICE_ID_KEY = "abu-mishal:mobile-push-device-id:v1";

export type MobilePushPreparation =
  | { kind: "ready"; deviceId: string; platform: "ios" | "android"; expoPushToken: string }
  | { kind: "unsupported" | "permission_denied" | "build_required" | "unavailable"; message: string };

async function getStableDeviceId() {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const value = `push-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, value);
  return value;
}

export async function prepareMobilePushRegistration(): Promise<MobilePushPreparation> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return { kind: "unsupported", message: "إشعارات الدفع متاحة على iPhone وAndroid فقط." };
  }
  const granted = await requestReminderPermission();
  if (!granted) return { kind: "permission_denied", message: "لم تمنح إذن الإشعارات للجهاز بعد." };
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    return { kind: "build_required", message: "يتطلب ربط إشعارات الدفع نسخة تطوير أو إنتاج مهيأة لخدمات Apple وGoogle." };
  }
  try {
    const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const deviceId = await getStableDeviceId();
    return { kind: "ready", deviceId, platform: Platform.OS, expoPushToken };
  } catch {
    return { kind: "unavailable", message: "تعذر الحصول على رمز إشعار الدفع حالياً. جرّب بعد التأكد من الاتصال ونسخة التطبيق." };
  }
}

export async function getMobilePushDeviceId() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return undefined;
  return SecureStore.getItemAsync(DEVICE_ID_KEY);
}
