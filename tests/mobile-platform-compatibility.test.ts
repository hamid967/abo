import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile platform compatibility", () => {
  const config = readFileSync("app.config.js", "utf8");
  const rootLayout = readFileSync("app/_layout.tsx", "utf8");
  const settings = readFileSync("app/(tabs)/settings.tsx", "utf8");
  const callback = readFileSync("app/oauth/callback.tsx", "utf8");
  const customerChat = readFileSync("app/chat/abu-mishal.tsx", "utf8");
  const adminChat = readFileSync("app/admin/chats.tsx", "utf8");
  const api = readFileSync("lib/_core/api.ts", "utf8");
  const authHook = readFileSync("hooks/use-auth.ts", "utf8");
  const taskTracking = readFileSync("app/task-tracking/index.tsx", "utf8");
  const notificationService = readFileSync("lib/notification-service.ts", "utf8");
  const mobilePush = readFileSync("lib/mobile-push.ts", "utf8");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string> };

  it("keeps native configuration compatible with iPad, Android documents, and Face ID", () => {
    expect(config).toContain("supportsTablet: true");
    expect(config).toContain('"expo-asset"');
    expect(config).toContain('"expo-web-browser"');
    expect(config).toContain('"expo-document-picker"');
    expect(config).toContain('"expo-local-authentication"');
    expect(config).toContain("faceIDPermission");
    expect(config).toContain("POST_NOTIFICATIONS");
    expect(config).toContain('"expo-calendar"');
    expect(config).toContain("READ_CALENDAR");
    expect(config).toContain("WRITE_CALENDAR");
    expect(config).toContain("fcmConfigPath");
    expect(config).toContain("googleServicesFile: fcmConfigPath");
    expect(config).toContain("enableBackgroundRemoteNotifications: true");
    expect(config).toContain('icon: "./assets/images/android-icon-monochrome.png"');
    expect(packageJson.dependencies["expo-network"]).toBeDefined();
  });

  it("registers the cross-platform routes and lets long settings content scroll", () => {
    expect(rootLayout).toContain('name="chat/abu-mishal"');
    expect(rootLayout).toContain('name="admin/chats"');
    expect(settings).toContain("ScrollView");
    expect(settings).toContain("keyboardShouldPersistTaps=\"handled\"");
    expect(settings).toContain("maxWidth: 780");
  });

  it("handles warm OAuth links without exposing callback values in logs", () => {
    expect(callback).toContain('Linking.addEventListener("url"');
    expect(callback).toContain("processedCallbackRef");
    expect(callback).not.toContain("code.substring");
    expect(callback).not.toContain("state.substring");
  });

  it("keeps message composers above the native keyboard", () => {
    expect(customerChat).toContain("KeyboardAvoidingView");
    expect(customerChat).toContain('Platform.OS === "ios" ? "padding"');
    expect(adminChat).toContain("KeyboardAvoidingView");
    expect(adminChat).toContain('keyboardShouldPersistTaps="handled"');
  });

  it("does not log OAuth URLs or session token fragments from the API client", () => {
    expect(api).toContain("ApiHttpError");
    expect(api).not.toContain('console.log("[API] Full URL:"');
    expect(api).not.toContain("sessionToken.substring");
    expect(api).not.toContain('console.error("[API] getMe failed:"');
    expect(authHook).not.toContain("sessionToken.substring");
    expect(authHook).not.toContain('console.error("[useAuth] fetchUser error:"');
    expect(authHook).not.toContain('console.error("[Auth] Logout API call failed:"');
  });

  it("renders SLA badges for task list and Kanban tracking", () => {
    const workspace = readFileSync("app/workspace/index.tsx", "utf8");
    expect(workspace).toContain("SlaBadge");
    expect(workspace).toContain("dueAt={task.dueDate}");
  });

  it("keeps task alerts, calendar sync, and push navigation within native-only paths", () => {
    expect(rootLayout).toContain("MobileNotificationObserver");
    expect(settings).toContain("إشعارات الدفع للمهام");
    expect(taskTracking).toContain("syncTaskSlaAlerts");
    expect(taskTracking).toContain("syncTaskToCalendar");
    expect(notificationService).toContain("TASK_ALERTS_CHANNEL_ID");
    expect(notificationService).toContain('url: "/task-tracking"');
    expect(mobilePush).toContain("Platform.OS !== \"ios\" && Platform.OS !== \"android\"");
  });

  it("keeps primary actions and counts visible in the refreshed workspace sections", () => {
    const workspace = readFileSync("app/workspace/index.tsx", "utf8");
    const notifications = readFileSync("app/notifications/index.tsx", "utf8");
    expect(workspace).toContain("summaryCard");
    expect(workspace).toContain("إضافة مهمة جديدة");
    expect(taskTracking).toContain("filterCounts");
    expect(taskTracking).toContain("ListFooterComponent");
    expect(taskTracking).toContain("completionMessage");
    expect(notifications).toContain("viewNotification");
    expect(notifications).toContain("actionRow");
  });
});
