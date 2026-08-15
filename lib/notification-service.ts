import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { GovernmentTransaction } from "@/lib/transactions";
import { canScheduleReminder, getReminderTriggerDate, ReminderSettings } from "@/lib/reminders";

const DEADLINE_CHANNEL_ID = "government-deadlines";

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
    lightColor: "#0B5CAD",
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
  if (!reminder?.enabled || transaction.status === "completed" || !canScheduleReminder(transaction.dueDate, reminder.daysBefore, reminder.hour, reminder.minute)) {
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
      title: "تذكير بموعد معاملة حكومية",
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
