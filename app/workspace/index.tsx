import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useWorkspace, WorkspaceTask } from "@/lib/workspace-provider";

type WorkspaceTab = "tasks" | "appointments" | "documents";
const tabs: { value: WorkspaceTab; label: string }[] = [{ value: "tasks", label: "المهام" }, { value: "appointments", label: "المواعيد" }, { value: "documents", label: "المستندات" }];

export default function WorkspaceScreen() {
  const router = useRouter();
  const { tasks, appointments, documents, addTask, addAppointment, addDocument, updateTaskStatus } = useWorkspace();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("tasks");
  const [quickTitle, setQuickTitle] = useState("");
  async function addQuickItem() {
    if (activeTab === "documents") {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.size ?? 0) > 10 * 1024 * 1024) { Alert.alert("الملف كبير", "الحد المبدئي للمرفق هو 10 ميغابايت."); return; }
      await addDocument({ name: asset.name, mimeType: asset.mimeType ?? undefined, size: asset.size, uri: asset.uri });
      return;
    }
    if (!quickTitle.trim()) { Alert.alert("أدخل عنواناً", activeTab === "tasks" ? "اكتب عنوان المهمة أولاً." : "اكتب عنوان الموعد أولاً."); return; }
    if (activeTab === "tasks") await addTask({ title: quickTitle.trim(), priority: "normal", status: "new" });
    else await addAppointment({ title: quickTitle.trim(), startsAt: new Date().toISOString(), status: "scheduled" });
    setQuickTitle("");
  }

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.container}>
    <View style={styles.nav}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><Ionicons name="close" size={22} color="#17382F" /></Pressable><View style={styles.navCopy}><Text style={styles.brand}>أبو مشعل</Text><Text style={styles.title}>مساحة العمل</Text></View></View>
    <View style={styles.tabs}>{tabs.map((tab) => <Pressable key={tab.value} onPress={() => setActiveTab(tab.value)} style={({ pressed }) => [styles.tab, activeTab === tab.value && styles.activeTab, pressed && styles.pressed]}><Text style={[styles.tabText, activeTab === tab.value && styles.activeTabText]}>{tab.label}</Text></Pressable>)}</View>
    <Text style={styles.subtitle}>{activeTab === "tasks" ? "نظّم الإجراء التالي لكل معاملة." : activeTab === "appointments" ? "سجّل مواعيد المتابعة والمراجعات." : "أضف ملفات الطلب وتابع حالة مراجعتها."}</Text>
    {activeTab !== "documents" && <View style={styles.quickAdd}><TextInput value={quickTitle} onChangeText={setQuickTitle} placeholder={activeTab === "tasks" ? "عنوان مهمة جديدة" : "عنوان موعد جديد"} placeholderTextColor="#93A39C" style={styles.quickInput} textAlign="right" /><Pressable onPress={addQuickItem} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Ionicons name="add" size={21} color="#FFFFFF" /></Pressable></View>}
    {activeTab === "documents" && <Pressable onPress={addQuickItem} style={({ pressed }) => [styles.documentButton, pressed && styles.pressed]}><Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" /><Text style={styles.documentButtonText}>إضافة مرفق</Text></Pressable>}
    {activeTab === "tasks" && <FlatList data={tasks} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListEmptyComponent={<Empty icon="checkmark-done-outline" text="لا توجد مهام الآن. أضف الإجراء التالي للبدء." />} renderItem={({ item }) => <TaskRow task={item} onComplete={() => updateTaskStatus(item.id, "completed")} />} />}
    {activeTab === "appointments" && <FlatList data={appointments} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListEmptyComponent={<Empty icon="calendar-outline" text="لا توجد مواعيد مسجلة." />} renderItem={({ item }) => <View style={styles.row}><View style={styles.rowIcon}><Ionicons name="calendar" size={20} color="#0B5D45" /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowMeta}>{new Date(item.startsAt).toLocaleDateString("ar-SA")}</Text></View></View>} />}
    {activeTab === "documents" && <FlatList data={documents} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListEmptyComponent={<Empty icon="folder-open-outline" text="لم تُضف مستندات بعد. يدعم المركز PDF والصور وDOCX." />} renderItem={({ item }) => <View style={styles.row}><View style={styles.rowIcon}><Ionicons name="document-text" size={20} color="#0B5D45" /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>بانتظار المراجعة · {item.size ? `${Math.ceil(item.size / 1024)} كيلوبايت` : "حجم غير معروف"}</Text></View></View>} />}
  </View></ScreenContainer>;
}

