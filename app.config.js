require("./scripts/load-env.cjs");
const fs = require("node:fs");

const rawBundleId = "com.app.governmenttransactionstracker";
const bundleId = rawBundleId
  .replace(/[-_]/g, ".")
  .replace(/[^a-zA-Z0-9.]/g, "")
  .replace(/\.+/g, ".")
  .replace(/^\.+|\.+$/g, "")
  .toLowerCase()
  .split(".")
  .map((segment) => (/^[a-zA-Z]/.test(segment) ? segment : `x${segment}`))
  .join(".") || "space.manus.app";

const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const fcmConfigPath = "./google-services.json";
const hasFcmConfig = fs.existsSync(fcmConfigPath);

/** @type {import("expo/config").ExpoConfig} */
const config = {
  name: "أبو مشعل",
  slug: "government-transactions-tracker",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: `manus${timestamp}`,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: bundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#F5EFE4",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: bundleId,
    ...(hasFcmConfig ? { googleServicesFile: fcmConfigPath } : {}),
    permissions: ["POST_NOTIFICATIONS", "SCHEDULE_EXACT_ALARM", "READ_CALENDAR", "WRITE_CALENDAR"],
    intentFilters: [{
      action: "VIEW",
      autoVerify: true,
      data: [{ scheme: `manus${timestamp}`, host: "*" }],
      category: ["BROWSABLE", "DEFAULT"],
    }],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
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
    ["expo-splash-screen", { image: "./assets/images/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: "#FFFDF7", dark: { backgroundColor: "#102C24" } }],
    ["expo-build-properties", { android: { buildArchs: ["armeabi-v7a", "arm64-v8a"], minSdkVersion: 24 } }],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

module.exports = config;
