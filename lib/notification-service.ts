import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { taskAlertTriggerAt, type TaskAlertCandidate } from "@/lib/task-alert-policy";
import { GovernmentTransaction, isTerminalStatus } from "@/lib/transactions";
import { canScheduleReminder, getReminderTriggerDate, ReminderSettings } from "@/lib/reminders";

const DEADLINE_CHANNEL_ID = "government-deadlines";
const TASK_ALERTS_CHANNEL_ID = "task-sla-alerts";
const TASK_ALERT_NOTIFICATION_IDS_KEY = "abu-mishal:task-alert-notification-ids:v1";
const MAX_SCHEDULED_TASK_ALERTS = 30;

export type ReminderPermissionState = "granted" | "denied" | "unsupported";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function configureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DEADLINE_CHANNEL_ID, {
    name: "مواعيد المعاملات",
    description: "تنبيهات محلية لمواعيد انتهاء ومتابعة المعاملات الحكومية",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 150, 200],
    lightColor: "#0B5D45",
  });
}

async function configureTaskAlertsChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(TASK_ALERTS_CHANNEL_ID, {
    name: "تنبيهات مهام SLA",
    description: "تذكيرات محلية للمهام قبل انتهاء وقت المتابعة",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 140, 220],
    lightColor: "#D88712",
  });
}

export async function getReminderPermissionStatus(): Promise<ReminderPermissionState> {
  if (Platform.OS === "web") return "unsupported";
  const permissions = await Notifications.getPermissionsAsync();
  return permissions.granted ? "granted" : "denied";
}

export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  await configureAndroidChannel();
  await configureTaskAlertsChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function cancelTransactionReminder(reminder?: ReminderSettings) {
  if (Platform.OS === "web" || !reminder?.notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
}

export async function scheduleTransactionReminder(transaction: GovernmentTransaction): Promise<ReminderSettings | undefined> {
  const reminder = transaction.reminder;
  if (!reminder?.enabled || isTerminalStatus(transaction.status) || !canScheduleReminder(transaction.dueDate, reminder.daysBefore, reminder.hour, reminder.minute)) {
    return reminder ? { ...reminder, notificationId: undefined } : undefined;
  }
  if (Platform.OS === "web") return { ...reminder, notificationId: undefined };
  const permissionGranted = await getReminderPermissionStatus();
  if (permissionGranted !== "granted") return { ...reminder, notificationId: undefined };
  const triggerDate = getReminderTriggerDate(transaction.dueDate!, reminder.daysBefore, reminder.hour, reminder.minute);
  if (!triggerDate) return { ...reminder, notificationId: undefined };
  await configureAndroidChannel();
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "تذكير من أبو مشعل",
      body: `موعد متابعة «${transaction.title}» هو ${transaction.dueDate}.`,
      data: { transactionId: transaction.id },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: Platform.OS === "android" ? DEADLINE_CHANNEL_ID : undefined,
    },
  });
  return { ...reminder, notificationId };
}

type StoredTaskAlert = { taskId: number; notificationId: string; triggerAt: string };
type TaskAlertInput = TaskAlertCandidate & { title: string };

async function readTaskAlertIds() {
  const raw = await AsyncStorage.getItem(TASK_ALERT_NOTIFICATION_IDS_KEY);
  if (!raw) return [] as StoredTaskAlert[];
  try {
    const parsed = JSON.parse(raw) as StoredTaskAlert[];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item?.taskId === "number" && typeof item?.notificationId === "string") : [];
  } catch {
    return [] as StoredTaskAlert[];
  }
}

export async function syncTaskSlaAlerts(input: { tasks: TaskAlertInput[]; enabled: boolean; reminderMinutes: number; now?: Date }) {
  if (Platform.OS === "web") return { scheduled: 0, cancelled: 0, unsupported: true } as const;
  const stored = await readTaskAlertIds();
  const permission = await getReminderPermissionStatus();
  const now = input.now ?? new Date();
  const eligible = input.enabled && permission === "granted"
    ? input.tasks.map((task) => ({ task, triggerAt: taskAlertTriggerAt(task, input.reminderMinutes, now) })).filter((item): item is { task: TaskAlertInput; triggerAt: Date } => Boolean(item.triggerAt)).sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime()).slice(0, MAX_SCHEDULED_TASK_ALERTS)
    : [];
  let cancelled = 0;
  for (const item of stored) {
    await Notifications.cancelScheduledNotificationAsync(item.notificationId).catch(() => undefined);
    cancelled += 1;
  }
  if (!eligible.length) {
    await AsyncStorage.removeItem(TASK_ALERT_NOTIFICATION_IDS_KEY);
    return { scheduled: 0, cancelled, unsupported: false } as const;
  }
  await configureTaskAlertsChannel();
  const nextStored: StoredTaskAlert[] = [];
  for (const { task, triggerAt } of eligible) {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "تنبيه مهمة من أبو مشعل",
        body: `اقترب موعد المهمة «${task.title}».`,
        data: { url: "/task-tracking", taskId: String(task.id) },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerAt,
        channelId: Platform.OS === "android" ? TASK_ALERTS_CHANNEL_ID : undefined,
      },
    });
    nextStored.push({ taskId: task.id, notificationId, triggerAt: triggerAt.toISOString() });
  }
  await AsyncStorage.setItem(TASK_ALERT_NOTIFICATION_IDS_KEY, JSON.stringify(nextStored));
  return { scheduled: nextStored.length, cancelled, unsupported: false } as const;
}
