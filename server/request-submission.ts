export function formatRequestNumber(requestId: number, year = new Date().getFullYear()) {
  if (!Number.isInteger(requestId) || requestId < 1) throw new Error("INVALID_REQUEST_ID");
  return `AM-${year}-${String(requestId).padStart(6, "0")}`;
}

export function submissionMessage(language: "ar" | "en") {
  return language === "ar"
    ? "تم إنشاء طلبك داخل منصة أبو مشعل. سيبدأ فريق المتابعة بمراجعته، وسنرسل لك التحديث التالي داخل التطبيق."
    : "Your request has been created within Abu Mishal. The follow-up team will review it and send the next update in the app.";
}
