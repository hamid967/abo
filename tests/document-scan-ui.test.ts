import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");

describe("document camera scan", () => {
  const scanScreen = readFileSync(resolve(root, "app/documents/scan.tsx"), "utf8");
  const documentScreen = readFileSync(resolve(root, "app/documents/index.tsx"), "utf8");
  const config = readFileSync(resolve(root, "app.config.js"), "utf8");

  it("keeps camera capture explicit and uploads only after user review", () => {
    expect(scanScreen).toContain("useCameraPermissions");
    expect(scanScreen).toContain("savePhoto");
    expect(scanScreen).toContain("حفظ للمحفظة");
    expect(scanScreen).toContain("أي تحليل ذكي يتطلب موافقتك");
  });

  it("links the document wallet and native config to the scanner", () => {
    expect(documentScreen).toContain('router.push("/documents/scan"');
    expect(config).toContain('"expo-camera"');
    expect(config).toContain("cameraPermission");
  });
});
