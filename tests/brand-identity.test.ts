import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const expoConfig = readFileSync("app.config.js", "utf8");
const welcomeScreen = readFileSync("app/welcome.tsx", "utf8");
const brandMark = readFileSync("components/brand-mark.tsx", "utf8");

describe("هوية أبو مشعل", () => {
  it("تستخدم علامة التطبيق الجديدة في أيقونة التطبيق وواجهة الويب وشاشة الإقلاع", () => {
    expect(expoConfig).toContain('icon: "./assets/images/abu-mishal-brand-icon.png"');
    expect(expoConfig).toContain('foregroundImage: "./assets/images/abu-mishal-brand-icon.png"');
    expect(expoConfig).toContain('favicon: "./assets/images/abu-mishal-brand-icon.png"');
    expect(expoConfig).toContain('image: "./assets/images/abu-mishal-brand-icon.png"');
  });

  it("يعيد استخدام مكوّن العلامة في شاشة الترحيب بدلاً من أصل منفصل", () => {
    expect(brandMark).toContain('abu-mishal-brand-icon.png');
    expect(welcomeScreen).toContain('import { BrandMark } from "@/components/brand-mark"');
    expect(welcomeScreen.match(/<BrandMark/g)).toHaveLength(2);
  });
});
