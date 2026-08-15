import { FeedbackState } from "@/components/ui/feedback-state";

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <FeedbackState kind="empty" title="لا توجد معاملات بعد" description="أضف معاملتك الأولى ليظهر لك وضعها وموعد متابعتها هنا." actionLabel="إضافة معاملة" onAction={onAdd} />;
}
