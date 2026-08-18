import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { theme } from "../theme";
import { statusColor, statusLabel, type TransactionListItem } from "../data/transactions";
import { useTransactionStore } from "../data/transactionStore";

type Props = NativeStackScreenProps<RootStackParamList, "Transactions">;

export function TransactionsScreen({ navigation }: Props) {
  const { transactions, loading, error, refresh } = useTransactionStore();
  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.loading}>جارٍ تحميل المعاملات…</Text></View>;
  return (
    <FlatList data={transactions} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.content}
      ListHeaderComponent={<View style={styles.heading}><Text style={styles.title}>معاملاتي</Text><Text style={styles.description}>{transactions.length ? `${transactions.length} معاملات مرتبطة بحسابك` : "لا توجد معاملات ظاهرة في حسابك."}</Text>{error ? <Pressable onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable> : null}</View>}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>ما عندك معاملات للحين</Text><Text style={styles.description}>تنشأ المعاملة بعد تأكيدها من المحادثة أو إضافتها من الفريق المخوّل.</Text></View>}
      renderItem={({ item }) => <TransactionCard item={item} onPress={() => navigation.navigate("TransactionDetail", { transactionId: item.id })} />}
    />
  );
}

function TransactionCard({ item, onPress }: { item: TransactionListItem; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.cardTop}><View><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardSub}>{item.referenceNumber ?? `AM-${item.id}`}{item.serviceName ? ` · ${item.serviceName}` : ""}</Text></View><View style={[styles.badge, { backgroundColor: `${statusColor(item.status)}18` }]}><Text style={[styles.badgeText, { color: statusColor(item.status) }]}>{statusLabel[item.status] ?? item.status}</Text></View></View><Text style={styles.action}>{item.nextAction ?? "بانتظار الإجراء التالي"}</Text><Text style={styles.updated}>آخر تحديث: {new Date(item.updatedAt).toLocaleDateString("ar-SA")}</Text></Pressable>; }

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 }, center: { alignItems: "center", flex: 1, justifyContent: "center" }, loading: { color: theme.colors.muted, marginTop: 10, writingDirection: "rtl" }, heading: { alignItems: "flex-end", marginBottom: 14 }, title: { color: theme.colors.foreground, fontSize: 26, fontWeight: "900", textAlign: "right", writingDirection: "rtl" }, description: { color: theme.colors.muted, fontSize: 13, lineHeight: 21, marginTop: 5, textAlign: "right", writingDirection: "rtl" }, retry: { backgroundColor: "#E8F4ED", borderRadius: 10, marginTop: 10, paddingHorizontal: 12, paddingVertical: 9 }, retryText: { color: theme.colors.primary, fontWeight: "900", writingDirection: "rtl" }, card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: 15, borderWidth: 1, marginBottom: 11, padding: 15 }, pressed: { opacity: 0.72 }, cardTop: { alignItems: "flex-start", flexDirection: "row-reverse", justifyContent: "space-between" }, cardTitle: { color: theme.colors.foreground, fontSize: 16, fontWeight: "900", textAlign: "right", writingDirection: "rtl" }, cardSub: { color: theme.colors.muted, fontSize: 12, marginTop: 5, textAlign: "right", writingDirection: "rtl" }, badge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6 }, badgeText: { fontSize: 11, fontWeight: "900", writingDirection: "rtl" }, action: { color: theme.colors.primary, fontSize: 12, marginTop: 13, textAlign: "right", writingDirection: "rtl" }, updated: { color: theme.colors.muted, fontSize: 11, marginTop: 9, textAlign: "right", writingDirection: "rtl" }, empty: { alignItems: "center", paddingTop: 56 }, emptyTitle: { color: theme.colors.foreground, fontSize: 17, fontWeight: "900", writingDirection: "rtl" },
});
