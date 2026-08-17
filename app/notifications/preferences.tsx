import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { getMobilePushDeviceId, prepareMobilePushRegistration } from "@/lib/mobile-push";
import { trpc } from "@/lib/trpc";

const REMINDER_OPTIONS = [{ minutes: 15, label: "15 د" }, { minutes: 30, label: "30 د" }, { minutes: 60, label: "ساعة" }, { minutes: 1_440, label: "يوم" }];
const QUIET_START_OPTIONS = [21, 22, 23, 0];
const QUIET_END_OPTIONS = [6, 7, 8, 9];

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAccount();
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const preferences = trpc.notificationPreferences.get.useQuery(undefined, { enabled: isAuthenticated });
  const logs = trpc.notificationPreferences.deliveryLog.useQuery(undefined, { enabled: isAuthenticated });
  const devices = trpc.mobilePush.devices.useQuery(undefined, { enabled: isAuthenticated });
  const update = trpc.notificationPreferences.update.useMutation({ onSuccess: () => { void preferences.refetch(); void logs.refetch(); } });
  const registerDevice = trpc.mobilePush.register.useMutation({ onSuccess: () => void devices.refetch() });
  const deactivateDevice = trpc.mobilePush.deactivate.useMutation({ onSuccess: () => void devices.refetch() });

  if (!isAuthenticated) return <ScreenContainer style={styles.state}><Text style={styles.stateText}>سجّل دخولك لإدارة تفضيلات الإشعارات.</Text></ScreenContainer>;
  if (!preferences.data) return <ScreenContainer style={styles.state}><ActivityIndicator color="#0B5D45" /></ScreenContainer>;
  const value = preferences.data;
  const busy = update.isPending || registerDevice.isPending || deactivateDevice.isPending;
  const activeDevices = (devices.data ?? []).filter((device) => device.enabled).length;
  const patch = (next: Partial<Pick<typeof value, "inAppEnabled" | "pushEnabled" | "taskAlertsEnabled" | "calendarSyncEnabled" | "taskReminderMinutes" | "digestFrequency" | "quietHoursEnabled" | "quietStartHour" | "quietEndHour">>) => update.mutate({
    inAppEnabled: next.inAppEnabled ?? value.inAppEnabled,
    pushEnabled: next.pushEnabled ?? value.pushEnabled,
    taskAlertsEnabled: next.taskAlertsEnabled ?? value.taskAlertsEnabled,
    calendarSyncEnabled: next.calendarSyncEnabled ?? value.calendarSyncEnabled,
    taskReminderMinutes: next.taskReminderMinutes ?? value.taskReminderMinutes,
    digestFrequency: next.digestFrequency ?? value.digestFrequency,
    quietHoursEnabled: next.quietHoursEnabled ?? value.quietHoursEnabled,
    quietStartHour: next.quietStartHour ?? value.quietStartHour,
    quietEndHour: next.quietEndHour ?? value.quietEndHour,
  });

  async function togglePush(enabled: boolean) {
    if (busy) return;
    setPushMessage(null);
    try {
      if (enabled) {
        const prepared = await prepareMobilePushRegistration();
        if (prepared.kind !== "ready") { setPushMessage(prepared.message); return; }
        await registerDevice.mutateAsync(prepared);
        await update.mutateAsync({ ...value, pushEnabled: true });
        setPushMessage("تم ربط هذا الجهاز بتنبيهات الجوال.");
      } else {
        const deviceId = await getMobilePushDeviceId();
        if (deviceId) await deactivateDevice.mutateAsync({ deviceId });
        await update.mutateAsync({ ...value, pushEnabled: false });
        setPushMessage("تم إيقاف تنبيهات الجوال لهذا الحساب على الجهاز.");
      }
    } catch {
      setPushMessage("ما قدرنا نحدّث تنبيهات الجوال الآن. جرّب مرة ثانية.");
    }
  }

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Pressable accessibilityLabel="إغلاق إعدادات الإشعارات" onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>أبو مشعل · الإشعارات</Text><Text style={styles.title}>خصّص تنبيهاتك</Text><Text style={styles.subtitle}>اختر التنبيهات والقنوات التي تناسب متابعتك.</Text></View></View>

    <View style={styles.summary}><View style={styles.summaryIcon}><Ionicons name="phone-portrait-outline" size={21} color="#0B5D45" /></View><View style={styles.summaryCopy}><Text style={styles.summaryTitle}>{activeDevices ? `${activeDevices} جهاز مرتبط` : "ما فيه جهاز مرتبط"}</Text><Text style={styles.summaryBody}>{value.pushEnabled ? "تنبيهات الجوال مفعّلة لهذا الحساب." : "فعّل تنبيهات الجوال لتصلك تنبيهات المهام على الجهاز."}</Text></View></View>

    <Section title="قنوات الاستلام"><PreferenceRow icon="notifications-outline" label="مركز الإشعارات داخل التطبيق" description="يحفظ سجل التنبيهات ضمن حسابك للمراجعة." value={value.inAppEnabled} disabled={busy} onChange={(inAppEnabled) => patch({ inAppEnabled })} /><PreferenceRow icon="phone-portrait-outline" label="تنبيهات الجوال" description="تنبيهات دفع للمهام والمواعيد على هذا الجهاز. يحتاج نسخة تطوير أو إنتاج." value={value.pushEnabled} disabled={busy} onChange={(enabled) => void togglePush(enabled)} />{pushMessage ? <Text accessibilityRole="alert" style={styles.message}>{pushMessage}</Text> : null}</Section>

    <Section title="أنواع التنبيهات"><PreferenceRow icon="checkbox-outline" label="تنبيهات مهام SLA" description="نبّهني قبل اقتراب موعد المهمة أو عند تأخرها." value={value.taskAlertsEnabled} disabled={busy} onChange={(taskAlertsEnabled) => patch({ taskAlertsEnabled })} /><PreferenceRow icon="calendar-outline" label="مزامنة التقويم" description="اسمح بإضافة المهمة إلى تقويم جهازك عند اختيارك من شاشة المتابعة." value={value.calendarSyncEnabled} disabled={busy} onChange={(calendarSyncEnabled) => patch({ calendarSyncEnabled })} /><PreferenceRow icon="layers-outline" label="تجميع الإشعارات العادية يومياً" description="رسائل الدعم والتنبيهات المهمة تبقى فورية." value={value.digestFrequency === "daily"} disabled={busy} onChange={(daily) => patch({ digestFrequency: daily ? "daily" : "immediate" })} /></Section>

    <Section title="تذكير المهام"><Text style={styles.sectionDescription}>حدد متى تبي يوصلك تذكير قبل موعد SLA. تطبق المهام الأقرب أولاً.</Text><View style={styles.optionRow}>{REMINDER_OPTIONS.map((option) => <Pressable key={option.minutes} accessibilityRole="button" accessibilityState={{ selected: value.taskReminderMinutes === option.minutes }} disabled={busy} onPress={() => patch({ taskReminderMinutes: option.minutes })} style={[styles.option, value.taskReminderMinutes === option.minutes && styles.optionActive]}><Text style={[styles.optionText, value.taskReminderMinutes === option.minutes && styles.optionTextActive]}>{option.label}</Text></Pressable>)}</View></Section>

    <Section title="ساعات الهدوء"><PreferenceRow icon="moon-outline" label="تأجيل التنبيهات غير العاجلة" description="تظهر التنبيهات المؤجلة لاحقاً في مركز الإشعارات." value={value.quietHoursEnabled} disabled={busy} onChange={(quietHoursEnabled) => patch({ quietHoursEnabled })} />{value.quietHoursEnabled ? <View style={styles.quietPanel}><Text style={styles.quietHint}>من</Text><HourOptions selected={value.quietStartHour ?? 22} options={QUIET_START_OPTIONS} disabled={busy} onChange={(quietStartHour) => patch({ quietStartHour })} /><Text style={styles.quietHint}>إلى</Text><HourOptions selected={value.quietEndHour ?? 7} options={QUIET_END_OPTIONS} disabled={busy} onChange={(quietEndHour) => patch({ quietEndHour })} /></View> : null}</Section>

    <Text style={styles.section}>آخر قرارات التسليم</Text>{logs.data?.length ? logs.data.slice(0, 10).map((log) => <View key={log.id} style={styles.log}><View style={styles.logCopy}><Text style={styles.logTitle}>{log.title}</Text><Text style={styles.logMeta}>{labelDelivery(log.status)} · {new Date(log.createdAt).toLocaleString("ar-SA")}</Text></View><Ionicons name={log.status === "delivered" ? "checkmark-circle-outline" : log.status === "suppressed" ? "moon-outline" : log.status === "failed" ? "alert-circle-outline" : "time-outline"} size={19} color="#0B5D45" /></View>) : <Text style={styles.empty}>لا توجد سجلات تسليم بعد.</Text>}{busy ? <ActivityIndicator color="#0B5D45" style={styles.saving} /> : null}
  </ScrollView></ScreenContainer>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.sectionGroup}><Text style={styles.section}>{title}</Text>{children}</View>; }
