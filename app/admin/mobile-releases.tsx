import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text, AppTextInput as TextInput } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { trpc } from "@/lib/trpc";

const platforms = [
  { value: "android_apk", label: "Android APK" },
  { value: "android_aab", label: "Android AAB" },
  { value: "ios_ipa", label: "iOS IPA" },
] as const;

const releaseStatuses = [
  { value: "pending", label: "بانتظار البناء" },
  { value: "building", label: "جارٍ البناء" },
  { value: "ready", label: "جاهز للتنزيل" },
  { value: "failed", label: "فشل البناء" },
  { value: "archived", label: "مؤرشف" },
] as const;

type Platform = (typeof platforms)[number]["value"];
type ReleaseStatus = (typeof releaseStatuses)[number]["value"];

export default function MobileReleasesScreen() {
  const router = useRouter();
  const { isAuthenticated, account } = useAccount();
  const isAdmin = account?.role === "admin" || account?.role === "super_admin";
  const releases = trpc.mobileReleases.list.useQuery(undefined, { enabled: isAuthenticated && isAdmin, retry: false });
  const saveRelease = trpc.mobileReleases.save.useMutation();
  const [editingId, setEditingId] = useState<number | undefined>();
  const [platform, setPlatform] = useState<Platform>("android_apk");
  const [status, setStatus] = useState<ReleaseStatus>("building");
  const [versionLabel, setVersionLabel] = useState("");
  const [buildReference, setBuildReference] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");

  const resetForm = () => {
    setEditingId(undefined);
    setPlatform("android_apk");
    setStatus("building");
    setVersionLabel("");
    setBuildReference("");
    setDownloadUrl("");
    setReleaseNotes("");
  };

  const save = async () => {
    if (!versionLabel.trim()) {
      Alert.alert("أضف رقم الإصدار", "اكتب رقم أو اسم الإصدار قبل الحفظ.");
      return;
    }
    if (status === "ready" && !downloadUrl.trim()) {
      Alert.alert("الرابط مطلوب", "الإصدار الجاهز يحتاج رابط تنزيل HTTPS موثق.");
      return;
    }
    try {
      await saveRelease.mutateAsync({
        id: editingId,
        platform,
        status,
        versionLabel: versionLabel.trim(),
        buildReference: buildReference.trim() || undefined,
        downloadUrl: downloadUrl.trim() || undefined,
        releaseNotes: releaseNotes.trim() || undefined,
      });
      await releases.refetch();
      resetForm();
      Alert.alert("تم الحفظ", "تم تحديث سجل الإصدار. يظهر رابط التنزيل فقط عند تسجيله كرابط HTTPS موثق.");
    } catch {
      Alert.alert("تعذر الحفظ", "تأكد من أن رابط التنزيل يبدأ بـ https:// ثم حاول مرة ثانية.");
    }
  };

  if (!isAuthenticated) return <AccessState icon="log-in-outline" title="سجّل الدخول أولاً" body="تحتاج إدارة الإصدارات إلى جلسة حساب إدارية." action="فتح الحساب" onPress={() => router.push("/account" as never)} />;
  if (!isAdmin) return <AccessState icon="shield-outline" title="ليس لديك إذن الإدارة" body="تقتصر إدارة روابط التطبيق على المدير أو المدير العام." action="العودة" onPress={() => router.back()} />;
  if (releases.isLoading) return <ScreenContainer style={styles.center}><ActivityIndicator color="#0B5D45" /><Text style={styles.centerText}>جارٍ تحميل إصدارات الجوال...</Text></ScreenContainer>;
  if (releases.error || !releases.data) return <AccessState icon="alert-circle-outline" title="تعذر تحميل الإصدارات" body="تحقق من الاتصال أو صلاحيات الحساب ثم أعد المحاولة." action="إعادة المحاولة" onPress={() => void releases.refetch()} />;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><FlatList
    data={releases.data}
    keyExtractor={(item) => String(item.id)}
    contentContainerStyle={styles.list}
    refreshControl={<RefreshControl refreshing={releases.isFetching} onRefresh={() => void releases.refetch()} tintColor="#0B5D45" />}
    ListHeaderComponent={<View>
      <View style={styles.header}><Pressable accessibilityLabel="العودة إلى لوحة الإدارة" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-forward" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>أبو مشعل · إدارة النظام</Text><Text style={styles.title}>إصدارات تطبيق الجوال</Text><Text style={styles.subtitle}>سجل موثّق لحالة البناء وروابط التنزيل. لا يصل الرابط تلقائياً من منصة البناء دون تكامل رسمي.</Text></View></View>
      <View style={styles.notice}><Ionicons name="information-circle-outline" size={19} color="#185C8A" /><Text style={styles.noticeText}>بعد اكتمال بناء رسمي، أضف رابط APK أو حدّث الإصدار إلى «جاهز للتنزيل». يقبل النظام روابط HTTPS فقط.</Text></View>
      <View style={styles.formCard}><View style={styles.formTitleRow}><Ionicons name={editingId ? "create-outline" : "add-circle-outline"} size={19} color="#0B5D45" /><Text style={styles.formTitle}>{editingId ? "تحديث إصدار" : "تسجيل إصدار جديد"}</Text></View>
        <Text style={styles.fieldLabel}>المنصة</Text><OptionRow options={platforms} value={platform} onChange={setPlatform} />
        <Text style={styles.fieldLabel}>حالة البناء</Text><OptionRow options={releaseStatuses} value={status} onChange={setStatus} />
        <TextInput accessibilityLabel="رقم الإصدار" value={versionLabel} onChangeText={setVersionLabel} placeholder="مثال: 1.0.0 (12)" placeholderTextColor="#93A39C" style={styles.input} textAlign="right" />
        <TextInput accessibilityLabel="مرجع البناء" value={buildReference} onChangeText={setBuildReference} placeholder="مرجع البناء أو رقم المهمة — اختياري" placeholderTextColor="#93A39C" style={styles.input} textAlign="right" />
        <TextInput accessibilityLabel="رابط التنزيل" value={downloadUrl} onChangeText={setDownloadUrl} placeholder="https://… رابط تنزيل APK أو IPA" placeholderTextColor="#93A39C" style={styles.input} autoCapitalize="none" keyboardType="url" textAlign="left" />
        <TextInput accessibilityLabel="ملاحظات الإصدار" value={releaseNotes} onChangeText={setReleaseNotes} placeholder="ملاحظات الإصدار أو نتيجة البناء — اختيارية" placeholderTextColor="#93A39C" multiline style={[styles.input, styles.notes]} textAlign="right" />
        <View style={styles.formActions}>{editingId && <Pressable accessibilityLabel="إلغاء تعديل الإصدار" disabled={saveRelease.isPending} onPress={resetForm} style={styles.cancelButton}><Text style={styles.cancelButtonText}>إلغاء</Text></Pressable>}<Pressable accessibilityLabel={editingId ? "حفظ تحديث الإصدار" : "حفظ الإصدار"} disabled={saveRelease.isPending} onPress={() => void save()} style={[styles.saveButton, saveRelease.isPending && styles.buttonDisabled]}>{saveRelease.isPending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="save-outline" size={18} color="#FFFFFF" />}<Text style={styles.saveButtonText}>{editingId ? "حفظ التحديث" : "حفظ الإصدار"}</Text></Pressable></View>
      </View>
      <Text style={styles.sectionTitle}>الإصدارات المسجلة</Text>
    </View>}
    ListEmptyComponent={<View style={styles.empty}><Ionicons name="phone-portrait-outline" size={30} color="#5B7165" /><Text style={styles.emptyTitle}>ما فيه إصدار مسجل للحين</Text><Text style={styles.emptyBody}>سجّل عملية بناء جارية الآن، ثم أضف رابط APK بعد تحقق البناء.</Text></View>}
    renderItem={({ item }) => {
      const platformLabel = platforms.find((option) => option.value === item.platform)?.label ?? item.platform;
      const statusLabel = releaseStatuses.find((option) => option.value === item.status)?.label ?? item.status;
      const ready = item.status === "ready" && Boolean(item.downloadUrl);
      const edit = () => { setEditingId(item.id); setPlatform(item.platform as Platform); setStatus(item.status as ReleaseStatus); setVersionLabel(item.versionLabel); setBuildReference(item.buildReference ?? ""); setDownloadUrl(item.downloadUrl ?? ""); setReleaseNotes(item.releaseNotes ?? ""); };
      const openDownload = () => { if (item.downloadUrl) void Linking.openURL(item.downloadUrl).catch(() => Alert.alert("تعذر فتح الرابط", "تحقق من الرابط الموثق المسجل لهذا الإصدار.")); };
      return <View style={styles.releaseCard}><View style={styles.releaseHeader}><View style={styles.releasePlatform}><Ionicons name={item.platform === "ios_ipa" ? "logo-apple" : "logo-android"} size={18} color="#0B5D45" /><Text style={styles.releasePlatformText}>{platformLabel}</Text></View><Text style={[styles.status, ready ? styles.statusReady : item.status === "failed" ? styles.statusFailed : styles.statusProgress]}>{statusLabel}</Text></View><Text style={styles.releaseVersion}>{item.versionLabel}</Text>{item.buildReference && <Text style={styles.releaseMeta}>مرجع البناء: {item.buildReference}</Text>}{item.releaseNotes && <Text style={styles.releaseNotes}>{item.releaseNotes}</Text>}<Text style={styles.releaseMeta}>آخر تحديث: {new Date(item.updatedAt).toLocaleString("ar-SA")}</Text><View style={styles.releaseActions}><Pressable accessibilityLabel={`تعديل الإصدار ${item.versionLabel}`} onPress={edit} style={styles.editButton}><Ionicons name="create-outline" size={16} color="#0B5D45" /><Text style={styles.editButtonText}>تحديث</Text></Pressable>{ready && <Pressable accessibilityLabel={`فتح رابط تنزيل ${item.versionLabel}`} onPress={openDownload} style={styles.downloadButton}><Ionicons name="download-outline" size={16} color="#FFFFFF" /><Text style={styles.downloadButtonText}>{item.platform === "android_apk" ? "تنزيل APK" : "فتح الرابط"}</Text></Pressable>}</View></View>;
    }}
    ListFooterComponent={<View style={styles.footer}><Ionicons name="shield-checkmark-outline" size={18} color="#4D6B5E" /><Text style={styles.footerText}>روابط التنزيل لا تظهر إلا في هذه الواجهة الإدارية، وتُقبل عبر الخادم بصيغة HTTPS، مع تسجيل إنشاء كل إصدار أو تعديله في سجل التدقيق.</Text></View>}
  /></ScreenContainer>;
}

