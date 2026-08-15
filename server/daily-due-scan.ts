import * as db from "./db";
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";

const SAUDI_OFFSET_MS = 3 * 60 * 60 * 1000;

export function getSaudiDayWindow(now = new Date()) {
  const saudi = new Date(now.getTime() + SAUDI_OFFSET_MS);
  const start = new Date(Date.UTC(saudi.getUTCFullYear(), saudi.getUTCMonth(), saudi.getUTCDate()) - SAUDI_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, key: saudi.toISOString().slice(0, 10) };
}

export function getDailyDueNotification(candidate: db.DailyDueCandidate, now = new Date()) {
  const { start } = getSaudiDayWindow(now);
  const overdue = candidate.dueAt.getTime() < start.getTime();
  const labels = { request: "طلب", transaction: "معاملة", appointment: "موعد" };
  const kind = labels[candidate.resourceType];
  return {
    title: overdue ? `تذكير: ${kind} متأخر` : `تذكير: ${kind} اليوم`,
    body: overdue ? `«${candidate.title}» يحتاج إلى متابعة؛ موعده كان ${candidate.dueAt.toLocaleDateString("ar-SA")}.` : `«${candidate.title}» موعده اليوم. راجع التفاصيل واتخذ الإجراء المناسب.`,
    type: "daily_due_date",
    data: { source: "daily_due_scan", resourceType: candidate.resourceType, resourceId: candidate.resourceId, dueAt: candidate.dueAt.toISOString(), urgency: overdue ? "overdue" : "today" },
  };
}

export function shouldPromptInactiveDraft(lastActivityAt: Date, now = new Date()) {
  return now.getTime() - lastActivityAt.getTime() >= 72 * 60 * 60 * 1000;
}

export async function runInactiveDraftScan(now = new Date()) {
  const window = getSaudiDayWindow(now);
  const candidates = await db.listInactiveDraftCandidates(new Date(now.getTime() - 72 * 60 * 60 * 1000));
  let created = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    if (!shouldPromptInactiveDraft(candidate.lastActivityAt, now)) continue;
    const key = { recipientUserId: candidate.recipientUserId, resourceType: "draft_inactive", resourceId: candidate.conversationId, notifiedForDate: window.key };
    const reserved = await db.reserveDailyDueNotification(key);
    if (!reserved) { skipped += 1; continue; }
    try {
      const notificationId = await db.createInAppNotification({ recipientUserId: candidate.recipientUserId, title: "لديك مسودة بانتظار الاستكمال", body: "يمكنك العودة إلى المساعد التنفيذي لاستكمال بيانات الطلب أو طلب تحويله لفريق المتابعة.", type: "draft_inactive", data: { conversationId: candidate.conversationId, source: "daily_due_scan" } });
      await db.finalizeDailyDueNotification({ ...key, notificationId: Number(notificationId) });
      created += 1;
    } catch (error) {
      await db.releaseDailyDueNotification(key);
      throw error;
    }
  }
  return { scanned: candidates.length, created, skipped };
}

export async function runDailyDueScan(now = new Date()) {
  const window = getSaudiDayWindow(now);
  const candidates = await db.listDailyDueCandidates(window.end);
  let created = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    const key = { recipientUserId: candidate.recipientUserId, resourceType: candidate.resourceType, resourceId: candidate.resourceId, notifiedForDate: window.key };
    const reserved = await db.reserveDailyDueNotification(key);
    if (!reserved) { skipped += 1; continue; }
    try {
      const notification = getDailyDueNotification(candidate, now);
      const notificationId = await db.createInAppNotification({ recipientUserId: candidate.recipientUserId, ...notification });
      await db.finalizeDailyDueNotification({ ...key, notificationId: Number(notificationId) });
      created += 1;
    } catch (error) {
      await db.releaseDailyDueNotification(key);
      throw error;
    }
  }
  const inactive = await runInactiveDraftScan(now);
  return { day: window.key, scanned: candidates.length, created, skipped, inactive };
}

export async function handleDailyDueScan(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    taskUid = user.taskUid;
    const schedule = await db.getDailyDueScanSchedule();
    if (!schedule || !schedule.enabled || schedule.heartbeatTaskUid !== taskUid) return res.json({ ok: true, skipped: "disabled_or_orphan" });
    const result = await runDailyDueScan();
    await db.updateDailyDueScanRun({ success: true, summary: result });
    return res.json({ ok: true, ...result });
  } catch (error) {
    const details = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
    await db.updateDailyDueScanRun({ success: false, summary: { error: details.message, taskUid: taskUid ?? null } }).catch(() => undefined);
    return res.status(500).json({ error: "daily_due_scan_failed", context: { taskUid: taskUid ?? null, url: req.originalUrl }, details, timestamp: new Date().toISOString() });
  }
}
