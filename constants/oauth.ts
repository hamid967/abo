import * as Linking from "expo-linking";
import Constants from "expo-constants";
import * as ReactNative from "react-native";
import * as SecureStore from "expo-secure-store";

const deepLinkScheme = process.env.EXPO_PUBLIC_DEEP_LINK_SCHEME ?? "abumishaal";

const env = {
  portal: process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.EXPO_PUBLIC_APP_ID ?? "",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme,
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;

export type ExpoGoLoginAttempt = {
  attemptId: string;
  proof: string;
};

const isExpoGo = Constants.appOwnership === "expo";

/**
 * Get the API base URL, deriving from current hostname if not set.
 * Metro runs on 8081, API server runs on 3000.
 * URL pattern: https://PORT-sandboxid.region.domain
 */
export function getApiBaseUrl(): string {
  // If API_BASE_URL is set, use it
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }

  // On web, derive from current hostname by replacing port 8081 with 3000
  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    // Pattern: 8081-sandboxid.region.domain -> 3000-sandboxid.region.domain
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }

  // Fallback to empty (will use relative URL)
  return "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
// Keep the legacy storage key so existing installations retain their local profile.
export const USER_INFO_KEY = "manus-runtime-user-info";
const DEVICE_ID_KEY = "abu-mishal-security-device-id";

async function getSecurityDeviceId(): Promise<string> {
  if (ReactNative.Platform.OS === "web") {
    const existing = typeof localStorage !== "undefined" ? localStorage.getItem(DEVICE_ID_KEY) : null;
    if (existing) return existing;
    const generated = `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (typeof localStorage !== "undefined") localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  }
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated = `${ReactNative.Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};

/**
 * Get the redirect URI for OAuth callback.
 * - Web: uses API server callback endpoint
 * - Native: uses deep link scheme
 */
export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    return `${getApiBaseUrl()}/api/oauth/callback`;
  } else {
    return Linking.createURL("/oauth/callback", {
      scheme: env.deepLinkScheme,
    });
  }
};

export const getLoginUrl = (redirectUri = getRedirectUri()) => {
  const state = encodeState(redirectUri);

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

/**
 * Start OAuth login flow.
 *
 * On native platforms (iOS/Android), open the system browser directly so
 * the OAuth callback returns via deep link to the app.
 *
 * On web, this simply redirects to the login URL.
 *
 * @returns Always null, the callback is handled via deep link.
 */
export async function startOAuthLogin(): Promise<ExpoGoLoginAttempt | null> {
  if (ReactNative.Platform.OS !== "web") {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) throw new Error("نسخة التطبيق غير مرتبطة بخادم تسجيل الدخول. يرجى تحديث التطبيق إلى أحدث إصدار.");
    const deviceId = await getSecurityDeviceId();
    const attemptEndpoint = isExpoGo ? "/api/oauth/expo-go/attempt" : "/api/oauth/native/attempt";
    const response = await fetch(`${baseUrl}${attemptEndpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, platform: ReactNative.Platform.OS }) });
    if (!response.ok) throw new Error("تعذر بدء تسجيل الدخول. حاول مرة أخرى.");
    const attempt = await response.json() as ExpoGoLoginAttempt & { redirectUri?: string; loginUrl?: string };
    const loginUrl = attempt.loginUrl ?? (attempt.redirectUri ? getLoginUrl(attempt.redirectUri) : "");
    if (!loginUrl) throw new Error("لم يُرجع الخادم رابط تسجيل دخول صالحاً.");
    const supported = await Linking.canOpenURL(loginUrl);
    if (!supported) throw new Error("لا يمكن فتح صفحة تسجيل الدخول على هذا الجهاز.");
    await Linking.openURL(loginUrl);
    return { attemptId: attempt.attemptId, proof: attempt.proof };
  }

  const loginUrl = getLoginUrl();

  if (ReactNative.Platform.OS === "web") {
    // On web, just redirect
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    return null;
  }

  return null;
}

export async function completeExpoGoLogin(attempt: ExpoGoLoginAttempt): Promise<{
  status: "pending" | "completed";
  sessionToken?: string;
  user?: { id: number; openId: string; name: string | null; email: string | null; loginMethod: string | null; lastSignedIn: string };
}> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("تعذر الاتصال بخادم تسجيل الدخول.");
  const response = isExpoGo
    ? await fetch(`${baseUrl}/api/oauth/expo-go/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.attemptId, proof: attempt.proof }),
      })
    : await fetch(`${baseUrl}/api/oauth/native/complete?attemptId=${encodeURIComponent(attempt.attemptId)}&proof=${encodeURIComponent(attempt.proof)}`);
  if (response.status === 202) return { status: "pending" };
  if (!response.ok) throw new Error("تعذر إكمال تسجيل الدخول. ابدأ محاولة جديدة.");
  const data = await response.json() as { status: "completed"; app_session_id: string; user: { id: number; openId: string; name: string | null; email: string | null; loginMethod: string | null; lastSignedIn: string } };
  return { status: "completed", sessionToken: data.app_session_id, user: data.user };
}
