import { forwardRef } from "react";
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
  type StyleProp,
  type TextStyle,
} from "react-native";

export const appFontFamily = {
  regular: "Cairo-Regular",
  semiBold: "Cairo-SemiBold",
  bold: "Cairo-Bold",
  extraBold: "Cairo-ExtraBold",
} as const;

function resolveFontFamily(style: StyleProp<TextStyle>) {
  const flattenedStyle = StyleSheet.flatten(style);
  if (flattenedStyle?.fontFamily) return flattenedStyle.fontFamily;

  const weight = Number.parseInt(String(flattenedStyle?.fontWeight ?? "400"), 10);
  if (weight >= 800) return appFontFamily.extraBold;
  if (weight >= 700) return appFontFamily.bold;
  if (weight >= 600) return appFontFamily.semiBold;
  return appFontFamily.regular;
}

/** طبقة النص الموحدة لأبو مشعل؛ تختار وزن Cairo المطابق لتنسيق النص الحالي. */
export const AppText = forwardRef<NativeText, TextProps>(({ style, ...props }, ref) => (
  <NativeText ref={ref} style={[style, { fontFamily: resolveFontFamily(style) }]} {...props} />
));
AppText.displayName = "AppText";

/** طبقة إدخال نص موحدة بالخط نفسه، بما في ذلك حقول البحث والنماذج والمحادثة. */
export const AppTextInput = forwardRef<NativeTextInput, TextInputProps>(({ style, ...props }, ref) => (
  <NativeTextInput ref={ref} style={[style, { fontFamily: resolveFontFamily(style) }]} {...props} />
));
AppTextInput.displayName = "AppTextInput";
