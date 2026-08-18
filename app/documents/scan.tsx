import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { File as ExpoFile } from "expo-file-system";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppText as Text } from "@/components/ui/app-text";
import { trpc } from "@/lib/trpc";

const maxFileSize = 5 * 1024 * 1024;

export default function ScanDocumentScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();
  const upload = trpc.documents.upload.useMutation();

  const capture = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.75, base64: false, skipProcessing: false });
      if (photo?.uri) setPhotoUri(photo.uri);
    } catch {
      Alert.alert("ما قدرنا نصور المستند", "تأكد من إذن الكاميرا ثم جرّب مرة ثانية.");
    }
  };

  const savePhoto = async () => {
    if (!photoUri) return;
    try {
      setUploading(true);
      const file = new ExpoFile(photoUri);
      if (!file.size || file.size > maxFileSize) {
        Alert.alert("الصورة كبيرة", "صوّر المستند بإضاءة جيدة ومن مسافة أبعد قليلاً ليبقى الحجم تحت 5 م.ب.");
        return;
      }
      await upload.mutateAsync({ fileName: `scan-${Date.now()}.jpg`, mimeType: "image/jpeg", fileSizeBytes: file.size, contentsBase64: await file.base64() });
      await utils.documents.list.invalidate();
      Alert.alert("تم حفظ المستند", "تمت إضافة الصورة إلى محفظتك. أي تحليل ذكي يتطلب موافقتك في خطوة مستقلة.");
      router.back();
    } catch {
      Alert.alert("ما قدرنا نرفع الصورة", "تحقق من اتصالك ثم جرّب مرة ثانية.");
    } finally {
      setUploading(false);
    }
  };

  if (!permission) return <ScreenContainer style={styles.center}><ActivityIndicator color="#0B5D45" /></ScreenContainer>;
  if (!permission.granted) return <ScreenContainer style={styles.center}><Ionicons name="camera-outline" size={42} color="#0B5D45" /><Text style={styles.permissionTitle}>نحتاج إذن الكاميرا</Text><Text style={styles.permissionBody}>نستخدمها فقط لتصوير مستند تختار أنت رفعه إلى محفظتك.</Text><Pressable onPress={() => void requestPermission()} style={styles.primary}><Text style={styles.primaryText}>السماح بالكاميرا</Text></Pressable><Pressable onPress={() => router.back()} style={styles.secondary}><Text style={styles.secondaryText}>رجوع</Text></Pressable></ScreenContainer>;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><View style={styles.flex}>{photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="contain" /> : <CameraView ref={cameraRef} style={styles.camera} facing="back" />}{!photoUri ? <View style={styles.controls}><Text style={styles.guidance}>ضع المستند داخل الإطار بإضاءة واضحة.</Text><Pressable accessibilityRole="button" accessibilityLabel="تصوير المستند" onPress={() => void capture()} style={styles.capture}><Ionicons name="camera" size={28} color="#FFFFFF" /></Pressable><Pressable onPress={() => router.back()} style={styles.cancel}><Text style={styles.cancelText}>إلغاء</Text></Pressable></View> : <View style={styles.previewControls}><Text style={styles.previewTitle}>راجع الصورة قبل الحفظ</Text><Text style={styles.previewBody}>لن تُحلل الصورة أو تُشارك قبل اختيارك خطوة تحليل مستقلة.</Text><View style={styles.row}><Pressable disabled={uploading} onPress={() => setPhotoUri(null)} style={styles.retake}><Text style={styles.retakeText}>إعادة التصوير</Text></Pressable><Pressable disabled={uploading} onPress={() => void savePhoto()} style={styles.save}>{uploading ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" /><Text style={styles.saveText}>حفظ للمحفظة</Text></>}</Pressable></View></View>}</View></ScreenContainer>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#102C24" }, center: { alignItems: "center", justifyContent: "center", padding: 28 }, permissionTitle: { color: "#17382F", fontSize: 19, fontWeight: "900", marginTop: 13, writingDirection: "rtl" }, permissionBody: { color: "#66756E", fontSize: 13, lineHeight: 21, marginTop: 7, textAlign: "center", writingDirection: "rtl" }, primary: { backgroundColor: "#0B5D45", borderRadius: 13, marginTop: 18, paddingHorizontal: 18, paddingVertical: 12 }, primaryText: { color: "#FFFFFF", fontWeight: "800", writingDirection: "rtl" }, secondary: { marginTop: 10, padding: 10 }, secondaryText: { color: "#0B5D45", fontWeight: "800", writingDirection: "rtl" }, camera: { flex: 1 }, preview: { flex: 1, width: "100%" }, controls: { alignItems: "center", backgroundColor: "rgba(16,44,36,0.92)", bottom: 0, left: 0, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 18, position: "absolute", right: 0 }, guidance: { color: "#FFFFFF", fontSize: 13, writingDirection: "rtl" }, capture: { alignItems: "center", backgroundColor: "#0B5D45", borderColor: "#FFFFFF", borderRadius: 36, borderWidth: 4, height: 68, justifyContent: "center", marginTop: 15, width: 68 }, cancel: { marginTop: 10, padding: 8 }, cancelText: { color: "#FFFFFF", fontWeight: "800", writingDirection: "rtl" }, previewControls: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 22, borderTopRightRadius: 22, bottom: 0, left: 0, padding: 18, position: "absolute", right: 0 }, previewTitle: { color: "#17382F", fontSize: 16, fontWeight: "900", textAlign: "right", writingDirection: "rtl" }, previewBody: { color: "#66756E", fontSize: 11, lineHeight: 17, marginTop: 5, textAlign: "right", writingDirection: "rtl" }, row: { flexDirection: "row-reverse", gap: 9, marginTop: 14 }, retake: { alignItems: "center", borderColor: "#0B5D45", borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 }, retakeText: { color: "#0B5D45", fontWeight: "800", writingDirection: "rtl" }, save: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 12, flex: 1.4, flexDirection: "row-reverse", gap: 6, justifyContent: "center", minHeight: 48 }, saveText: { color: "#FFFFFF", fontWeight: "800", writingDirection: "rtl" },
});
