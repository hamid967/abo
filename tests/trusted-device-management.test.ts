import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const db = readFileSync("server/db.ts", "utf8");
const router = readFileSync("server/routers.ts", "utf8");
const activity = readFileSync("app/security/activity.tsx", "utf8");
const account = readFileSync("app/account/index.tsx", "utf8");

describe("trusted device management", () => {
  it("scopes device removal to both the device and authenticated owner", () => {
    expect(db).toContain("forgetLoginSecurityDevice");
    expect(db).toContain("eq(loginSecurityDevices.id, deviceId)");
    expect(db).toContain("eq(loginSecurityDevices.userId, userId)");
    expect(router).toContain("auth.trusted_device_removed");
  });

  it("requires confirmation before removing device trust", () => {
    expect(activity).toContain("Alert.alert");
    expect(activity).toContain("forgetDevice.mutate({ deviceId })");
    expect(activity).toContain("إزالة الثقة");
  });

  it("presents account verification and device linking as one clear flow", () => {
    expect(account).toContain("تسجيل الدخول أو إنشاء حساب");
    expect(account).toContain("ربط الجهاز");
    expect(account).toContain("الأجهزة المرتبطة");
  });
});
