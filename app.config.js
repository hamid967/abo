require("./scripts/load-env.cjs");
const fs = require("node:fs");

const DEFAULT_APPLICATION_ID = "sa.abumishal.app";
const DEFAULT_SCHEME = "abumishaal";

function normalizeApplicationId(value, fallback = DEFAULT_APPLICATION_ID) {
  const normalized = String(value || "")
    .replace(/[-_]/g, ".")
    .replace(/[^a-zA-Z0-9.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase()
    .split(".")
    .filter(Boolean)
    .map((segment) => (/^[a-zA-Z]/.test(segment) ? segment : `x${segment}`))
    .join(".");

  return normalized.split(".").length >= 2 ? normalized : fallback;
}

function normalizeScheme(value, fallback = DEFAULT_SCHEME) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+.-]/g, "");

  return /^[a-z][a-z0-9+.-]*$/.test(normalized) ? normalized : fallback;
}

// Keep these configurable because changing an identifier after publishing creates
// a different app in the stores. Existing releases can retain their identifier
// through the environment while new releases use the Abu Mishal defaults.
const iosBundleIdentifier = normalizeApplicationId(
  process.env.EXPO_IOS_BUNDLE_IDENTIFIER || process.env.EXPO_APPLICATION_ID,
);
const androidPackage = normalizeApplicationId(
  process.env.EXPO_ANDROID_PACKAGE || process.env.EXPO_APPLICATION_ID,
);
const deepLinkScheme = normalizeScheme(process.env.EXPO_DEEP_LINK_SCHEME);
const fcmConfigPath = "./google-services.json";
const hasFcmConfig = fs.existsSync(fcmConfigPath);

/** @type {import("expo/config").ExpoConfig} */
const config = {
  name: "أبو مشعل",
  slug: process.env.EXPO_APP_SLUG || "abu-mishal",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/abu-mishal-brand-icon.png",
  scheme: deepLinkScheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: iosBundleIdentifier,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0B5D45",
      foregroundImage: "./assets/images/abu-mishal-brand-icon.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: androidPackage,
    versionCode: 1,
    ...(hasFcmConfig ? { googleServicesFile: fcmConfigPath } : {}),
    // Calendar permissions are contributed by expo-calendar and requested only
    // when the user invokes that feature. Exact alarms are intentionally omitted.
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [{
      action: "VIEW",
      autoVerify: true,
      data: [{ scheme: deepLinkScheme }],
      category: ["BROWSABLE", "DEFAULT"],
    }],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/abu-mishal-brand-icon.png",
  },
  plugins: [
    "expo-router",
    "expo-asset",
    "expo-web-browser",
    "expo-document-picker",
    ["expo-font", { fonts: ["./assets/fonts/Cairo-Regular.ttf", "./assets/fonts/Cairo-SemiBold.ttf", "./assets/fonts/Cairo-Bold.ttf", "./assets/fonts/Cairo-ExtraBold.ttf"] }],
    ["expo-notifications", { icon: "./assets/images/android-icon-monochrome.png", color: "#0B5D45", defaultChannel: "government-deadlines", enableBackgroundRemoteNotifications: true }],
    ["expo-calendar", { calendarPermission: "يسمح $(PRODUCT_NAME) بإضافة مواعيد المهام إلى تقويمك عند اختيارك ذلك.", remindersPermission: "يسمح $(PRODUCT_NAME) بإضافة تذكيرات المهام إلى جهازك عند اختيارك ذلك." }],
    ["expo-local-authentication", { faceIDPermission: "يسمح $(PRODUCT_NAME) باستخدام Face ID لتسهيل الدخول الآمن إلى حسابك." }],
    ["expo-audio", { microphonePermission: "يسمح $(PRODUCT_NAME) بالوصول إلى الميكروفون عند استخدام ميزات الصوت." }],
    ["expo-camera", { cameraPermission: "يسمح $(PRODUCT_NAME) بتصوير المستندات التي تختار رفعها إلى محفظتك." }],
    ["expo-video", { supportsBackgroundPlayback: true, supportsPictureInPicture: true }],
    ["expo-splash-screen", { image: "./assets/images/abu-mishal-brand-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: "#0B5D45", dark: { backgroundColor: "#071713" } }],
    ["expo-build-properties", { android: { buildArchs: ["armeabi-v7a", "arm64-v8a"], minSdkVersion: 24 } }],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

module.exports = config;
