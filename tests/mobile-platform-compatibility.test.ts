import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile platform compatibility", () => {
  const config = readFileSync("app.config.ts", "utf8");
  const rootLayout = readFileSync("app/_layout.tsx", "utf8");
  const settings = readFileSync("app/(tabs)/settings.tsx", "utf8");
  const callback = readFileSync("app/oauth/callback.tsx", "utf8");
  const customerChat = readFileSync("app/chat/abu-mishal.tsx", "utf8");
  const adminChat = readFileSync("app/admin/chats.tsx", "utf8");
  const api = readFileSync("lib/_core/api.ts", "utf8");

  it("keeps native configuration compatible with iPad, Android documents, and Face ID", () => {
    expect(config).toContain("supportsTablet: true");
    expect(config).toContain('"expo-document-picker"');
    expect(config).toContain('"expo-local-authentication"');
    expect(config).toContain("faceIDPermission");
    expect(config).toContain("POST_NOTIFICATIONS");
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
  });
});
