import { z } from "zod";

import { ReminderOffsetDays, reminderOffsets } from "./reminders";
import { TransactionStatus, transactionStatuses } from "./transactions";

export function isCalendarIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const statusSchema = z.custom<TransactionStatus>(
  (value) => typeof value === "string" && transactionStatuses.includes(value as TransactionStatus),
  "اختر حالة معاملة صحيحة.",
);

const reminderOffsetSchema = z.custom<ReminderOffsetDays>(
  (value) => typeof value === "number" && reminderOffsets.includes(value as ReminderOffsetDays),
  "اختر فترة تذكير صحيحة.",
);

export const transactionFormSchema = z
  .object({
    title: z.string().trim().min(2, "اكتب اسم المعاملة من حرفين على الأقل.").max(140, "اسم المعاملة طويل أكثر من اللازم."),
    agency: z.string().trim().min(2, "اكتب اسم الجهة من حرفين على الأقل.").max(140, "اسم الجهة طويل أكثر من اللازم."),
    reference: z.string().trim().max(100, "الرقم المرجعي طويل أكثر من اللازم."),
    dueDate: z.string().trim().refine((value) => !value || isCalendarIsoDate(value), "اكتب تاريخاً صحيحاً بصيغة YYYY-MM-DD."),
    notes: z.string().trim().max(1500, "الملاحظات طويلة أكثر من اللازم."),
    status: statusSchema,
    reminderEnabled: z.boolean(),
    reminderDaysBefore: reminderOffsetSchema,
    reminderHour: z.string().regex(/^\d{1,2}$/, "اكتب الساعة بين 00 و23."),
    reminderMinute: z.string().regex(/^\d{1,2}$/, "اكتب الدقيقة بين 00 و59."),
  })
  .superRefine((values, ctx) => {
    if (!values.reminderEnabled) return;
    if (!values.dueDate) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "أضف موعداً أولاً لتفعيل التذكير." });
    }
    const hour = Number(values.reminderHour);
    const minute = Number(values.reminderMinute);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      ctx.addIssue({ code: "custom", path: ["reminderHour"], message: "الساعة من 00 إلى 23." });
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      ctx.addIssue({ code: "custom", path: ["reminderMinute"], message: "الدقيقة من 00 إلى 59." });
    }
  });

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export const transactionFormDefaults: TransactionFormValues = {
  title: "",
  agency: "",
  reference: "",
  dueDate: "",
  notes: "",
  status: "draft",
  reminderEnabled: false,
  reminderDaysBefore: 3,
  reminderHour: "09",
  reminderMinute: "00",
};
