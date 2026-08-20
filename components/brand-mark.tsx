import { Image, StyleSheet, type ImageStyle, type StyleProp } from "react-native";

const brandMark = require("@/assets/images/abu-mishal-brand-icon.png");

type BrandMarkProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
};

export function BrandMark({ size = 48, style, accessibilityLabel = "شعار أبو مشعل" }: BrandMarkProps) {
  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      source={brandMark}
      style={[styles.mark, { borderRadius: Math.round(size * 0.24), height: size, width: size }, style]}
    />
  );
}

const styles = StyleSheet.create({
  mark: {
    resizeMode: "cover",
  },
});
