import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(testsDirectory, "../drizzle/schema.ts"), "utf8");
const router = readFileSync(join(testsDirectory, "../server/routers.ts"), "utf8");
const db = readFileSync(join(testsDirectory, "../server/db.ts"), "utf8");
const adminScreen = readFileSync(join(testsDirectory, "../app/admin/index.tsx"), "utf8");
const releasesScreen = readFileSync(join(testsDirectory, "../app/admin/mobile-releases.tsx"), "utf8");

describe("mobile release administration", () => {
  it("persists only operational release metadata and an auditable HTTPS download link", () => {
    expect(schema).toContain('mysqlTable("mobile_app_releases"');
    expect(schema).toContain('mysqlEnum("platform", ["android_apk", "android_aab", "ios_ipa"])');
    expect(schema).toContain('mysqlEnum("status", ["pending", "building", "ready", "failed", "archived"])');
    expect(schema).toContain('varchar("downloadUrl", { length: 2048 })');
    expect(db).toContain("export async function listMobileAppReleases()");
    expect(db).toContain("export async function saveMobileAppRelease");
  });

  it("keeps release management admin-only and requires HTTPS links for ready downloads", () => {
    expect(router).toContain("mobileReleases: router({");
    expect(router).toContain("verifiedDownloadUrlSchema");
    expect(router).toContain('new URL(value).protocol === "https:"');
    expect(router).toContain("READY_RELEASE_REQUIRES_DOWNLOAD_URL");
    expect(router).toContain("admin.governance_gaps_viewed");
    expect(router).toContain('"mobile_release.created"');
    expect(router).toContain('"mobile_release.updated"');
    expect(router).toContain("canViewSystemDashboard(ctx.user.role)");
  });

  it("provides a discoverable admin screen with explicit manual release status and download handling", () => {
    expect(adminScreen).toContain('router.push("/admin/mobile-releases" as never)');
    expect(releasesScreen).toContain("لا يصل الرابط تلقائياً من منصة البناء دون تكامل رسمي");
    expect(releasesScreen).toContain("رابط تنزيل HTTPS موثق");
    expect(releasesScreen).toContain("Linking.openURL(item.downloadUrl)");
    expect(releasesScreen).toContain("تنزيل APK");
    expect(releasesScreen).toContain("refreshControl");
  });
});
