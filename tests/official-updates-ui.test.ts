import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("official updates center", () => {
  const userScreen = readFileSync("app/updates/index.tsx", "utf8");
  const adminScreen = readFileSync("app/admin/official-updates.tsx", "utf8");
  const routes = readFileSync("server/routers.ts", "utf8");

  it("يعرض للمستخدم مواد منشورة فقط مع رابط المصدر الرسمي", () => {
    expect(userScreen).toContain("officialUpdates.listPublished");
    expect(userScreen).toContain("فتح المصدر الرسمي");
    expect(userScreen).toContain("المواد المعتمدة");
  });

  it("يوفر للمراجع جمعاً منفصلاً ومراجعة ثم نشراً واضحاً", () => {
    expect(adminScreen).toContain("جمع الآن");
    expect(adminScreen).toContain("اعتماد للمراجعة النهائية");
    expect(adminScreen).toContain("نشر للمستخدمين");
    expect(adminScreen).toContain("الجمع لا يعني النشر");
  });

  it("يحمي مسارات المصدر والجمع والمراجعة بدور الإدارة", () => {
    expect(routes).toContain("officialUpdates: router");
    expect(routes).toContain("canViewSystemDashboard(ctx.user.role)");
    expect(routes).toContain("REGULATORY_UPDATE_NOT_VERIFIED");
  });
});