function PreferenceRow({ icon, label, description, value, disabled, onChange }: { icon: keyof typeof Ionicons.glyphMap; label: string; description: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) { return <View style={styles.setting}><View style={styles.settingIcon}><Ionicons name={icon} color="#0B5D45" size={18} /></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>{label}</Text><Text style={styles.settingDescription}>{description}</Text></View><Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: "#DCE7DE", true: "#8EC9A2" }} thumbColor={value ? "#0B5D45" : "#FFFFFF"} /></View>; }
function HourOptions({ selected, options, disabled, onChange }: { selected: number; options: number[]; disabled: boolean; onChange: (hour: number) => void }) { return <View style={styles.hourOptions}>{options.map((hour) => <Pressable key={hour} disabled={disabled} onPress={() => onChange(hour)} style={[styles.hour, selected === hour && styles.hourActive]}><Text style={[styles.hourText, selected === hour && styles.hourTextActive]}>{formatHour(hour)}</Text></Pressable>)}</View>; }
function formatHour(hour: number) { return `${String(hour).padStart(2, "0")}:00`; }
function labelDelivery(status: string) { return ({ delivered: "تم التسليم", queued: "قيد الإرسال", suppressed: "مؤجل بالتفضيلات", failed: "تعذر" } as Record<string, string>)[status] ?? status; }

