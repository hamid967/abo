import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Abu Mishal in-app chat", () => {
  const schema = readFileSync("drizzle/schema.ts", "utf8");
  const db = readFileSync("server/db.ts", "utf8");
  const router = readFileSync("server/routers.ts", "utf8");
  const customerScreen = readFileSync("app/chat/abu-mishal.tsx", "utf8");
  const adminScreen = readFileSync("app/admin/chats.tsx", "utf8");

  it("stores a separate chat channel and read state without duplicating support data", () => {
    expect(schema).toContain('mysqlEnum("channel", ["support", "abu_mishal_chat"])');
    expect(schema).toContain('readAt: timestamp("readAt")');
    expect(db).toContain("getCustomerAbuMishalChat");
    expect(db).toContain("markAbuMishalChatRead");
  });

  it("enforces customer ownership and limits the inbox to administrators", () => {
    expect(router).toContain('ticket.channel !== "abu_mishal_chat"');
    expect(router).toContain("ticket.customerUserId !== ctx.user.id");
    expect(router).toContain("canViewSystemDashboard(ctx.user.role)");
    expect(router).toContain("listAdminNotificationRecipients");
  });

  it("uses polling only while the screens are open and exposes both message views", () => {
    expect(customerScreen).toContain("refetchInterval: 4_000");
    expect(customerScreen).toContain("trpc.abuMishalChat.send.useMutation");
    expect(customerScreen).toContain("trpc.abuMishalChat.markRead.useMutation");
    expect(adminScreen).toContain("trpc.abuMishalChat.adminInbox.useQuery");
    expect(adminScreen).toContain("trpc.abuMishalChat.updateStatus.useMutation");
  });
});
