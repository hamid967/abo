import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import "@/lib/notification-service";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { TransactionProvider } from "@/lib/transactions-provider";
import { WorkspaceProvider } from "@/lib/workspace-provider";
import { RoleProvider } from "@/lib/role-provider";
import { InquiryProvider } from "@/lib/inquiries-provider";
import { LocaleProvider } from "@/lib/locale-provider";
import { TodayActionsProvider } from "@/lib/today-actions-provider";
import { AccountProvider, useAccount } from "@/hooks/use-account";
import { BiometricUnlockScreen } from "@/components/biometric-unlock-screen";
import { MobileNotificationObserver } from "@/components/mobile-notification-observer";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

function BiometricGate({ children }: PropsWithChildren) {
  const { biometricLocked, biometricAvailability, unlockWithBiometrics, logout } = useAccount();
  if (biometricLocked) {
    return <BiometricUnlockScreen availability={biometricAvailability} onUnlock={unlockWithBiometrics} onFallback={logout} />;
  }
  return children;
}

export default function RootLayout() {
  const [fontsLoaded, fontLoadError] = useFonts({
    "Cairo-Regular": require("@/assets/fonts/Cairo-Regular.ttf"),
    "Cairo-SemiBold": require("@/assets/fonts/Cairo-SemiBold.ttf"),
    "Cairo-Bold": require("@/assets/fonts/Cairo-Bold.ttf"),
    "Cairo-ExtraBold": require("@/assets/fonts/Cairo-ExtraBold.ttf"),
  });
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontLoadError) void SplashScreen.hideAsync();
  }, [fontLoadError, fontsLoaded]);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  if (!fontsLoaded && !fontLoadError) return null;

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
          <LocaleProvider>
          <AccountProvider>
            <BiometricGate>
            <RoleProvider>
              <TransactionProvider>
                <WorkspaceProvider>
                  <InquiryProvider>
                    <TodayActionsProvider>
                      <MobileNotificationObserver />
              <Stack initialRouteName="welcome" screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="welcome" />
                <Stack.Screen name="transaction/form" />
                <Stack.Screen name="transaction/[id]" />
                <Stack.Screen name="workspace/index" />
                <Stack.Screen name="task-tracking/index" />
                <Stack.Screen name="operations/index" />
                <Stack.Screen name="inquiries/index" />
                <Stack.Screen name="notifications/index" />
                <Stack.Screen name="knowledge/index" />
                <Stack.Screen name="search/index" />
                <Stack.Screen name="assistant/index" />
                <Stack.Screen name="assistant/request-intake" />
                <Stack.Screen name="chat/abu-mishal" />
                <Stack.Screen name="admin/chats" />
                <Stack.Screen name="admin/playbooks" />
                <Stack.Screen name="document-summary/index" />
                <Stack.Screen name="security/activity" />
                <Stack.Screen name="today/index" />
                <Stack.Screen name="documents/index" />
                <Stack.Screen name="reports/index" />
                <Stack.Screen name="account/index" />
                <Stack.Screen name="oauth/callback" />
                  </Stack>
                    </TodayActionsProvider>
                  </InquiryProvider>
                </WorkspaceProvider>
              </TransactionProvider>
            </RoleProvider>
            </BiometricGate>
          </AccountProvider>
          </LocaleProvider>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
