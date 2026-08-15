export type ValidationSeverity = "error" | "warning" | "info" | "passed";
export type ValidationResult = { code: string; severity: ValidationSeverity; field?: string; messageAr: string; messageEn: string };

export function validateRequestData(data: Record<string, unknown>, duplicateOpenRequest: boolean): ValidationResult[] {
  const results: ValidationResult[] = [];
  const required: Array<[string, string, string]> = [
    ["beneficiaryType", "صفة المستفيد مطلوبة.", "Beneficiary type is required."],
    ["serviceName", "نوع الخدمة مطلوب.", "Service type is required."],
    ["entityName", "الجهة المرتبطة مطلوبة.", "Reference entity is required."],
    ["title", "عنوان الطلب مطلوب.", "Request title is required."],
    ["description", "وصف الطلب مطلوب.", "Request description is required."],
    ["beneficiaryName", "اسم المستفيد مطلوب قبل المراجعة.", "Beneficiary name is required before review."],
    ["phoneNumber", "رقم الجوال مطلوب قبل المراجعة.", "Mobile number is required before review."],
  ];
  for (const [field, messageAr, messageEn] of required) {
    if (typeof data[field] !== "string" || !String(data[field]).trim()) results.push({ code: "required_field", severity: "error", field, messageAr, messageEn });
  }
  if (typeof data.phoneNumber === "string" && !/^(?:\+966|00966|0)?5\d{8}$/.test(data.phoneNumber.trim())) results.push({ code: "invalid_phone", severity: "error", field: "phoneNumber", messageAr: "تحقق من تنسيق رقم الجوال السعودي.", messageEn: "Check the Saudi mobile number format." });
  if (typeof data.email === "string" && data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) results.push({ code: "invalid_email", severity: "error", field: "email", messageAr: "تحقق من تنسيق البريد الإلكتروني.", messageEn: "Check the email format." });
  if (duplicateOpenRequest) results.push({ code: "possible_duplicate", severity: "warning", messageAr: "يوجد طلب مفتوح مشابه؛ راجع الطلبات قبل الإرسال لتفادي التكرار.", messageEn: "A similar open request exists; review your requests to avoid duplication." });
  if (!data.requestedDate) results.push({ code: "no_requested_date", severity: "info", field: "requestedDate", messageAr: "يمكنك إضافة موعد مطلوب إن كان للخدمة موعد محدد.", messageEn: "You may add a requested date if the service has a fixed deadline." });
  if (!results.some((item) => item.severity === "error" || item.severity === "warning")) results.push({ code: "draft_ready", severity: "passed", messageAr: "البيانات الأساسية جاهزة للمراجعة. ستحتاج موافقة صريحة قبل الإرسال.", messageEn: "Core details are ready for review. Explicit consent is still required before submission." });
  return results;
}

export function validationStatusFromResults(results: ValidationResult[]) {
  if (results.some((result) => result.severity === "error")) return "errors" as const;
  if (results.some((result) => result.severity === "warning")) return "warnings" as const;
  return "passed" as const;
}
