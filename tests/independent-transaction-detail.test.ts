import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const router = readFileSync("server/routers.ts", "utf8");
const db = readFileSync("server/db.ts", "utf8");
const detailScreen = readFileSync("native-independent/src/screens/TransactionDetailScreen.tsx", "utf8");

describe("تفاصيل المعاملة في التطبيق المستقل", () => {
  it("يبقي قائمة وتفاصيل الجوال خلف مسارات خادمية محمية وعزل ملكية العميل", () => {
    expect(router).toContain("mobileList: protectedProcedure.query");
    expect(router).toContain("mobileDetail: protectedProcedure.input");
    expect(router).toContain("canAccessCustomerRecord(ctx.user.role, transaction.customerUserId, ctx.user.id)");
    expect(router).toContain("canUpdateStatus: canOperateTransactions(ctx.user.role)");
  });

  it("يسجل تغيير الحالة وسجل العميل قبل إرجاع نجاح التحديث", () => {
    expect(db).toContain("transactionStatusHistory");
    expect(db).toContain("previousStatus: current[0].status");
    expect(db).toContain("nextStatus: input.status");
    expect(db).toContain("customerNote: input.nextAction");
    expect(router).toContain('action: "transaction.status_updated"');
  });

  it("يعرض التفاصيل والسجل ولا يكشف أدوات التحديث إلا للصلاحية القادمة من الخادم", () => {
    expect(detailScreen).toContain("detail.canUpdateStatus ?");
    expect(detailScreen).toContain("api.transactions.updateStatus.mutate");
    expect(detailScreen).toContain("detail.history.map");
    expect(detailScreen).toContain("await Promise.all([load(), refresh()])");
  });
});
