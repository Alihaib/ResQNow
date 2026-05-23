import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import SubScreenShell from "../../../components/ui/SubScreenShell";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";
import { useUiDirection } from "../../../components/ui/layout";
import { tokens } from "../../../src/ui/tokens";

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
  const { row, chevronForward } = useUiDirection();
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

        const data = snap.data() as Record<string, unknown>;
        const notProvided = "Not provided";

        const contactsSummary =
          Array.isArray(data.emergencyContacts) &&
          (data.emergencyContacts as unknown[]).length > 0
            ? (data.emergencyContacts as { name?: string; phone?: string }[])
                .slice(0, 3)
                .map((c) => `${c.name || "—"}: ${c.phone || "—"}`)
                .join(", ")
            : "No data available";

        const rows: MedicalRecordRow[] = [
          {
            id: "name",
            date: "",
            type: "Full Name",
            doctor: (data.name as string) || notProvided,
            notes: "",
          },
          {
            id: "age",
            date: "",
            type: "Age",
            doctor: data.age ? String(data.age) : notProvided,
            notes: "",
          },
          {
            id: "bloodType",
            date: "",
            type: "Blood Type",
            doctor: (data.bloodType as string) || notProvided,
            notes: "",
          },
          {
            id: "height",
            date: "",
            type: "Height",
            doctor: data.height ? `${data.height} cm` : notProvided,
            notes: "",
          },
          {
            id: "weight",
            date: "",
            type: "Weight",
            doctor: data.weight ? `${data.weight} kg` : notProvided,
            notes: "",
          },
          {
            id: "diseases",
            date: "",
            type: "Medical Conditions",
            doctor:
              typeof data.diseases === "string" && data.diseases.trim()
                ? data.diseases
                : notProvided,
            notes: "",
          },
          {
            id: "medications",
            date: "",
            type: "Medications",
            doctor:
              typeof data.medications === "string" && data.medications.trim()
                ? data.medications
                : notProvided,
            notes: "",
          },
          {
            id: "allergies",
            date: "",
            type: "Allergies",
            doctor:
              typeof data.allergies === "string" && data.allergies.trim()
                ? data.allergies
                : notProvided,
            notes: "",
          },
          {
            id: "emergencyContacts",
            date: "",
            type: "Emergency Contacts",
            doctor: contactsSummary,
            notes:
              Array.isArray(data.emergencyContacts) &&
              (data.emergencyContacts as unknown[]).length > 3
                ? `+${(data.emergencyContacts as unknown[]).length - 3} more`
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
      },
    );

    return () => unsub();
  }, [user?.uid]);

  const hasAnyData = useMemo(() => records.length > 0, [records.length]);
  return (
    <SubScreenShell
      title={t("medicalRecords")}
      fallbackRoute="/(tabs)/profile"
      onBack={() => router.replace("/(tabs)/profile")}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={tokens.color.primary} />
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </View>
      ) : hasAnyData ? (
        records.map((record) => (
          <Card key={record.id} style={styles.recordCard}>
            <View style={[styles.recordHeader, row]}>
              <Text style={styles.recordType}>{record.type}</Text>
              {!!record.date ? (
                <Text style={styles.recordDate}>{record.date}</Text>
              ) : null}
            </View>
            <Text style={styles.recordDoctor}>{record.doctor}</Text>
            {!!record.notes ? (
              <Text style={styles.recordNotes}>{record.notes}</Text>
            ) : null}
            <Text style={styles.chevron}>{chevronForward}</Text>
          </Card>
        ))
      ) : (
        <EmptyState
          ionIcon="medical-outline"
          title={t("noMedicalRecords")}
          subtitle={t("medicalRecordsSubtext")}
        />
      )}
    </SubScreenShell>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    paddingVertical: tokens.space.xxl,
    gap: tokens.space.md,
  },
  loadingText: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textMuted,
    fontWeight: tokens.fontWeight.medium,
  },
  recordCard: {
    marginBottom: tokens.space.sm,
  },
  recordHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.space.sm,
  },
  recordType: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
  },
  recordDate: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
  },
  recordDoctor: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textSecondary,
    fontWeight: tokens.fontWeight.medium,
  },
  recordNotes: {
    marginTop: tokens.space.xs,
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
  },
  chevron: {
    position: "absolute",
    end: tokens.space.lg,
    top: tokens.space.lg,
    fontSize: tokens.font.h3,
    color: tokens.color.textFaint,
    fontWeight: tokens.fontWeight.semibold,
  },
});