function Empty({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) { return <View style={styles.empty}><Ionicons name={icon} size={34} color="#78A190" /><Text style={styles.emptyText}>{text}</Text></View>; }
function TaskRow({ task, onComplete }: { task: WorkspaceTask; onComplete: () => void }) { const completed = task.status === "completed"; return <View style={styles.row}><Pressable onPress={onComplete} style={({ pressed }) => [styles.taskCheck, completed && styles.taskCheckDone, pressed && styles.pressed]}><Ionicons name={completed ? "checkmark" : "ellipse-outline"} size={19} color={completed ? "#FFFFFF" : "#0B5D45"} /></Pressable><View style={styles.rowCopy}><Text style={[styles.rowTitle, completed && styles.completedText]}>{task.title}</Text><Text style={styles.rowMeta}>{completed ? "مكتملة" : "جديدة · أولوية عادية"}</Text></View></View>; }

const styles = StyleSheet.create({ container: { flex: 1, padding: 20 }, nav: { alignItems: "center", flexDirection: "row-reverse", gap: 12 }, closeButton: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, navCopy: { alignItems: "flex-end", flex: 1 }, brand: { color: "#0B5D45", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, title: { color: "#17382F", fontSize: 22, fontWeight: "800", writingDirection: "rtl" }, tabs: { backgroundColor: "#F1F5F2", borderRadius: 14, flexDirection: "row-reverse", gap: 4, marginTop: 22, padding: 4 }, tab: { alignItems: "center", borderRadius: 10, flex: 1, paddingVertical: 10 }, activeTab: { backgroundColor: "#FFFFFF" }, tabText: { color: "#75877E", fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, activeTabText: { color: "#0B5D45" }, subtitle: { color: "#66756E", fontSize: 13, lineHeight: 20, marginTop: 15, textAlign: "right", writingDirection: "rtl" }, quickAdd: { alignItems: "center", flexDirection: "row-reverse", gap: 8, marginTop: 14 }, quickInput: { backgroundColor: "#FFFFFF", borderColor: "#DCE7DE", borderRadius: 14, borderWidth: 1, color: "#17382F", flex: 1, height: 50, paddingHorizontal: 13, writingDirection: "rtl" }, addButton: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 14, height: 50, justifyContent: "center", width: 50 }, documentButton: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 14, flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginTop: 14, minHeight: 50 }, documentButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", writingDirection: "rtl" }, list: { gap: 10, paddingBottom: 40, paddingTop: 18 }, row: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E9E3", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 11, padding: 14 }, rowIcon: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 12, height: 40, justifyContent: "center", width: 40 }, taskCheck: { alignItems: "center", backgroundColor: "#F2F8F3", borderColor: "#B8D5C1", borderRadius: 12, borderWidth: 1, height: 40, justifyContent: "center", width: 40 }, taskCheckDone: { backgroundColor: "#0B5D45", borderColor: "#0B5D45" }, rowCopy: { alignItems: "flex-end", flex: 1 }, rowTitle: { color: "#17382F", fontSize: 14, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, rowMeta: { color: "#6A7C73", fontSize: 12, marginTop: 4, writingDirection: "rtl" }, completedText: { color: "#71837A", textDecorationLine: "line-through" }, empty: { alignItems: "center", backgroundColor: "#F7FAF8", borderColor: "#E1E9E3", borderRadius: 18, borderStyle: "dashed", borderWidth: 1, marginTop: 18, padding: 32 }, emptyText: { color: "#66756E", fontSize: 13, lineHeight: 20, marginTop: 10, textAlign: "center", writingDirection: "rtl" }, pressed: { opacity: 0.72 }, });
