export type SlaDashboardTask = {
  status: string;
  slaDueAt?: Date | string | null;
  dueAt?: Date | string | null;
};

export type SlaDashboardSummary = {
  total: number;
  active: number;
  completed: number;
  overdue: number;
  completedPercent: number;
  overduePercent: number;
  activePercent: number;
};

function percent(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

/** Computes visual SLA metrics using only tasks visible to the signed-in account. */
export function calculateSlaDashboard(tasks: ReadonlyArray<SlaDashboardTask>, now = new Date()): SlaDashboardSummary {
  const visible = tasks.filter((task) => task.status !== "cancelled");
  const completed = visible.filter((task) => task.status === "completed").length;
  const overdue = visible.filter((task) => {
    if (task.status === "completed") return false;
    const dueAt = task.slaDueAt ?? task.dueAt;
    return dueAt ? new Date(dueAt).getTime() < now.getTime() : false;
  }).length;
  const total = visible.length;
  const active = Math.max(total - completed - overdue, 0);
  return {
    total,
    active,
    completed,
    overdue,
    completedPercent: percent(completed, total),
    overduePercent: percent(overdue, total),
    activePercent: percent(active, total),
  };
}
