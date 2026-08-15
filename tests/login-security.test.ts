import { describe, expect, it } from "vitest";
import { classifyLoginSecurity, formatLoginSecurityAlert, normalizeDeviceId } from "../server/login-security";

describe("login security classification", () => {
  it("does not alert on the first known-device registration", () => {
    const result = classifyLoginSecurity([], "device-a", "network-a");
    expect(result.isNewDevice).toBe(true);
    expect(result.isUnusualNetwork).toBe(false);
  });

  it("alerts when a second device appears", () => {
    const result = classifyLoginSecurity([{ id: "device-a", networkFingerprint: "network-a" }], "device-b", "network-a");
    expect(result.isNewDevice).toBe(true);
    expect(result.isUnusualNetwork).toBe(false);
  });

  it("alerts when a known device uses an unfamiliar network", () => {
    const result = classifyLoginSecurity([{ id: "device-a", networkFingerprint: "network-a" }], "device-a", "network-b");
    expect(result.isNewDevice).toBe(false);
    expect(result.isUnusualNetwork).toBe(true);
  });

  it("does not expose raw device or network values in the alert", () => {
    const alert = formatLoginSecurityAlert({ isNewDevice: true, isUnusualNetwork: true, platform: "ios" });
    expect(alert.body).toContain("جهاز وشبكة جديدان");
    expect(JSON.stringify(alert)).not.toContain("network-a");
    expect(normalizeDeviceId(null, "ios", "Safari")).toBe("ios:Safari");
  });
});
