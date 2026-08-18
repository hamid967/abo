import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const screen = readFileSync("native-independent/src/screens/TransactionIntakeChatScreen.tsx", "utf8");
const assistantApi = readFileSync("native-independent/src/data/executiveAssistant.ts", "utf8");
const router = readFileSync("server/routers.ts", "utf8");

describe("إنشاء المعاملة عبر محادثة التطبيق المستقل", () => {
  it("يستعيد المسودة أو يبدأ جلسة ويعالج الرسائل عبر المسارات الخادمية المحمية", () => {
    expect(assistantApi).toContain("executiveAssistant.start.mutate");
    expect(assistantApi).toContain("executiveAssistant.listDrafts.query");
    expect(assistantApi).toContain("executiveAssistant.sendMessage.mutate");
    expect(assistantApi).toContain("executiveAssistant.updateDraft.mutate");
    expect(router).toContain("executiveAssistant: router");
    expect(router).toContain("start: protectedProcedure");
    expect(router).toContain("sendMessage: protectedProcedure");
  });

  it("يفرض التحقق والموافقات الثلاث قبل إرسال المعاملة ثم يحدّث القائمة", () => {
    expect(screen).toContain("assistantApi.validate(conversationId)");
    expect(screen).toContain("assistantApi.prepareReview(conversationId)");
    expect(screen).toContain('assistantApi.recordConsent(conversationId, "terms")');
    expect(screen).toContain('assistantApi.recordConsent(conversationId, "privacy")');
    expect(screen).toContain('assistantApi.recordConsent(conversationId, "request_submission")');
    expect(screen).toContain("await refresh()");
    expect(screen).toContain('navigation.replace("Transactions")');
  });
});
