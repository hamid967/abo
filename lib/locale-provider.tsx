import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

export type AppLocale = "ar" | "en";

type LocaleContextValue = {
  locale: AppLocale;
  direction: "rtl" | "ltr";
  isArabic: boolean;
  setLocale: (locale: AppLocale) => Promise<void>;
};

const LOCALE_KEY = "abu-mishal.locale.v1";
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setCurrentLocale] = useState<AppLocale>("ar");
  useEffect(() => { void AsyncStorage.getItem(LOCALE_KEY).then((value) => { if (value === "ar" || value === "en") setCurrentLocale(value); }); }, []);
  const setLocale = async (nextLocale: AppLocale) => { setCurrentLocale(nextLocale); await AsyncStorage.setItem(LOCALE_KEY, nextLocale); };
  const direction: "rtl" | "ltr" = locale === "ar" ? "rtl" : "ltr";
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.dir = direction;
      document.documentElement.lang = locale;
    }
  }, [direction, locale]);
  const value = useMemo(() => ({ locale, direction, isArabic: locale === "ar", setLocale }), [locale, direction]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within LocaleProvider");
  return value;
}
