import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";

type MedicalRecordRow = {
  id: string;
  date: string;
  type: string;
  doctor: string;
  notes: string;
};

export default function MedicalRecordsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<MedicalRecordRow[]>([]);

  useEffect(() => {
    if (!user?.uid) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setRecords([]);
          setLoading(false);
          return;
        }

        const data = snap.data() as any;
        const notProvided = "Not provided";

        const contactsSummary =
          Array.isArray(data.emergencyContacts) && data.emergencyContacts.length > 0
            ? data.emergencyContacts
                .slice(0, 3)
                .map((c: any) => `${c.name || "—"}: ${c.phone || "—"}`)
                .join(", ")
            : "No data available";

        const rows: MedicalRecordRow[] = [
          { id: "name", date: "", type: "Full Name", doctor: data.name || notProvided, notes: "" },
          { id: "age", date: "", type: "Age", doctor: data.age ? String(data.age) : notProvided, notes: "" },
          { id: "bloodType", date: "", type: "Blood Type", doctor: data.bloodType || notProvided, notes: "" },
          { id: "height", date: "", type: "Height", doctor: data.height ? `${data.height} cm` : notProvided, notes: "" },
          { id: "weight", date: "", type: "Weight", doctor: data.weight ? `${data.weight} kg` : notProvided, notes: "" },
          {
            id: "diseases",
            date: "",
            type: "Medical Conditions",
            doctor: data.diseases?.trim?.() ? data.diseases : notProvided,
            notes: "",
          },
          {
            id: "medications",
            date: "",
            type: "Medications",
            doctor: data.medications?.trim?.() ? data.medications : notProvided,
            notes: "",
          },
          {
            id: "allergies",
            date: "",
            type: "Allergies",
            doctor: data.allergies?.trim?.() ? data.allergies : notProvided,
            notes: "",
          },
          {
            id: "emergencyContacts",
            date: "",
            type: "Emergency Contacts",
            doctor: contactsSummary,
            notes:
              Array.isArray(data.emergencyContacts) && data.emergencyContacts.length > 3
                ? `+${data.emergencyContacts.length - 3} more`
                : "",
          },
        ];

        setRecords(rows);
        setLoading(false);
      },
      (err) => {
        console.error("medical-records onSnapshot error:", err);
        setRecords([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  const hasAnyData = useMemo(() => records.length > 0, [records.length]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            // Always return to Profile tab from Profile sub-screens
            router.replace("/(tabs)/profile");
          }} 
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹ {t("back")}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t("medicalRecords")}</Text>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#D62828" />
          <Text style={[styles.emptyText, { marginTop: 16 }]}>{t("loading")}</Text>
        </View>
      ) : hasAnyData ? (
        records.map((record) => (
          <TouchableOpacity key={record.id} style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordType}>{record.type}</Text>
              {!!record.date && <Text style={styles.recordDate}>{record.date}</Text>}
            </View>
            <Text style={styles.recordDoctor}>{record.doctor}</Text>
            {!!record.notes && <Text style={styles.recordNotes}>{record.notes}</Text>}
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





