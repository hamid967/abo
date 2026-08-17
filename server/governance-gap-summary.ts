export type GovernanceGapCategory = "security" | "database";
export type GovernanceGapPriority = "p0" | "p1" | "p2";

export type GovernanceGap = {
  id: string;
  category: GovernanceGapCategory;
  priority: GovernanceGapPriority;
  title: string;
  summary: string;
  nextAction: string;
  report: "SECURITY_GAP_REPORT.md" | "DATABASE_GAP_ANALYSIS.md";
};

const governanceGaps: readonly GovernanceGap[] = [
  {
    id: "migration-governance",
    category: "database",
    priority: "p0",
    title: "حوكمة ترحيلات قاعدة البيانات",
    summary: "يوجد فرق بين ملفات الترحيل المحلية وسجل الترحيلات المسجل في القاعدة؛ لا يثبت فقد بيانات، لكنه يمنع تكرار التغيير بثقة كافية.",
    nextAction: "مطابقة المخطط الفعلي مع الملفات، ثم اعتماد مصدر حقيقة واحد وخطة استعادة قبل الترحيل التالي.",
    report: "DATABASE_GAP_ANALYSIS.md",
  },
  {
    id: "database-rls-boundary",
    category: "security",
    priority: "p0",
    title: "حدود العزل والتفويض",
    summary: "العزل الحالي يطبق في الخادم عبر الدور والملكية، ولا يوجد RLS على قاعدة البيانات الحالية.",
    nextAction: "توثيق شرط الملكية وعضوية المنشأة واختباره مع كل مورد ومسار جديد قبل التوسع.",
    report: "SECURITY_GAP_REPORT.md",
  },
  {
    id: "organization-rbac",
    category: "security",
    priority: "p1",
    title: "مصفوفة صلاحيات المنشآت",
    summary: "الأدوار النظامية محمية، لكن الصلاحيات الدقيقة وحالات العضوية والدعوات لكل منشأة ليست مكتملة بعد.",
    nextAction: "اعتماد مصفوفة فعل/مورد/دور وإضافة اختبارات IDOR للموارد المؤسسية.",
    report: "SECURITY_GAP_REPORT.md",
  },
  {
    id: "document-access-evidence",
    category: "security",
    priority: "p1",
    title: "وصول المستندات وسجل الأدلة",
    summary: "التخزين والرفع والتنزيل المحمي متوفران، لكن سجل العرض والمشاركة المؤقتة وسياسة سبب الوصول لم تكتمل.",
    nextAction: "بناء سياسة وصول ومشاركة مؤقتة وسجل تدقيق قبل توسيع محفظة المستندات.",
    report: "SECURITY_GAP_REPORT.md",
  },
  {
    id: "document-intelligence-schema",
    category: "database",
    priority: "p1",
    title: "بيانات الوثائق الذكية",
    summary: "لا توجد بعد نماذج صفحات ونسخ وحقول مستخرجة مرتبطة بثقة وموافقة معالجة الملف.",
    nextAction: "تصميم ترحيل غير هدّام للمخرجات المرتبطة بالصفحة قبل تفعيل OCR أو تحليل الملفات.",
    report: "DATABASE_GAP_ANALYSIS.md",
  },
  {
    id: "ai-governance",
    category: "security",
    priority: "p1",
    title: "حوكمة معالجة الذكاء الاصطناعي",
    summary: "المساعد النصي مقيد بالمصادر وبوابات للبيانات الحساسة، لكن لا توجد موافقة معالجة ملف أو سجل تكلفة ونسخة Prompt مركزية.",
    nextAction: "إضافة AI Gateway بسياسة موافقة وتعطيل مزود وسجل تكلفة وتقييمات عربية قبل تحليل الملفات.",
    report: "SECURITY_GAP_REPORT.md",
  },
  {
    id: "operations-observability",
    category: "database",
    priority: "p2",
    title: "المراقبة والتقارير المؤسسية",
    summary: "توجد سجلات تدقيق ومؤشرات تشغيل، لكن Feature Flags ومؤشرات تكلفة الذكاء والتقارير القابلة للتصدير ليست ضمن النسخة الحالية.",
    nextAction: "تخطيط جداول مراقبة وإعدادات تشغيل بعد إغلاق أساس الصلاحيات والترحيلات.",
    report: "DATABASE_GAP_ANALYSIS.md",
  },
];

export function getGovernanceGapDashboard() {
  const byPriority = (priority: GovernanceGapPriority) => governanceGaps.filter((gap) => gap.priority === priority).length;
  const byCategory = (category: GovernanceGapCategory) => governanceGaps.filter((gap) => gap.category === category).length;

  return {
    auditBaseline: "مرحلة صفر 2030",
    auditDate: "2026-08-17",
    summary: {
      total: governanceGaps.length,
      p0: byPriority("p0"),
      p1: byPriority("p1"),
      p2: byPriority("p2"),
      security: byCategory("security"),
      database: byCategory("database"),
    },
    gaps: governanceGaps,
  } as const;
}
