import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

import { resolveTaskAlertDueAt, type TaskAlertCandidate } from "@/lib/task-alert-policy";

const TASK_CALENDAR_EVENTS_KEY = "abu-mishal:task-calendar-events:v1";

export type TaskCalendarInput = TaskAlertCandidate & { title: string; description?: string | null };
export type TaskCalendarResult = { success: true; updated: boolean } | { success: false; reason: "unsupported" | "permission_denied" | "no_due_date" | "no_writable_calendar" | "failed" };

type TaskCalendarEventMap = Record<string, string>;

async function readEventMap(): Promise<TaskCalendarEventMap> {
  const raw = await AsyncStorage.getItem(TASK_CALENDAR_EVENTS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as TaskCalendarEventMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function eventDetails(task: TaskCalendarInput, dueAt: Date, reminderMinutes: number) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const safeReminder = Math.min(10_080, Math.max(5, Math.floor(reminderMinutes)));
  return {
    title: `مهمة أبو مشعل: ${task.title}`,
    startDate: dueAt,
    endDate: new Date(dueAt.getTime() + 30 * 60_000),
    timeZone,
    notes: task.description ? `مهمة متابعة في أبو مشعل\n${task.description.slice(0, 500)}` : "مهمة متابعة في أبو مشعل",
    alarms: [{ relativeOffset: -safeReminder }],
  };
}

async function writableCalendarId() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((calendar) => calendar.allowsModifications);
  if (!writable.length) return undefined;
  if (Platform.OS === "ios") {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    if (defaultCalendar.allowsModifications) return defaultCalendar.id;
  }
  return writable[0].id;
}

export async function syncTaskToCalendar(task: TaskCalendarInput, reminderMinutes: number): Promise<TaskCalendarResult> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return { success: false, reason: "unsupported" };
  const dueAt = resolveTaskAlertDueAt(task);
  if (!dueAt) return { success: false, reason: "no_due_date" };
  const available = await Calendar.isAvailableAsync();
  if (!available) return { success: false, reason: "unsupported" };
  const permission = await Calendar.getCalendarPermissionsAsync();
  const granted = permission.status === Calendar.PermissionStatus.GRANTED ? permission : await Calendar.requestCalendarPermissionsAsync();
  if (granted.status !== Calendar.PermissionStatus.GRANTED) return { success: false, reason: "permission_denied" };
  const calendarId = await writableCalendarId();
  if (!calendarId) return { success: false, reason: "no_writable_calendar" };
  const map = await readEventMap();
  const existingId = map[String(task.id)];
  const details = eventDetails(task, dueAt, reminderMinutes);
  try {
    if (existingId) {
      await Calendar.updateEventAsync(existingId, details, {});
      return { success: true, updated: true };
    }
    const eventId = await Calendar.createEventAsync(calendarId, details);
    map[String(task.id)] = eventId;
    await AsyncStorage.setItem(TASK_CALENDAR_EVENTS_KEY, JSON.stringify(map));
    return { success: true, updated: false };
  } catch {
    return { success: false, reason: "failed" };
  }
}
