import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useReducedMotion } from "@/hooks/use-reduced-motion";

export function ActivitySkeleton() {
  const { reducedMotion, isReady } = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.48)).current;

  useEffect(() => {
    if (!isReady || reducedMotion) {
      opacity.stopAnimation();
      opacity.setValue(0.48);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.9, duration: 850, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.48, duration: 850, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isReady, opacity, reducedMotion]);

  return <View accessibilityLabel="جارٍ تحميل نشاط الحساب" accessibilityRole="progressbar" style={styles.container}>
    <Animated.View style={[styles.note, { opacity }]} />
    <View style={styles.sectionLine}><Animated.View style={[styles.section, { opacity }]} /><Animated.View style={[styles.shortLine, { opacity }]} /></View>
    {[1, 2, 3].map((item) => <Animated.View key={item} style={[styles.card, { opacity }]}><View style={styles.icon} /><View style={styles.copy}><View style={styles.title} /><View style={styles.body} /><View style={styles.meta} /></View></Animated.View>)}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingTop: 8 },
  note: { backgroundColor: "#E4EEE7", borderRadius: 14, height: 54, width: "100%" },
  sectionLine: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 6 },
  section: { backgroundColor: "#D9E7DE", borderRadius: 6, height: 18, width: 126 },
  shortLine: { backgroundColor: "#E4EEE7", borderRadius: 5, height: 12, width: 62 },
  card: { alignItems: "center", backgroundColor: "#F5F8F5", borderColor: "#E4ECE6", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 10, minHeight: 88, padding: 14 },
  icon: { backgroundColor: "#D9E7DE", borderRadius: 13, height: 42, width: 42 },
  copy: { alignItems: "flex-end", flex: 1, gap: 8 },
  title: { backgroundColor: "#D9E7DE", borderRadius: 5, height: 13, width: "62%" },
  body: { backgroundColor: "#E4EEE7", borderRadius: 5, height: 10, width: "78%" },
  meta: { backgroundColor: "#EAF1EB", borderRadius: 5, height: 9, width: "42%" },
});
