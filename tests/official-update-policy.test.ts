import { describe, expect, it } from "vitest";

import { classifyOfficialUpdate, isOfficialGovernmentUrl, mayTransitionRegulatoryUpdate, parseOfficialRss } from "../server/official-update-policy";

describe("official update policy", () => {
  it("يقبل رابطاً حكومياً HTTPS ويرفض الروابط غير الرسمية", () => {
    expect(isOfficialGovernmentUrl("https://zatca.gov.sa/en/MediaCenter/News/Pages/example.aspx")).toBe(true);
    expect(isOfficialGovernmentUrl("https://news.example.com/update")).toBe(false);
    expect(isOfficialGovernmentUrl("http://zatca.gov.sa/news")).toBe(false);
  });

  it("يستخرج عناصر RSS الحكومية ويمنع العناصر المكررة أو غير الرسمية", () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Deadline to submit returns</title><link>https://zatca.gov.sa/en/news/returns</link><description>Businesses must submit returns before the due date.</description><pubDate>Tue, 28 Jul 2026 11:32:42 GMT</pubDate></item>
      <item><title>Deadline to submit returns</title><link>https://zatca.gov.sa/en/news/returns</link><description>Businesses must submit returns before the due date.</description><pubDate>Tue, 28 Jul 2026 11:32:42 GMT</pubDate></item>
      <item><title>Unsafe source</title><link>https://example.com/update</link><description>Ignore</description><pubDate>Tue, 28 Jul 2026 11:32:42 GMT</pubDate></item>
    </channel></rss>`;
    const items = parseOfficialRss(xml);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ updateType: "deadline", importance: "high", link: "https://zatca.gov.sa/en/news/returns" });
    expect(items[0].publishedAt).toBeInstanceOf(Date);
  });

  it("يصنف الغرامات والمتطلبات بوضوح دون استنتاج قانوني", () => {
    expect(classifyOfficialUpdate("Penalty for violation", "A fine applies")).toEqual({ updateType: "penalty", importance: "high" });
    expect(classifyOfficialUpdate("New criteria", "New requirement for taxpayers")).toEqual({ updateType: "new_requirement", importance: "normal" });
  });

  it("لا يسمح بالنشر قبل اعتماد المراجع ويحمي الحالات النهائية", () => {
    expect(mayTransitionRegulatoryUpdate("needs_review", "publish")).toBe(false);
    expect(mayTransitionRegulatoryUpdate("verified", "publish")).toBe(true);
    expect(mayTransitionRegulatoryUpdate("published", "reject")).toBe(false);
    expect(mayTransitionRegulatoryUpdate("needs_review", "reject")).toBe(true);
  });
});
