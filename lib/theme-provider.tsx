import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Appearance, Easing, StyleSheet, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => Promise<void>;
  isTransitioning: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = "abu-mishal.theme.v1";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(systemScheme);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionColor, setTransitionColor] = useState(SchemeColors[systemScheme].background);
  const transitionOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AsyncStorage.getItem(THEME_KEY).then((storedScheme) => {
      if (storedScheme === "light" || storedScheme === "dark") setColorSchemeState(storedScheme);
    });
  }, []);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion).catch(() => setReducedMotion(false));
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => subscription.remove();
  }, []);

  const applyScheme = useCallback((scheme: ColorScheme) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);

  const setColorScheme = useCallback(async (scheme: ColorScheme) => {
    if (scheme === colorScheme || isTransitioning) return;
    setIsTransitioning(true);
    const updateScheme = () => {
      setColorSchemeState(scheme);
      applyScheme(scheme);
    };
    try {
      if (!reducedMotion) {
        setTransitionColor(SchemeColors[scheme].background);
        await new Promise<void>((resolve) => {
          Animated.timing(transitionOpacity, { toValue: 0.28, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
            updateScheme();
            Animated.timing(transitionOpacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => resolve());
          });
        });
      } else {
        updateScheme();
      }
      await AsyncStorage.setItem(THEME_KEY, scheme);
    } finally {
      setIsTransitioning(false);
    }
  }, [applyScheme, colorScheme, isTransitioning, reducedMotion, transitionOpacity]);

  useEffect(() => {
    applyScheme(colorScheme);
  }, [applyScheme, colorScheme]);

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": SchemeColors[colorScheme].primary,
        "color-background": SchemeColors[colorScheme].background,
        "color-surface": SchemeColors[colorScheme].surface,
        "color-foreground": SchemeColors[colorScheme].foreground,
        "color-muted": SchemeColors[colorScheme].muted,
        "color-border": SchemeColors[colorScheme].border,
        "color-success": SchemeColors[colorScheme].success,
        "color-warning": SchemeColors[colorScheme].warning,
        "color-error": SchemeColors[colorScheme].error,
        "color-info": SchemeColors[colorScheme].info,
      }),
    [colorScheme],
  );

  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
      isTransitioning,
    }),
    [colorScheme, isTransitioning, setColorScheme],
  );
  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>
        {children}
        <Animated.View pointerEvents="none" style={[styles.themeTransition, { backgroundColor: transitionColor, opacity: transitionOpacity }]} />
      </View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  themeTransition: { ...StyleSheet.absoluteFillObject },
});
