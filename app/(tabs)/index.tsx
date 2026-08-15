import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { TransactionCard } from "@/components/transaction-card";
import { ScreenContainer } from "@/components/screen-container";
import { useTransactions } from "@/lib/transactions-provider";

export default function HomeScreen() {
  const router = useRouter();
  const { transactions, isLoading } = useTransactions();
  const activeCount = transactions.filter((transaction) => transaction.status !== "completed").length;
  const nearestDue = transactions
    .filter((transaction) => transaction.dueDate && transaction.status !== "completed")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];

  if (isLoading) {
    return (
      <ScreenContainer style={styles.loading}>
        <ActivityIndicator color="#0B5CAD" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FlatList
        contentContainerStyle={styles.content}
        data={transactions.slice(0, 4)}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.brandMark}><Ionicons name="shield-checkmark" size={21} color="#FFFFFF" /></View>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>متابع المعاملات الحكومية</Text>
                <Text style={styles.greeting}>مرحباً، تابع معاملاتك</Text>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, styles.primarySummary]}>
                <Ionicons name="layers-outline" size={22} color="#CFE6FF" />
                <Text style={styles.summaryNumber}>{activeCount}</Text>
                <Text style={styles.summaryLabel}>معاملة قيد المتابعة</Text>
              </View>
              <View style={styles.summaryCard}>
                <Ionicons name="checkmark-circle-outline" size={22} color="#15803D" />
                <Text style={[styles.summaryNumber, styles.darkNumber]}>{transactions.filter((transaction) => transaction.status === "completed").length}</Text>
                <Text style={[styles.summaryLabel, styles.darkLabel]}>معاملة مكتملة</Text>
              </View>
            </View>

            <View style={styles.nextCard}>
              <View style={styles.nextIcon}><Ionicons name="calendar" size={20} color="#B45309" /></View>
              <View style={styles.nextCopy}>
                <Text style={styles.nextTitle}>الموعد الأقرب</Text>
                <Text style={styles.nextText}>{nearestDue ? `${nearestDue.title} · ${nearestDue.dueDate}` : "سجّل تاريخ متابعة لأي معاملة لتظهر هنا."}</Text>
              </View>
            </View>

            <View style={styles.sectionTitleRow}>
              <Pressable onPress={() => router.push("/(tabs)/transactions")}><Text style={styles.allLink}>عرض الكل</Text></Pressable>
              <Text style={styles.sectionTitle}>أحدث المعاملات</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TransactionCard
            transaction={item}
            onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={<EmptyState onAdd={() => router.push("/transaction/form")} />}
        ListFooterComponent={
          transactions.length > 0 ? (
            <Pressable onPress={() => router.push("/transaction/form")} style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
              <Text style={styles.addButtonText}>إضافة معاملة جديدة</Text>
            </Pressable>
          ) : null
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 120 },
  header: { alignItems: "center", flexDirection: "row-reverse", gap: 12, marginBottom: 24 },
  brandMark: { alignItems: "center", backgroundColor: "#0B5CAD", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  headerText: { alignItems: "flex-end", flex: 1 },
  eyebrow: { color: "#667085", fontSize: 12, fontWeight: "600", writingDirection: "rtl" },
  greeting: { color: "#172033", fontSize: 20, fontWeight: "800", marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  summaryGrid: { flexDirection: "row-reverse", gap: 12, marginBottom: 14 },
  summaryCard: { backgroundColor: "#FFFFFF", borderColor: "#E6EAF0", borderRadius: 20, borderWidth: 1, flex: 1, minHeight: 134, padding: 16 },
  primarySummary: { backgroundColor: "#0B5CAD", borderColor: "#0B5CAD" },
  summaryNumber: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", marginTop: 12 },
  darkNumber: { color: "#172033" },
  summaryLabel: { color: "#E6F2FF", fontSize: 12, fontWeight: "600", lineHeight: 18, marginTop: 3, writingDirection: "rtl" },
  darkLabel: { color: "#667085" },
  nextCard: { alignItems: "center", backgroundColor: "#FFF8EF", borderColor: "#F7D9AB", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 12, marginBottom: 26, padding: 14 },
  nextIcon: { alignItems: "center", backgroundColor: "#FFF0DA", borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  nextCopy: { alignItems: "flex-end", flex: 1 },
  nextTitle: { color: "#9A4A08", fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
  nextText: { color: "#7C5A36", fontSize: 12, marginTop: 4, textAlign: "right", writingDirection: "rtl" },
  sectionTitleRow: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: "#172033", fontSize: 18, fontWeight: "800", writingDirection: "rtl" },
  allLink: { color: "#0B5CAD", fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
  addButton: { alignItems: "center", backgroundColor: "#0B5CAD", borderRadius: 16, flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginTop: 12, paddingVertical: 15 },
  addButtonPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  addButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", writingDirection: "rtl" },
});
