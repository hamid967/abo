export function handoffPriorityForReason(reason: string) {
  const value = reason.toLowerCase();
  if (/(شكوى|complaint|عاجل|urgent|سداد|payment)/i.test(value)) return "high" as const;
  return "normal" as const;
}

export function handoffSubject(language: "ar" | "en") {
  return language === "ar" ? "تحويل من المساعد التنفيذي" : "Executive assistant handoff";
}
