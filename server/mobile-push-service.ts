import * as db from "./db";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: "default";
  priority: "high";
};

type ExpoTicket = { status?: "ok" | "error"; id?: string; message?: string; details?: { error?: string } };

function validExpoPushToken(token: string) {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token);
}

function saudiHour(now: Date) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", hourCycle: "h23" }).format(now));
}

function inQuietHours(preferences: Awaited<ReturnType<typeof db.getNotificationPreferences>>, now: Date) {
  if (!preferences.quietHoursEnabled || preferences.quietStartHour === null || preferences.quietEndHour === null || preferences.quietStartHour === preferences.quietEndHour) return false;
  const hour = saudiHour(now);
  return preferences.quietStartHour < preferences.quietEndHour
    ? hour >= preferences.quietStartHour && hour < preferences.quietEndHour
    : hour >= preferences.quietStartHour || hour < preferences.quietEndHour;
}

export async function createTaskMobileNotification(input: { recipientUserId: number; title: string; body: string; type: string; taskId?: number; data?: Record<string, string> }) {
  const notificationId = await db.createInAppNotification({
    recipientUserId: input.recipientUserId,
    title: input.title,
    body: input.body,
    type: input.type,
    data: { ...(input.data ?? {}), ...(input.taskId ? { taskId: String(input.taskId), url: "/task-tracking" } : {}) },
  });
  if (!notificationId) return { notificationId: undefined, pushed: 0 };
  const preferences = await db.getNotificationPreferences(input.recipientUserId);
  if (!preferences.pushEnabled || !preferences.taskAlertsEnabled || inQuietHours(preferences, new Date())) {
    await db.createPushDeliveryLog({ notificationId, status: "suppressed", idempotencyKey: `push:${notificationId}:suppressed`, details: { reason: !preferences.pushEnabled ? "push_disabled" : !preferences.taskAlertsEnabled ? "task_alerts_disabled" : "quiet_hours" } });
    return { notificationId, pushed: 0 };
  }
  const devices = (await db.listActivePushTokensForUser(input.recipientUserId)).filter((device) => validExpoPushToken(device.expoPushToken));
  if (!devices.length) {
    await db.createPushDeliveryLog({ notificationId, status: "suppressed", idempotencyKey: `push:${notificationId}:no_active_device`, details: { reason: "no_active_device" } });
    return { notificationId, pushed: 0 };
  }
  const messages: PushMessage[] = devices.map((device) => ({ to: device.expoPushToken, title: input.title, body: input.body, data: { url: "/task-tracking", ...(input.taskId ? { taskId: String(input.taskId) } : {}), ...(input.data ?? {}) }, sound: "default", priority: "high" }));
  try {
    const response = await fetch(EXPO_PUSH_ENDPOINT, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(messages) });
    const payload = await response.json().catch(() => ({})) as { data?: ExpoTicket[]; errors?: unknown };
    if (!response.ok || !Array.isArray(payload.data)) {
      await Promise.all(devices.map((device) => db.createPushDeliveryLog({ notificationId, status: "failed", idempotencyKey: `push:${notificationId}:${device.id}`, details: { httpStatus: response.status, errors: payload.errors ?? null } })));
      return { notificationId, pushed: 0 };
    }
    await Promise.all(devices.map(async (device, index) => {
      const ticket = payload.data?.[index];
      const deviceNotRegistered = ticket?.details?.error === "DeviceNotRegistered";
      if (deviceNotRegistered) await db.disableMobilePushDeviceById(device.id);
      await db.createPushDeliveryLog({ notificationId, status: ticket?.status === "ok" ? "queued" : "failed", idempotencyKey: `push:${notificationId}:${device.id}`, details: { ticketId: ticket?.id ?? null, message: ticket?.message ?? null, error: ticket?.details?.error ?? null, deviceDisabled: deviceNotRegistered } });
    }));
    return { notificationId, pushed: payload.data.filter((ticket) => ticket.status === "ok").length };
  } catch (error) {
    await Promise.all(devices.map((device) => db.createPushDeliveryLog({ notificationId, status: "failed", idempotencyKey: `push:${notificationId}:${device.id}`, details: { error: error instanceof Error ? error.message : "push_network_error" } })));
    return { notificationId, pushed: 0 };
  }
}
