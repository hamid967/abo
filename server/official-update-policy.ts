import { createHash } from "node:crypto";

export const ZATCA_OFFICIAL_SOURCE = {
  authorityNameAr: "هيئة الزكاة والضريبة والجمارك",
  authorityNameEn: "Zakat, Tax and Customs Authority",
  sourceName: "أخبار الهيئة الرسمية",
  officialUrl: "https://zatca.gov.sa/en/PortalServices/Pages/SiteMap.aspx",
  feedUrl: "https://zatca.gov.sa/_layouts/15/feed.aspx?xsl=1&web=%2Fen%2FMediaCenter%2FNews&page=34211e9a-1e10-45e1-a168-b8487aff0988&wp=f04716ad-7fbb-438e-9aa8-645527d7ce83&pageurl=%2Fen%2FMediaCenter%2FNews%2FPages%2Fdefault%2Easpx",
} as const;

export type OfficialUpdateType = "system" | "regulation" | "decision" | "circular" | "procedural_guide" | "platform_update" | "deadline" | "new_requirement" | "fees" | "penalty" | "new_service" | "service_change" | "technical_alert" | "general_news" | "other";
export type OfficialUpdateImportance = "low" | "normal" | "high" | "critical";

export type ParsedOfficialRssItem = {
  title: string;
  link: string;
  description: string;
  publishedAt: Date | null;
  checksum: string;
  updateType: OfficialUpdateType;
  importance: OfficialUpdateImportance;
};

export function isOfficialGovernmentUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "gov.sa" || host.endsWith(".gov.sa"));
  } catch {
    return false;
  }
}

function decodeXml(value: string) {
  return value
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

export function classifyOfficialUpdate(title: string, description: string): { updateType: OfficialUpdateType; importance: OfficialUpdateImportance } {
  const text = `${title} ${description}`.toLowerCase();
  if (/penalt|violation|fine|غرام|مخالفة/.test(text)) return { updateType: "penalty", importance: "high" };
  if (/deadline|due date|submit|filing|returns|موعد|مهلة|تقديم/.test(text)) return { updateType: "deadline", importance: "high" };
  if (/criteria|requirement|required|eligib|متطلب|معيار|اشتراط/.test(text)) return { updateType: "new_requirement", importance: "normal" };
  if (/integration|platform|system|e-?invoic|منص[ةة]|ربط|فاتور/.test(text)) return { updateType: "platform_update", importance: "normal" };
  if (/decision|قرار/.test(text)) return { updateType: "decision", importance: "normal" };
  if (/circular|تعميم/.test(text)) return { updateType: "circular", importance: "normal" };
  return { updateType: "general_news", importance: "normal" };
}

export function mayTransitionRegulatoryUpdate(status: string, action: "verify" | "publish" | "reject") {
  if (action === "verify") return ["needs_review", "collected", "processing"].includes(status);
  if (action === "publish") return status === "verified";
  return !["published", "archived"].includes(status);
}

export function checksumOfficialItem(title: string, link: string, publishedAt: Date | null) {
  return createHash("sha256").update(`${title}\u241f${link}\u241f${publishedAt?.toISOString() ?? ""}`).digest("hex");
}

/** XML محدود المصدر: يستخرج عناصر RSS فقط ولا ينفذ HTML أو JavaScript. */
export function parseOfficialRss(xml: string): ParsedOfficialRssItem[] {
  const itemBlocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];
  const seen = new Set<string>();
  const result: ParsedOfficialRssItem[] = [];
  for (const block of itemBlocks.slice(0, 50)) {
    const title = tagValue(block, "title");
    const link = tagValue(block, "link");
    const description = tagValue(block, "description");
    const dateText = tagValue(block, "pubDate");
    const parsedDate = dateText ? new Date(dateText) : null;
    const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    if (!title || !link || !isOfficialGovernmentUrl(link)) continue;
    const checksum = checksumOfficialItem(title, link, publishedAt);
    if (seen.has(checksum)) continue;
    seen.add(checksum);
    const classification = classifyOfficialUpdate(title, description);
    result.push({ title, link, description, publishedAt, checksum, ...classification });
  }
  return result;
}
