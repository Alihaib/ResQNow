import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../../src/context/LanguageContext";

const historyItems = [
  {
    id: "1",
    date: "2024-01-15",
    time: "14:30",
    type: "Medical Emergency",
    status: "Completed",
  },
  {
    id: "2",
    date: "2024-01-10",
    time: "09:15",
    type: "Accident",
    status: "Completed",
  },
];

export default function EmergencyHistoryScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ {t("back")}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t("emergencyHistory")}</Text>
      </View>

      {historyItems.length > 0 ? (
        historyItems.map((item) => (
          <TouchableOpacity key={item.id} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyType}>{item.type}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.historyDate}>
              {item.date} at {item.time}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>{t("noEmergencyHistory")}</Text>
          <Text style={styles.emptySubtext}>{t("emergencyHistorySubtext")}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  content: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 18,
    color: "#003049",
    fontWeight: "700",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#003049",
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  historyType: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
  },
  statusBadge: {
    backgroundColor: "#D1FAE5",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2D6A4F",
  },
  historyDate: {
    fontSize: 14,
    color: "#6C757D",
  },
  chevron: {
    position: "absolute",
    right: 20,
    top: 20,
    fontSize: 24,
    color: "#6C757D",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6C757D",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#ADB5BD",
  },
});





