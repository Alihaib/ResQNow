import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppPageHeader from "../../components/ui/AppPageHeader";
import Card from "../../components/ui/Card";
import ListRow from "../../components/ui/ListRow";
import SectionHeader from "../../components/ui/SectionHeader";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";
import { pageStyles, tokens } from "../../src/ui/tokens";

export default function ProfileTab() {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sharing, setSharing] = useState(false);
  const [israeliId, setIsraeliId] = useState<string | null>(null);

  // Load Israeli ID from Firestore
  useEffect(() => {
    if (!user) return;

    const loadIsraeliId = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIsraeliId(data.israeliId || null);
        }
      } catch (error) {
        console.error("Error loading Israeli ID:", error);
      }
    };

    loadIsraeliId();
  }, [user]);

  const shareMedicalInfo = async () => {
    if (!user) {
      Alert.alert(t("error"), t("userNotLoggedIn"));
      return;
    }

    setSharing(true);
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        Alert.alert(t("error"), "No medical information found");
        setSharing(false);
        return;
      }

      const data = docSnap.data();
      
      // Format medical information for sharing
      const medicalInfo = `
${t("appName")} — ${t("shareMedicalProfile")}

${t("personalInformation")}:
${data.name ? `${t("name")}: ${data.name}` : ""}
${data.age ? `${t("age")}: ${data.age}` : ""}
${data.bloodType ? `${t("blood_type")}: ${data.bloodType}` : ""}
${data.weight ? `${t("weight")}: ${data.weight} kg` : ""}
${data.height ? `${t("height")}: ${data.height} cm` : ""}

${t("medicalHistory")}:
${data.diseases ? `${t("diseases")}: ${data.diseases}` : ""}
${data.medications ? `${t("medications")}: ${data.medications}` : ""}
${data.allergies ? `${t("allergies")}: ${data.allergies}` : ""}
${data.sensitiveNotes ? `${t("sensitive_notes")}: ${data.sensitiveNotes}` : ""}

${t("emergencyContacts")}:
${data.emergencyContacts && data.emergencyContacts.length > 0
  ? data.emergencyContacts.map((c: any) => `${c.name}: ${c.phone}`).join("\n")
  : t("noEmergencyContacts")}

---
${t("appName")}
      `.trim();

      const result = await Share.share({
        message: medicalInfo,
        title: t("shareMedicalProfile"),
      });

      if (result.action === Share.sharedAction) {
        Alert.alert(t("Success"), "Medical information shared successfully");
      }
    } catch (error) {
      console.error("Error sharing medical info:", error);
      Alert.alert(t("error"), t("failedToShareMedicalInfo"));
    } finally {
      setSharing(false);
    }
  };

  return (
    <ScrollView
      style={pageStyles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 96 },
      ]}
    >
      <AppPageHeader title={t("profileTitle")} showBrandIcon={false} />

      <Card style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.email || t("user")}</Text>
        <Text style={styles.userRole}>{t(role || "user")}</Text>
        
        {/* Patient ID for Emergency Access */}
        {israeliId && (
          <View style={styles.patientIdCard}>
            <Text style={styles.patientIdLabel}>{t("patientIdForEmergency")}:</Text>
            <Text style={styles.patientIdValue}>{israeliId}</Text>
            <Text style={styles.patientIdNote}>
              {t("sharePatientIdNote")}
            </Text>
          </View>
        )}
      </Card>

      <View style={styles.section}>
        <SectionHeader
          title={t("medicalProfile")}
          trailing={
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={shareMedicalInfo}
              disabled={sharing}
            >
              <Text style={styles.shareText}>{t("shareMedicalProfile")}</Text>
            </TouchableOpacity>
          }
        />
        <ListRow
          icon="person-outline"
          title={t("personalInformation")}
          subtitle={t("nameAgeBloodType")}
          onPress={() => router.push("/(tabs)/profile/medical")}
        />
        <ListRow
          icon="clipboard-outline"
          title={t("medical_history")}
          subtitle={t("diseasesMedicationsAllergies")}
          onPress={() => router.push("/(tabs)/profile/history")}
        />
        <ListRow
          icon="call-outline"
          title={t("emergency_contact")}
          subtitle={t("familyFriendsDoctors")}
          onPress={() => router.push("/(tabs)/profile/contacts")}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t("medicalRecords")} />
        <ListRow
          icon="alert-circle-outline"
          title={t("emergencyHistory")}
          subtitle={t("pastEmergencyCalls")}
          onPress={() => router.push("/(tabs)/profile/emergency-history")}
        />
        <ListRow
          icon="medical-outline"
          title={t("medicalRecords")}
          subtitle={t("visitsTreatmentsTests")}
          onPress={() => router.push("/(tabs)/profile/medical-records")}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: tokens.space.lg,
    ...pageStyles.content,
  },
  userCard: {
    alignItems: "center",
    marginBottom: tokens.space.xl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.space.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textOnPrimary,
  },
  userName: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.xs,
  },
  userRole: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textMuted,
    textTransform: "capitalize",
    marginBottom: tokens.space.md,
  },
  patientIdCard: {
    marginTop: tokens.space.md,
    padding: tokens.space.md,
    backgroundColor: tokens.color.primaryBg,
    borderRadius: tokens.radius.lg,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.primaryBorder,
    alignSelf: "stretch",
  },
  patientIdLabel: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    fontWeight: tokens.fontWeight.semibold,
    marginBottom: tokens.space.sm,
    textAlign: "center",
  },
  patientIdValue: {
    fontSize: tokens.font.h2,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.primary,
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: tokens.space.sm,
  },
  patientIdNote: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    textAlign: "center",
  },
  section: {
    marginBottom: tokens.space.xl,
  },
  shareBtn: {
    backgroundColor: tokens.color.primary,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.pill,
  },
  shareText: {
    color: tokens.color.textOnPrimary,
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.bold,
  },
});


