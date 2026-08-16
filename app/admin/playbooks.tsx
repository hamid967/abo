import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { trpc } from "@/lib/trpc";

type StepKind = "instruction" | "document" | "approval" | "task";

export default function PlaybooksAdminScreen() {
  const router = useRouter();
  const { account, isAuthenticated } = useAccount();
  const allowed = isAuthenticated && (account?.role === "admin" || account?.role === "super_admin");
  const playbooks = trpc.playbooks.list.useQuery(undefined, { enabled: allowed, retry: false });
  const services = trpc.playbooks.services.useQuery(undefined, { enabled: allowed, retry: false });
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [playbookName, setPlaybookName] = useState("");
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);
  const [versionTitle, setVersionTitle] = useState("");
  const [stepsText, setStepsText] = useState("collect_documents | جمع المستندات | document\nreview_request | مراجعة الطلب | approval");
  const [error, setError] = useState<string | null>(null);

  const create = trpc.playbooks.create.useMutation({ onSuccess: async () => { setPlaybookName(""); setServiceId(null); await playbooks.refetch(); } });
  const createVersion = trpc.playbooks.createVersion.useMutation({ onSuccess: async () => { setVersionTitle(""); await playbooks.refetch(); } });
  const publish = trpc.playbooks.publish.useMutation({ onSuccess: () => void playbooks.refetch() });
  const archive = trpc.playbooks.archive.useMutation({ onSuccess: () => void playbooks.refetch() });
  const selected = useMemo(() => playbooks.data?.find((item) => item.id === selectedPlaybookId) ?? null, [playbooks.data, selectedPlaybookId]);

  function parsedSteps() {
    const lines = stepsText.split("\n").map((line) => line.trim()).filter(Boolean);
    return lines.map((line, index) => {
      const [key, title, kind] = line.split("|").map((part) => part.trim());
      const actionType: StepKind = kind === "document" || kind === "approval" || kind === "task" ? kind : "instruction";
      return { stepKey: key || `step_${index + 1}`, title: title || `خطوة ${index + 1}`, actionType, isRequired: true };
    });
  }

  async function handleCreatePlaybook() {
    setError(null);
    if (!serviceId || playbookName.trim().length < 3) { setError("اختر خدمة واكتب اسم Playbook واضح."); return; }
    try { await create.mutateAsync({ serviceId, name: playbookName.trim() }); } catch { setError("ما قدرنا ننشئ Playbook. تأكد أن الخدمة ما لها Playbook فعال."); }
  }

  async function handleCreateVersion() {
    setError(null);
    if (!selected || versionTitle.trim().length < 3) { setError("اختر Playbook واكتب عنوان الإصدار."); return; }
    try { await createVersion.mutateAsync({ playbookId: selected.id, title: versionTitle.trim(), steps: parsedSteps() }); } catch { setError("ما قدرنا ننشئ الإصدار. تأكد من صيغة الخطوات."); }
  }

  if (!allowed) return <ScreenContainer style={styles.state}><Ionicons name="shield-outline" size={42} color="#0B5D45" /><Text style={styles.stateTitle}>ما عندك صلاحية إدارة Playbooks</Text><Pressable onPress={() => router.back()} style={styles.primary}><Text style={styles.primaryText}>العودة</Text></Pressable></ScreenContainer>;
  if (playbooks.isLoading || services.isLoading) return <ScreenContainer style={styles.state}><ActivityIndicator color="#0B5D45" /><Text style={styles.stateTitle}>قاعد نحمّل Playbooks…</Text></ScreenContainer>;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>أبو مشعل · إدارة الخدمات</Text><Text style={styles.title}>Playbooks وإصدارات الخدمة</Text></View></View>
    <View style={styles.notice}><Ionicons name="git-branch-outline" size={18} color="#0B5D45" /><Text style={styles.noticeText}>الإصدار المنشور يثبت خطوات الخدمة للطلبات التي تبدأ بعد نشره. تعديل إصدار جديد ما يغير الطلبات السابقة.</Text></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Text style={styles.section}>إنشاء Playbook لخدمة</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.services}>{services.data?.map((service) => <Pressable key={service.id} onPress={() => setServiceId(service.id)} style={[styles.service, serviceId === service.id && styles.serviceActive]}><Text style={[styles.serviceText, serviceId === service.id && styles.serviceTextActive]}>{service.name}</Text></Pressable>)}</ScrollView>
    <View style={styles.form}><TextInput value={playbookName} onChangeText={setPlaybookName} placeholder="مثال: Playbook تجديد رخصة" placeholderTextColor="#8A9A91" style={styles.input} textAlign="right" /><Pressable disabled={create.isPending} onPress={() => void handleCreatePlaybook()} style={[styles.primary, create.isPending && styles.disabled]}>{create.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>إنشاء Playbook</Text>}</Pressable></View>
    <Text style={styles.section}>Playbooks الحالية</Text>
    {playbooks.data?.length ? playbooks.data.map((playbook) => <View key={playbook.id} style={styles.card}><View style={styles.cardTop}><View style={styles.cardCopy}><Text style={styles.cardTitle}>{playbook.name}</Text><Text style={styles.cardMeta}>{playbook.serviceName} · {playbook.status === "active" ? "فعّال" : "مؤرشف"}</Text></View><Pressable disabled={archive.isPending || playbook.status !== "active"} onPress={() => Alert.alert("أرشفة Playbook", "لن تتغير الطلبات المرتبطة بإصدارات سابقة.", [{ text: "إلغاء", style: "cancel" }, { text: "أرشفة", style: "destructive", onPress: () => archive.mutate({ playbookId: playbook.id }) }])} style={styles.archive}><Text style={styles.archiveText}>أرشفة</Text></Pressable></View>
      <View style={styles.versions}>{playbook.versions.length ? playbook.versions.map((version) => <View key={version.id} style={styles.version}><View style={styles.versionCopy}><Text style={styles.versionTitle}>v{version.versionNumber} · {version.title}</Text><Text style={styles.versionMeta}>{version.status === "published" ? "منشور" : version.status === "draft" ? "مسودة" : "مؤرشف"}</Text></View>{version.status === "draft" ? <Pressable disabled={publish.isPending} onPress={() => publish.mutate({ playbookId: playbook.id, versionId: version.id })} style={styles.publish}><Text style={styles.publishText}>نشر</Text></Pressable> : null}</View>) : <Text style={styles.emptyText}>ما فيه إصدارات للحين.</Text>}</View>
      <Pressable onPress={() => setSelectedPlaybookId(selectedPlaybookId === playbook.id ? null : playbook.id)} style={styles.versionButton}><Ionicons name="add-circle-outline" size={17} color="#0B5D45" /><Text style={styles.versionButtonText}>إصدار جديد</Text></Pressable>
      {selectedPlaybookId === playbook.id ? <View style={styles.versionForm}><TextInput value={versionTitle} onChangeText={setVersionTitle} placeholder="عنوان الإصدار" placeholderTextColor="#8A9A91" style={styles.input} textAlign="right" /><Text style={styles.hint}>صيغة الخطوات: المفتاح | عنوان الخطوة | النوع (instruction / document / approval / task)</Text><TextInput value={stepsText} onChangeText={setStepsText} multiline placeholderTextColor="#8A9A91" style={[styles.input, styles.stepsInput]} textAlign="right" textAlignVertical="top" /><Pressable disabled={createVersion.isPending} onPress={() => void handleCreateVersion()} style={[styles.primary, createVersion.isPending && styles.disabled]}>{createVersion.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>حفظ كمسودة إصدار</Text>}</Pressable></View> : null}
    </View>) : <View style={styles.empty}><Ionicons name="book-outline" size={30} color="#7A8B82" /><Text style={styles.emptyText}>ما فيه Playbooks حالياً. اختر خدمة وأنشئ أول Playbook لها.</Text></View>}
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ container: { alignSelf: "center", maxWidth: 780, padding: 20, paddingBottom: 48, width: "100%" }, header: { alignItems: "center", flexDirection: "row-reverse", gap: 12 }, close: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, headerCopy: { alignItems: "flex-end", flex: 1 }, eyebrow: { color: "#0B5D45", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, title: { color: "#17382F", fontSize: 21, fontWeight: "900", marginTop: 3, writingDirection: "rtl" }, notice: { alignItems: "flex-start", backgroundColor: "#EFF7F1", borderColor: "#CEE2D3", borderRadius: 13, borderWidth: 1, flexDirection: "row-reverse", gap: 8, marginTop: 16, padding: 11 }, noticeText: { color: "#49665B", flex: 1, fontSize: 10, lineHeight: 16, textAlign: "right", writingDirection: "rtl" }, section: { color: "#344D42", fontSize: 15, fontWeight: "900", marginTop: 22, textAlign: "right", writingDirection: "rtl" }, services: { flexDirection: "row-reverse", gap: 7, paddingTop: 10 }, service: { backgroundColor: "#F5F8F6", borderColor: "#DCE7DE", borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 }, serviceActive: { backgroundColor: "#E9F5EC", borderColor: "#0B5D45" }, serviceText: { color: "#66756E", fontSize: 10, fontWeight: "800", writingDirection: "rtl" }, serviceTextActive: { color: "#0B5D45" }, form: { gap: 9, marginTop: 11 }, input: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 12, borderWidth: 1, color: "#17382F", fontSize: 12, minHeight: 46, paddingHorizontal: 12, writingDirection: "rtl" }, primary: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 12, justifyContent: "center", minHeight: 44, paddingHorizontal: 14 }, primaryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", writingDirection: "rtl" }, card: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 16, borderWidth: 1, marginTop: 9, padding: 12 }, cardTop: { alignItems: "center", flexDirection: "row-reverse", gap: 10 }, cardCopy: { alignItems: "flex-end", flex: 1 }, cardTitle: { color: "#17382F", fontSize: 13, fontWeight: "900", writingDirection: "rtl" }, cardMeta: { color: "#6A7C73", fontSize: 10, marginTop: 4, writingDirection: "rtl" }, archive: { backgroundColor: "#FEF3F2", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 }, archiveText: { color: "#B42318", fontSize: 10, fontWeight: "800", writingDirection: "rtl" }, versions: { gap: 6, marginTop: 11 }, version: { alignItems: "center", backgroundColor: "#F8FAF8", borderRadius: 10, flexDirection: "row-reverse", gap: 9, padding: 9 }, versionCopy: { alignItems: "flex-end", flex: 1 }, versionTitle: { color: "#345346", fontSize: 11, fontWeight: "800", writingDirection: "rtl" }, versionMeta: { color: "#708178", fontSize: 9, marginTop: 2, writingDirection: "rtl" }, publish: { backgroundColor: "#E9F5EC", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 }, publishText: { color: "#0B5D45", fontSize: 10, fontWeight: "900", writingDirection: "rtl" }, versionButton: { alignItems: "center", flexDirection: "row-reverse", gap: 5, marginTop: 12 }, versionButtonText: { color: "#0B5D45", fontSize: 11, fontWeight: "900", writingDirection: "rtl" }, versionForm: { gap: 8, marginTop: 12 }, hint: { color: "#6A7C73", fontSize: 9, lineHeight: 15, textAlign: "right", writingDirection: "rtl" }, stepsInput: { minHeight: 102, paddingTop: 10 }, empty: { alignItems: "center", backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 14, borderStyle: "dashed", borderWidth: 1, marginTop: 10, padding: 22 }, emptyText: { color: "#66756E", fontSize: 12, lineHeight: 19, marginTop: 8, textAlign: "center", writingDirection: "rtl" }, error: { backgroundColor: "#FEF3F2", borderRadius: 10, color: "#B42318", fontSize: 11, marginTop: 10, padding: 10, textAlign: "right", writingDirection: "rtl" }, disabled: { opacity: 0.55 }, state: { alignItems: "center", flex: 1, justifyContent: "center", padding: 28 }, stateTitle: { color: "#17382F", fontSize: 16, fontWeight: "800", marginTop: 12, textAlign: "center", writingDirection: "rtl" } });
