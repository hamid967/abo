import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/status-pill";
import { TransactionCard } from "@/components/transaction-card";
import { TransactionStatus, transactionStatuses } from "@/lib/transactions";
import { useTransactions } from "@/lib/transactions-provider";
import { useState } from "react";

const filters: (TransactionStatus | "all")[] = ["all", ...transactionStatuses];

export default function TransactionsScreen() {
  const router = useRouter();
  const { transactions, isLoading } = useTransactions();
  const [filter, setFilter] = useState<TransactionStatus | "all">("all");
  const shownTransactions = filter === "all" ? transactions : transactions.filter((transaction) => transaction.status === filter);

  if (isLoading) {
    return <ScreenContainer style={styles.loading}><ActivityIndicator color="#0B5CAD" /></ScreenContainer>;
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
              <Pressable onPress={() => router.push("/transaction/form")} style={({ pressed }) => [styles.addIcon, pressed && styles.pressed]}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </Pressable>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>المعاملات</Text>
                <Text style={styles.subtitle}>{transactions.length ? `${transactions.length} سجلات محفوظة على جهازك` : "نظّم معاملاتك في مكان واحد"}</Text>
              </View>
            </View>
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
        ListEmptyComponent={<EmptyState onAdd={() => router.push("/transaction/form")} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 120 },
  titleRow: { alignItems: "center", flexDirection: "row-reverse", gap: 12, marginBottom: 18 },
  addIcon: { alignItems: "center", backgroundColor: "#0B5CAD", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  titleCopy: { alignItems: "flex-end", flex: 1 },
  title: { color: "#172033", fontSize: 24, fontWeight: "800", writingDirection: "rtl" },
  subtitle: { color: "#667085", fontSize: 12, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  filterList: { gap: 8, paddingBottom: 18 },
  filter: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E6EAF0", borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: 12 },
  activeFilter: { backgroundColor: "#EAF3FF", borderColor: "#0B5CAD" },
  filterText: { color: "#667085", fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
  activeFilterText: { color: "#0B5CAD" },
  pressed: { opacity: 0.7 },
});