function OptionRow<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View style={styles.options}>{options.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: value === option.value }} onPress={() => onChange(option.value)} style={[styles.option, value === option.value && styles.optionActive]}><Text style={[styles.optionText, value === option.value && styles.optionTextActive]}>{option.label}</Text></Pressable>)}</View>;
}

function AccessState({ icon, title, body, action, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; action: string; onPress: () => void }) {
  return <ScreenContainer style={styles.center}><Ionicons name={icon} size={42} color="#0B5D45" /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateBody}>{body}</Text><Pressable onPress={onPress} style={styles.saveButton}><Text style={styles.saveButtonText}>{action}</Text></Pressable></ScreenContainer>;
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 36 },
  header: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 12 }, back: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, headerCopy: { alignItems: "flex-end", flex: 1 },
  eyebrow: { color: "#0B5D45", fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, title: { color: "#17382F", fontSize: 22, fontWeight: "900", marginTop: 3, textAlign: "right", writingDirection: "rtl" }, subtitle: { color: "#5B7165", fontSize: 11, lineHeight: 18, marginTop: 5, textAlign: "right", writingDirection: "rtl" },
  notice: { alignItems: "flex-start", backgroundColor: "#EFF8FF", borderColor: "#B9DDF8", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 8, marginTop: 18, padding: 12 }, noticeText: { color: "#185C8A", flex: 1, fontSize: 10, lineHeight: 16, textAlign: "right", writingDirection: "rtl" },
  formCard: { backgroundColor: "#F7FBF8", borderColor: "#DCEADF", borderRadius: 17, borderWidth: 1, marginTop: 14, padding: 14 }, formTitleRow: { alignItems: "center", flexDirection: "row-reverse", gap: 7 }, formTitle: { color: "#0B5D45", fontSize: 13, fontWeight: "900", writingDirection: "rtl" }, fieldLabel: { color: "#315442", fontSize: 11, fontWeight: "900", marginTop: 13, textAlign: "right", writingDirection: "rtl" },
  options: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginTop: 7 }, option: { backgroundColor: "#FFFFFF", borderColor: "#CFE0D3", borderRadius: 10, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 8 }, optionActive: { backgroundColor: "#0B5D45", borderColor: "#0B5D45" }, optionText: { color: "#315442", fontSize: 10, fontWeight: "800", writingDirection: "rtl" }, optionTextActive: { color: "#FFFFFF" },
  input: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 11, borderWidth: 1, color: "#17382F", fontSize: 12, marginTop: 9, minHeight: 46, paddingHorizontal: 11, writingDirection: "rtl" }, notes: { minHeight: 80, paddingTop: 11, textAlignVertical: "top" },
  formActions: { flexDirection: "row-reverse", gap: 9, marginTop: 13 }, saveButton: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 11, flex: 1, flexDirection: "row-reverse", gap: 7, justifyContent: "center", minHeight: 44, paddingHorizontal: 13 }, buttonDisabled: { opacity: 0.65 }, saveButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", writingDirection: "rtl" }, cancelButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#CFE0D3", borderRadius: 11, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 14 }, cancelButtonText: { color: "#315442", fontSize: 12, fontWeight: "900", writingDirection: "rtl" },
  sectionTitle: { color: "#344D42", fontSize: 15, fontWeight: "900", marginBottom: 9, marginTop: 22, textAlign: "right", writingDirection: "rtl" },
  releaseCard: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 16, borderWidth: 1, marginBottom: 10, padding: 13 }, releaseHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, releasePlatform: { alignItems: "center", flexDirection: "row-reverse", gap: 6 }, releasePlatformText: { color: "#0B5D45", fontSize: 11, fontWeight: "900", writingDirection: "rtl" }, status: { borderRadius: 999, fontSize: 10, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5, writingDirection: "rtl" }, statusReady: { backgroundColor: "#ECFDF3", color: "#0B5D45" }, statusFailed: { backgroundColor: "#FEF1EF", color: "#B42318" }, statusProgress: { backgroundColor: "#FFF7E8", color: "#A15C07" }, releaseVersion: { color: "#17382F", fontSize: 15, fontWeight: "900", marginTop: 10, textAlign: "right", writingDirection: "rtl" }, releaseMeta: { color: "#6A7C73", fontSize: 10, lineHeight: 17, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, releaseNotes: { color: "#476256", fontSize: 11, lineHeight: 18, marginTop: 8, textAlign: "right", writingDirection: "rtl" }, releaseActions: { flexDirection: "row-reverse", gap: 8, marginTop: 12 }, editButton: { alignItems: "center", backgroundColor: "#EDF8F0", borderRadius: 10, flexDirection: "row-reverse", gap: 5, paddingHorizontal: 10, paddingVertical: 8 }, editButtonText: { color: "#0B5D45", fontSize: 10, fontWeight: "900", writingDirection: "rtl" }, downloadButton: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 10, flexDirection: "row-reverse", gap: 5, paddingHorizontal: 10, paddingVertical: 8 }, downloadButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", writingDirection: "rtl" },
  empty: { alignItems: "center", backgroundColor: "#F7FAF8", borderColor: "#DCE7DE", borderRadius: 16, borderStyle: "dashed", borderWidth: 1, padding: 24 }, emptyTitle: { color: "#344D42", fontSize: 14, fontWeight: "900", marginTop: 9, writingDirection: "rtl" }, emptyBody: { color: "#66756E", fontSize: 11, lineHeight: 18, marginTop: 4, textAlign: "center", writingDirection: "rtl" },
  footer: { alignItems: "flex-start", backgroundColor: "#F7FAF8", borderColor: "#DCE7DE", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 8, marginTop: 6, padding: 12 }, footerText: { color: "#4D6B5E", flex: 1, fontSize: 10, lineHeight: 16, textAlign: "right", writingDirection: "rtl" },
  center: { alignItems: "center", gap: 12, justifyContent: "center", padding: 28 }, centerText: { color: "#66756E", fontSize: 13, writingDirection: "rtl" }, stateTitle: { color: "#17382F", fontSize: 19, fontWeight: "900", marginTop: 5, writingDirection: "rtl" }, stateBody: { color: "#66756E", fontSize: 13, lineHeight: 20, textAlign: "center", writingDirection: "rtl" },
});
