export type SlaState = "on_track" | "at_risk" | "critical" | "overdue" | "completed" | "unset";

export type SlaStatus = {
  state: SlaState;
  label: string;
  accessibilityLabel: string;
};

function formatRemaining(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}ي ${hours}س`;
  if (hours) return `${hours}س ${minutes}د`;
  return `${Math.max(1, minutes)}د`;
}

export function getSlaStatus(dueAt?: string, taskStatus?: string, now = new Date()): SlaStatus {
  if (taskStatus === "completed") return { state: "completed", label: "مكتملة ضمن المتابعة", accessibilityLabel: "المهمة مكتملة" };
  if (!dueAt) return { state: "unset", label: "ما تحددت مهلة SLA", accessibilityLabel: "لا توجد مهلة SLA محددة للمهمة" };
  const deadline = new Date(dueAt);
  if (Number.isNaN(deadline.getTime())) return { state: "unset", label: "مهلة SLA غير صالحة", accessibilityLabel: "مهلة SLA غير صالحة" };
  const remaining = deadline.getTime() - now.getTime();
  if (remaining < 0) {
    const value = formatRemaining(Math.abs(remaining));
    return { state: "overdue", label: `متأخرة ${value}`, accessibilityLabel: `المهمة متأخرة عن SLA بمقدار ${value}` };
  }
  const value = formatRemaining(remaining);
  if (remaining <= 2 * 60 * 60 * 1000) return { state: "critical", label: `باقي ${value} · عاجل`, accessibilityLabel: `باقي ${value} على SLA والمهمة عاجلة` };
  if (remaining <= 8 * 60 * 60 * 1000) return { state: "at_risk", label: `باقي ${value}`, accessibilityLabel: `باقي ${value} على SLA والمهمة قريبة الاستحقاق` };
  return { state: "on_track", label: `باقي ${value}`, accessibilityLabel: `باقي ${value} على SLA والمهمة ضمن الوقت` };
}
