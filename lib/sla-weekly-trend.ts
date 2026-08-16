export type SlaWeeklyTrendTask = {
  status: string;
  createdAt?: Date | string | null;
  completedAt?: Date | string | null;
};

export type SlaWeeklyTrendPoint = {
  key: string;
  label: string;
  completed: number;
  available: number;
  rate: number;
};

type WeeklyPeriodSummary = {
  rate: number;
  completed: number;
  available: number;
};

export type SlaWeeklyTrend = {
  points: SlaWeeklyTrendPoint[];
  weeklyRate: number;
  completedTotal: number;
  direction: "up" | "down" | "steady";
  delta: number;
  previousWeekRate: number;
  previousCompletedTotal: number;
  previousAvailable: number;
  weekComparisonDirection: "up" | "down" | "steady";
  weekComparisonDelta: number;
  completedDelta: number;
};

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayEnd(date: Date) {
  const end = dayStart(date);
  end.setDate(end.getDate() + 1);
  return end;
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return undefined;
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? undefined : result;
}

function percentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function calculatePeriod(tasks: ReadonlyArray<SlaWeeklyTrendTask>, start: Date, end: Date): WeeklyPeriodSummary {
  const endExclusive = dayEnd(end);
  const available = tasks.filter((task) => {
    if (task.status === "cancelled") return false;
    const createdAt = dateValue(task.createdAt);
    const completedAt = dateValue(task.completedAt);
    return Boolean(createdAt && createdAt.getTime() < endExclusive.getTime() && (!completedAt || completedAt.getTime() >= start.getTime()));
  }).length;
  const completed = tasks.filter((task) => {
    const completedAt = dateValue(task.completedAt);
    return task.status === "completed" && completedAt && completedAt.getTime() >= start.getTime() && completedAt.getTime() < endExclusive.getTime();
  }).length;
  return { available, completed, rate: percentage(completed, available) };
}

/**
 * The daily rate is completed tasks divided by tasks available by that day's end.
 * This avoids implying historical SLA status that has not been stored.
 */
export function calculateSlaWeeklyTrend(tasks: ReadonlyArray<SlaWeeklyTrendTask>, now = new Date()): SlaWeeklyTrend {
  const today = dayStart(now);
  const formatter = new Intl.DateTimeFormat("ar-SA", { weekday: "narrow" });
  const points = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    const period = calculatePeriod(tasks, day, day);
    return { key: day.toISOString().slice(0, 10), label: formatter.format(day), ...period };
  });
  const weekStart = points.length ? new Date(`${points[0].key}T00:00:00`) : today;
  const currentWeek = calculatePeriod(tasks, weekStart, today);
  const previousWeekEnd = new Date(weekStart);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
  const previousWeekStart = new Date(previousWeekEnd);
  previousWeekStart.setDate(previousWeekStart.getDate() - 6);
  const previousWeek = calculatePeriod(tasks, previousWeekStart, previousWeekEnd);
  const completedTotal = currentWeek.completed;
  const comparable = points.filter((point) => point.available > 0);
  const firstRate = comparable[0]?.rate ?? 0;
  const lastRate = comparable.at(-1)?.rate ?? 0;
  const delta = lastRate - firstRate;
  const weekDelta = currentWeek.rate - previousWeek.rate;
  return { points, weeklyRate: currentWeek.rate, completedTotal, direction: delta > 0 ? "up" : delta < 0 ? "down" : "steady", delta: Math.abs(delta), previousWeekRate: previousWeek.rate, previousCompletedTotal: previousWeek.completed, previousAvailable: previousWeek.available, weekComparisonDirection: weekDelta > 0 ? "up" : weekDelta < 0 ? "down" : "steady", weekComparisonDelta: Math.abs(weekDelta), completedDelta: currentWeek.completed - previousWeek.completed };
}