const styles = StyleSheet.create({
  container: { alignSelf: "center", maxWidth: 780, padding: 20, paddingBottom: 48, width: "100%" }, header: { alignItems: "center", flexDirection: "row-reverse", gap: 12 }, close: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, headerCopy: { alignItems: "flex-end", flex: 1 }, eyebrow: { color: "#0B5D45", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, title: { color: "#17382F", fontSize: 22, fontWeight: "900", marginTop: 3, textAlign: "right", writingDirection: "rtl" }, subtitle: { color: "#66756E", fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, summary: { alignItems: "center", backgroundColor: "#ECF7EE", borderColor: "#CFE6D5", borderRadius: 17, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 18, padding: 13 }, summaryIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, height: 38, justifyContent: "center", width: 38 }, summaryCopy: { alignItems: "flex-end", flex: 1 }, summaryTitle: { color: "#17382F", fontSize: 13, fontWeight: "900", textAlign: "right", writingDirection: "rtl" }, summaryBody: { color: "#557264", fontSize: 10, lineHeight: 16, marginTop: 3, textAlign: "right", writingDirection: "rtl" }, sectionGroup: { marginTop: 23 }, section: { color: "#344D42", fontSize: 15, fontWeight: "900", marginTop: 24, textAlign: "right", writingDirection: "rtl" }, sectionDescription: { color: "#6E8177", fontSize: 11, lineHeight: 17, marginTop: 6, textAlign: "right", writingDirection: "rtl" }, setting: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginTop: 10, padding: 13 }, settingIcon: { alignItems: "center", backgroundColor: "#EAF5EC", borderRadius: 10, height: 32, justifyContent: "center", width: 32 }, settingCopy: { alignItems: "flex-end", flex: 1 }, settingTitle: { color: "#17382F", fontSize: 13, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, settingDescription: { color: "#66756E", fontSize: 10, lineHeight: 16, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, optionRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginTop: 12 }, option: { backgroundColor: "#F3F7F4", borderColor: "#DCE8DE", borderRadius: 999, borderWidth: 1, minWidth: 64, paddingHorizontal: 12, paddingVertical: 8 }, optionActive: { backgroundColor: "#E6F5EA", borderColor: "#0B5D45" }, optionText: { color: "#63786D", fontSize: 11, fontWeight: "800", textAlign: "center", writingDirection: "rtl" }, optionTextActive: { color: "#0B5D45" }, quietPanel: { alignItems: "flex-end", backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 14, borderWidth: 1, marginTop: 10, padding: 11 }, quietHint: { color: "#5D7568", fontSize: 11, fontWeight: "800", writingDirection: "rtl" }, hourOptions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 10, marginTop: 6 }, hour: { backgroundColor: "#FFFFFF", borderColor: "#DCE8DE", borderRadius: 9, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 }, hourActive: { backgroundColor: "#E6F5EA", borderColor: "#0B5D45" }, hourText: { color: "#63786D", fontSize: 10, fontWeight: "800" }, hourTextActive: { color: "#0B5D45" }, message: { color: "#0B5D45", fontSize: 11, lineHeight: 18, marginTop: 8, textAlign: "right", writingDirection: "rtl" }, log: { alignItems: "flex-start", backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 13, borderWidth: 1, flexDirection: "row-reverse", gap: 8, marginTop: 8, padding: 11 }, logCopy: { alignItems: "flex-end", flex: 1 }, logTitle: { color: "#25463A", fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, logMeta: { color: "#74877D", fontSize: 9, marginTop: 3, textAlign: "right", writingDirection: "rtl" }, empty: { color: "#66756E", fontSize: 12, marginTop: 10, textAlign: "right", writingDirection: "rtl" }, state: { alignItems: "center", flex: 1, justifyContent: "center" }, stateText: { color: "#66756E", fontSize: 13, writingDirection: "rtl" }, saving: { marginTop: 15 },
});
