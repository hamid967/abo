export type TodayActionState = {
  itemId: string;
  transactionId: string;
  snoozedUntil?: string;
  dismissedAt?: string;
  updatedAt: string;
};

export function isTodayActionHidden(action: TodayActionState | undefined, now = new Date()) {
  if (!action) return false;
  if (action.dismissedAt) return true;
  if (!action.snoozedUntil) return false;
  const until = new Date(action.snoozedUntil);
  return !Number.isNaN(until.getTime()) && until.getTime() > now.getTime();
}

export function nextDayAtNine(now = new Date()) {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next.toISOString();
}

export function upsertTodayAction(actions: TodayActionState[], action: TodayActionState) {
  const existing = actions.findIndex((item) => item.itemId === action.itemId);
  if (existing === -1) return [action, ...actions];
  return actions.map((item) => item.itemId === action.itemId ? action : item);
}
