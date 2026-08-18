import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { HomeScreen } from "../screens/HomeScreen";
import { MigrationStatusScreen } from "../screens/MigrationStatusScreen";
import { OAuthCallbackScreen } from "../screens/OAuthCallbackScreen";
import { TransactionsScreen } from "../screens/TransactionsScreen";
import { TransactionDetailScreen } from "../screens/TransactionDetailScreen";
import { theme } from "../theme";

export type RootStackParamList = {
  Home: undefined;
  Transactions: undefined;
  TransactionDetail: { transactionId: number };
  MigrationStatus: undefined;
  OAuthCallback: { attempt?: string; code?: string; state?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer linking={{ prefixes: ["abumishaal://"], config: { screens: { OAuthCallback: "oauth/callback" } } }}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerBackTitle: "رجوع",
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.primary,
          headerTitleAlign: "center",
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "أبو مشعل" }} />
        <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: "المعاملات" }} />
        <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: "تفاصيل المعاملة" }} />
        <Stack.Screen name="MigrationStatus" component={MigrationStatusScreen} options={{ title: "حالة الترحيل" }} />
        <Stack.Screen name="OAuthCallback" component={OAuthCallbackScreen} options={{ title: "تأكيد الدخول" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
