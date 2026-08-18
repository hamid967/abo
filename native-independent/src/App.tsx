import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "react-native";

import { RootNavigator } from "./navigation/RootNavigator";
import { TransactionStoreProvider } from "./data/transactionStore";

const queryClient = new QueryClient();

export function AbuMishaalApp() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <TransactionStoreProvider>
            <StatusBar barStyle="dark-content" />
            <RootNavigator />
          </TransactionStoreProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
