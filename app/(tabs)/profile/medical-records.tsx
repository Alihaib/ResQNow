import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../../src/context/LanguageContext";

const records = [
  {
    id: "1",
    date: "2024-01-10",
    type: "Doctor Visit",
    doctor: "Dr. Sarah Cohen",
    notes: "Routine checkup",
  },
  {
    id: "2",
    date: "2023-12-20",
    type: "Lab Test",
    doctor: "Lab Center",
    notes: "Blood test results",
  },
];

export default function MedicalRecordsScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/profile");
            }
          }} 
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹ {t("back")}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t("medicalRecords")}</Text>
      </View>

      {records.length > 0 ? (
        records.map((record) => (
          <TouchableOpacity key={record.id} style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordType}>{record.type}</Text>
              <Text style={styles.recordDate}>{record.date}</Text>
            </View>
            <Text style={styles.recordDoctor}>{record.doctor}</Text>
            <Text style={styles.recordNotes}>{record.notes}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏥</Text>
          <Text style={styles.emptyText}>{t("noMedicalRecords")}</Text>
          <Text style={styles.emptySubtext}>{t("medicalRecordsSubtext")}</Text>
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
  recordCard: {
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
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  recordType: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
  },
  recordDate: {
    fontSize: 14,
    color: "#6C757D",
  },
  recordDoctor: {
    fontSize: 16,
    color: "#212529",
    marginBottom: 4,
  },
  recordNotes: {
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





