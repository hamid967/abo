import Ionicons from "@expo/vector-icons/Ionicons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { File as ExpoFile } from "expo-file-system";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, StyleSheet, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import { useAccount } from "@/hooks/use-account";
import { trpc } from "@/lib/trpc";

const acceptedTypes = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] as const;
const maxFileSize = 5 * 1024 * 1024;

function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} ك.ب` : `${(bytes / 1024 / 1024).toFixed(1)} م.ب`; }

export default function DocumentsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAccount();
  const utils = trpc.useUtils();
  const query = trpc.documents.list.useQuery(undefined, { enabled: isAuthenticated });
  const upload = trpc.documents.upload.useMutation();
  const download = trpc.documents.downloadUrl.useMutation();
  const remove = trpc.documents.delete.useMutation();
  const [uploading, setUploading] = useState(false);

  const pickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: [...acceptedTypes], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (!asset.mimeType || !acceptedTypes.includes(asset.mimeType as (typeof acceptedTypes)[number])) throw new Error("FILE_TYPE_NOT_ALLOWED");
      if (!asset.size || asset.size > maxFileSize) throw new Error("FILE_TOO_LARGE");
      setUploading(true);
      const contentsBase64 = await new ExpoFile(asset.uri).base64();
      await upload.mutateAsync({ fileName: asset.name, mimeType: asset.mimeType as (typeof acceptedTypes)[number], fileSizeBytes: asset.size, contentsBase64 });
      await utils.documents.list.invalidate();
    } catch (error) {
      const message = error instanceof Error && error.message === "FILE_TOO_LARGE" ? "حجم الملف أكبر من 5 م.ب." : error instanceof Error && error.message === "FILE_TYPE_NOT_ALLOWED" ? "الأنواع المقبولة: PDF أو JPG أو PNG أو DOCX." : "ما قدرنا نرفع الملف الحين، جرّب مرة ثانية.";
      Alert.alert("رفع المستند", message);
    } finally { setUploading(false); }
  };

  const deleteDocument = (id: number, fileName: string) => Alert.alert("حذف المستند", `تحب تحذف «${fileName}» من محفظتك؟ لا يمكن حذف المستند المرتبط بطلب أو معاملة من هنا.`, [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => void remove.mutateAsync({ documentId: id }).then(() => utils.documents.list.invalidate()).catch((error) => Alert.alert("ما قدرنا نحذف المستند", error?.message === "DOCUMENT_LINKED_TO_RECORD" ? "هذا المستند مرتبط بطلب أو معاملة، راجعه من السجل المرتبط." : "جرّب مرة ثانية.")) }]);
  const openDocument = async (documentId: number) => {
    try {
      const result = await download.mutateAsync({ documentId });
      await Linking.openURL(result.url);
    } catch {
      Alert.alert("ما قدرنا نفتح المستند", "جرّب مرة ثانية. إذا استمرت المشكلة، افتح الطلب المرتبط بالمستند.");
    }
  };

  if (!isAuthenticated) return <ScreenContainer style={styles.center}><Ionicons name="lock-closed-outline" size={42} color="#0B5D45" /><Text style={styles.centerTitle}>سجّل دخولك أول</Text><Text style={styles.centerBody}>عشان تحفظ مستنداتك في محفظة خاصة بحسابك.</Text><Pressable onPress={() => router.push("/account" as never)} style={styles.primary}><Text style={styles.primaryText}>فتح الحساب</Text></Pressable></ScreenContainer>;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><FlatList data={query.data ?? []} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.content} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} ListHeaderComponent={<><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-forward" size={22} color="#17382F" /></Pressable><View style={styles.headerCopy}><Text style={styles.title}>محفظة المستندات</Text><Text style={styles.subtitle}>ملفاتك المحفوظة بحسابك. تقدر ترفع PDF أو صورة أو DOCX بحد 5 م.ب.</Text></View></View><View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={18} color="#0B5D45" /><Text style={styles.noticeText}>التحميل والحذف يخضعان لصلاحية حسابك. الملفات المرتبطة بمعاملة تبقى محفوظة ضمن سجلها.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="رفع مستند جديد" disabled={uploading} onPress={() => void pickAndUpload()} style={[styles.upload, uploading && styles.disabled]}>{uploading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />}<Text style={styles.uploadText}>{uploading ? "قاعد نرفع المستند…" : "رفع مستند"}</Text></Pressable></>} ListEmptyComponent={query.isLoading ? <View style={styles.loading}><ActivityIndicator color="#0B5D45" /></View> : <EmptyState onAdd={() => void pickAndUpload()} />} renderItem={({ item }) => <View style={styles.card}><View style={styles.cardTop}><View style={styles.iconBox}><Ionicons name={item.mimeType === "application/pdf" ? "document-text-outline" : item.mimeType.includes("image") ? "image-outline" : "document-outline"} size={22} color="#0B5D45" /></View><View style={styles.copy}><Text numberOfLines={1} style={styles.fileName}>{item.fileName}</Text><Text style={styles.meta}>{formatSize(item.fileSizeBytes)} · {item.documentType ?? "غير مصنف"}</Text><Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString("ar-SA")} · {item.verificationStatus === "verified" ? "متحقق" : "بانتظار التحقق"}</Text></View></View><View style={styles.actions}><Pressable disabled={download.isPending} onPress={() => void openDocument(item.id)} style={[styles.action, download.isPending && styles.disabled]}><Ionicons name="eye-outline" size={16} color="#0B5D45" /><Text style={styles.actionText}>عرض</Text></Pressable><Pressable onPress={() => deleteDocument(item.id, item.fileName)} style={styles.action}><Ionicons name="trash-outline" size={16} color="#A24A05" /><Text style={[styles.actionText, styles.deleteText]}>حذف</Text></Pressable></View></View>} /></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { alignSelf: "center", maxWidth: 780, padding: 18, paddingBottom: 44, width: "100%" }, header: { alignItems: "center", flexDirection: "row-reverse", gap: 11 }, back: { alignItems: "center", backgroundColor: "#F0F4F0", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, headerCopy: { alignItems: "flex-end", flex: 1 }, title: { color: "#17382F", fontSize: 21, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, subtitle: { color: "#66756E", fontSize: 11, lineHeight: 18, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, notice: { alignItems: "flex-start", backgroundColor: "#F1F8F3", borderColor: "#D7E9DB", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 8, marginTop: 15, padding: 11 }, noticeText: { color: "#49665B", flex: 1, fontSize: 10, lineHeight: 16, textAlign: "right", writingDirection: "rtl" }, upload: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 15, flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginVertical: 15, minHeight: 49 }, uploadText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", writingDirection: "rtl" }, card: { backgroundColor: "#FFFFFF", borderColor: "#E1E9E3", borderRadius: 18, borderWidth: 1, marginBottom: 10, padding: 13 }, cardTop: { alignItems: "center", flexDirection: "row-reverse", gap: 10 }, iconBox: { alignItems: "center", backgroundColor: "#E9F5EC", borderRadius: 13, height: 42, justifyContent: "center", width: 42 }, copy: { alignItems: "flex-end", flex: 1 }, fileName: { color: "#17382F", fontSize: 13, fontWeight: "800", maxWidth: "100%", textAlign: "right", writingDirection: "rtl" }, meta: { color: "#66756E", fontSize: 10, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, actions: { flexDirection: "row-reverse", gap: 12, justifyContent: "flex-start", marginTop: 12 }, action: { alignItems: "center", flexDirection: "row-reverse", gap: 4, minHeight: 32 }, actionText: { color: "#0B5D45", fontSize: 11, fontWeight: "800", writingDirection: "rtl" }, deleteText: { color: "#A24A05" }, center: { alignItems: "center", justifyContent: "center", padding: 30 }, centerTitle: { color: "#17382F", fontSize: 18, fontWeight: "800", marginTop: 12, writingDirection: "rtl" }, centerBody: { color: "#66756E", fontSize: 13, lineHeight: 21, marginTop: 5, textAlign: "center", writingDirection: "rtl" }, primary: { backgroundColor: "#0B5D45", borderRadius: 13, marginTop: 16, paddingHorizontal: 18, paddingVertical: 12 }, primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", writingDirection: "rtl" }, loading: { alignItems: "center", padding: 38 }, disabled: { opacity: 0.6 } });
