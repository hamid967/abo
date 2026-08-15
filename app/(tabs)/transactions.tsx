import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/status-pill";
import { TransactionCard } from "@/components/transaction-card";
import { AppText as Text } from "@/components/ui/app-text";
import { FeedbackState } from "@/components/ui/feedback-state";
import { isTransactionOverdue, statusDetails, TransactionStatus, transactionStatuses } from "@/lib/transactions";
import { useTransactions } from "@/lib/transactions-provider";
import { useState } from "react";

const filters: (TransactionStatus | "all")[] = ["all", ...transactionStatuses];
type ColorFilter = "all" | "blue" | "amber" | "red" | "green";

const quickColorFilters: { id: ColorFilter; label: string; color: string; soft: string }[] = [
  { id: "all", label: "الكل", color: "#49665B", soft: "#F2F6F3" },
  { id: "blue", label: "قيد المتابعة", color: "#0B5CAD", soft: "#EAF3FF" },
  { id: "amber", label: "إجراء مطلوب", color: "#B45309", soft: "#FFF4E5" },
  { id: "red", label: "تحتاج انتباهاً", color: "#B42318", soft: "#FFF0EF" },
  { id: "green", label: "مكتملة وجاهزة", color: "#17804B", soft: "#E8F6EC" },
];

export default function TransactionsScreen() {
  const router = useRouter();
  const { transactions, isLoading } = useTransactions();
  const [filter, setFilter] = useState<TransactionStatus | "all">("all");
  const [colorFilter, setColorFilter] = useState<ColorFilter>("all");
  const shownTransactions = transactions.filter((transaction) => {
    const computedStatus = isTransactionOverdue(transaction) ? "overdue" : transaction.status;
    const matchesSpecificStatus = filter === "all" || transaction.status === filter;
    const matchesColor = colorFilter === "all" || statusDetails[computedStatus].tone === colorFilter;
    return matchesSpecificStatus && matchesColor;
  });

  if (isLoading) {
    return <ScreenContainer style={styles.loading}><FeedbackState kind="loading" title="جارٍ تجهيز معاملاتك" description="نسترجع أحدث حالات المتابعة والمواعيد المسجلة." /></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <FlatList
        contentContainerStyle={styles.content}
        data={shownTransactions}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <View style={styles.titleRow}>
              <Pressable onPress={() => router.push("/assistant/request-intake" as never)} style={({ pressed }) => [styles.addIcon, pressed && styles.pressed]}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </Pressable>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>معاملاتي</Text>
                <Text style={styles.subtitle}>{transactions.length ? `${transactions.length} طلبات قيد المتابعة` : "ابدأ طلبك واترك أبو مشعل ينظم المتابعة"}</Text>
              </View>
            </View>
            <View style={styles.quickFilterHeader}>
              <Text style={styles.quickFilterTitle}>تصفية سريعة بالحالة</Text>
              <Text style={styles.resultCount}>{shownTransactions.length} نتيجة</Text>
            </View>
            <FlatList
              contentContainerStyle={styles.quickFilterList}
              data={quickColorFilters}
              horizontal
              inverted
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const isActive = colorFilter === item.id;
                return <Pressable onPress={() => setColorFilter(item.id)} style={({ pressed }) => [styles.quickFilter, { backgroundColor: isActive ? item.soft : "#FFFFFF", borderColor: isActive ? item.color : "#E2EAE4" }, pressed && styles.pressed]}><View style={[styles.colorDot, { backgroundColor: item.color }]} /><Text style={[styles.quickFilterText, { color: isActive ? item.color : "#587066" }]}>{item.label}</Text></Pressable>;
              }}
            />
            <FlatList
              contentContainerStyle={styles.filterList}
              data={filters}
              horizontal
              inverted
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const isActive = filter === item;
                return (
                  <Pressable onPress={() => setFilter(item)} style={({ pressed }) => [styles.filter, isActive && styles.activeFilter, pressed && styles.pressed]}>
                    {item === "all" ? <Text style={[styles.filterText, isActive && styles.activeFilterText]}>الكل</Text> : <StatusPill status={item} />}
                  </Pressable>
                );
              }}
            />
          </>
        }
        renderItem={({ item }) => <TransactionCard transaction={item} onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: item.id } })} />}
        ListEmptyComponent={<EmptyState onAdd={() => router.push("/assistant/request-intake" as never)} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 120 },
  titleRow: { alignItems: "center", flexDirection: "row-reverse", gap: 12, marginBottom: 18 },
  addIcon: { alignItems: "center", backgroundColor: "#0B5D45", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  titleCopy: { alignItems: "flex-end", flex: 1 },
  title: { color: "#172033", fontSize: 24, fontWeight: "800", writingDirection: "rtl" },
  subtitle: { color: "#667085", fontSize: 12, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  quickFilterHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 9 },
  quickFilterTitle: { color: "#17382F", fontSize: 13, fontWeight: "900", writingDirection: "rtl" },
  resultCount: { color: "#6A7C73", fontSize: 11, fontWeight: "700", writingDirection: "rtl" },
  quickFilterList: { gap: 8, paddingBottom: 18 },
  quickFilter: { alignItems: "center", borderRadius: 999, borderWidth: 1, flexDirection: "row-reverse", gap: 6, minHeight: 38, paddingHorizontal: 11 },
  colorDot: { borderRadius: 5, height: 9, width: 9 },
  quickFilterText: { fontSize: 12, fontWeight: "800", writingDirection: "rtl" },
  filterList: { gap: 8, paddingBottom: 18 },
  filter: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E6EAF0", borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: 12 },
  activeFilter: { backgroundColor: "#E9F5EC", borderColor: "#0B5D45" },
  filterText: { color: "#667085", fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
  activeFilterText: { color: "#0B5D45" },
  pressed: { opacity: 0.7 },
});
