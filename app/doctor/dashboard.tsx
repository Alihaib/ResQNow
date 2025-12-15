import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";

const emergencyCases = [
  { id: "1", type: "Cardiac", time: "2 min ago", priority: "High", location: "Tel Aviv" },
  { id: "2", type: "Accident", time: "5 min ago", priority: "Medium", location: "Jerusalem" },
  { id: "3", type: "Respiratory", time: "10 min ago", priority: "Low", location: "Haifa" },
];

export default function DoctorDashboard() {
  const router = useRouter();
  const { lang, toggleLanguage, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);

  const handleSearchPatient = async () => {
    if (!searchQuery.trim()) {
      Alert.alert(t("error"), t("enterPatientId") || "Please enter Israeli ID or name");
      return;
    }

    setSearching(true);
    try {
      const queryLower = searchQuery.trim().toLowerCase();
      const queryDigits = searchQuery.trim().replace(/\D/g, ""); // Extract digits for ID search
      
      // Search by Israeli ID or name or email
      const usersSnapshot = await getDocs(collection(db, "users"));
      let foundPatient = null;

      usersSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const userId = docSnap.id;
        
        // Check if search matches Israeli ID, name, or email
        if (
          data.israeliId === queryDigits ||
          data.name?.toLowerCase().includes(queryLower) ||
          data.email?.toLowerCase().includes(queryLower)
        ) {
          foundPatient = { id: userId, ...data };
        }
      });

      if (foundPatient) {
        setPatientData(foundPatient);
      } else {
        Alert.alert(t("error"), t("patientNotFound") || "Patient not found");
        setPatientData(null);
      }
    } catch (error) {
      console.error("Error searching patient:", error);
      Alert.alert(t("error"), "Failed to search patient");
    } finally {
      setSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
          <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.logo}>🩺</Text>
      <Text style={styles.title}>{t("doctor_dashboard_title")}</Text>
      <Text style={styles.subtitle}>{t("doctor_dashboard_sub")}</Text>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Patient Search for Emergency Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 {t("searchPatient") || "Search Patient"}</Text>
          <Text style={styles.searchSubtitle}>
            {t("searchPatientNote") || "Enter Israeli ID or name to access medical information"}
          </Text>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t("enterPatientId") || "Enter Israeli ID or Name"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#ADB5BD"
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={handleSearchPatient}
              disabled={searching || !searchQuery.trim()}
            >
              <Text style={styles.searchBtnText}>
                {searching ? t("loading") : "🔍"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Patient Info Display */}
          {patientData && (
            <View style={styles.patientInfoCard}>
              <View style={styles.patientHeader}>
                <Text style={styles.patientName}>{patientData.name || patientData.email}</Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setPatientData(null)}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {patientData.israeliId && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.patientInfoLabel}>{t("israeliId")}:</Text>
                  <Text style={styles.patientInfoValue}>{patientData.israeliId}</Text>
                </View>
              )}
              
              <View style={styles.patientInfoRow}>
                <Text style={styles.patientInfoLabel}>{t("phoneNumber")}:</Text>
                <Text style={styles.patientInfoValue}>{patientData.phoneNumber || "N/A"}</Text>
              </View>
              
              {patientData.bloodType && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.patientInfoLabel}>{t("blood_type")}:</Text>
                  <Text style={styles.patientInfoValue}>{patientData.bloodType}</Text>
                </View>
              )}
              
              {patientData.age && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.patientInfoLabel}>{t("age")}:</Text>
                  <Text style={styles.patientInfoValue}>{patientData.age}</Text>
                </View>
              )}

              {patientData.diseases && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>{t("diseases")}:</Text>
                  <Text style={styles.patientInfoText}>{patientData.diseases}</Text>
                </View>
              )}

              {patientData.medications && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>{t("medications")}:</Text>
                  <Text style={styles.patientInfoText}>{patientData.medications}</Text>
                </View>
              )}

              {patientData.allergies && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>{t("allergies")}:</Text>
                  <Text style={styles.patientInfoText}>{patientData.allergies}</Text>
                </View>
              )}

              {patientData.emergencyContacts && patientData.emergencyContacts.length > 0 && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>{t("emergency_contact")}:</Text>
                  {patientData.emergencyContacts.map((contact: any, index: number) => (
                    <Text key={index} style={styles.patientInfoText}>
                      {contact.name}: {contact.phone}
                    </Text>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.viewFullBtn}
                onPress={() => router.push(`/doctor/patient/${patientData.id}`)}
              >
                <Text style={styles.viewFullBtnText}>
                  {t("viewFullProfile") || "View Full Profile"} ›
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Active Cases */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("activeEmergencyCases")}</Text>
          {emergencyCases.map((case_) => (
            <TouchableOpacity key={case_.id} style={styles.caseCard}>
              <View style={styles.caseHeader}>
                <View style={[styles.priorityBadge, { backgroundColor: case_.priority === "High" ? "#DC2626" : case_.priority === "Medium" ? "#F59E0B" : "#10B981" }]}>
                  <Text style={styles.priorityText}>{case_.priority}</Text>
                </View>
                <Text style={styles.caseTime}>{case_.time}</Text>
              </View>
              <Text style={styles.caseType}>{case_.type}</Text>
              <Text style={styles.caseLocation}>📍 {case_.location}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("quickActions")}</Text>
          
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/(tabs)/firstaid")}>
            <Text style={styles.actionIcon}>⛑</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{t("medical_guides")}</Text>
              <Text style={styles.actionSubtitle}>{t("medical_guides_desc")}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionIcon}>🔔</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{t("notifications")}</Text>
              <Text style={styles.actionSubtitle}>{t("notifications_desc")}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("todaysStatistics")}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>{t("cases")}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>8</Text>
              <Text style={styles.statLabel}>{t("resolved")}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>4</Text>
              <Text style={styles.statLabel}>{t("active")}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backText: {
    fontSize: 24,
    color: "#003049",
    fontWeight: "700",
  },
  languageBtn: {
    backgroundColor: "#003049",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  languageText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  logo: { fontSize: 60, textAlign: "center", marginBottom: 8 },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#003049",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 15,
    color: "#6C757D",
    marginBottom: 24,
  },
  scrollContent: { paddingBottom: 30 },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 16,
  },
  caseCard: {
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
  caseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  priorityBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  priorityText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  caseTime: {
    fontSize: 14,
    color: "#6C757D",
  },
  caseType: {
    fontSize: 20,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 8,
  },
  caseLocation: {
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
  actionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: "#6C757D",
  },
  badge: {
    backgroundColor: "#DC2626",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "900",
    color: "#D62828",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#6C757D",
    fontWeight: "600",
  },
  searchSubtitle: {
    fontSize: 13,
    color: "#6C757D",
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "#E9ECEF",
  },
  searchBtn: {
    backgroundColor: "#D62828",
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
  },
  searchBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  patientInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#D62828",
  },
  patientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  patientName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 18,
    color: "#6C757D",
    fontWeight: "700",
  },
  patientInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  patientInfoLabel: {
    fontSize: 14,
    color: "#6C757D",
    fontWeight: "600",
  },
  patientInfoValue: {
    fontSize: 14,
    color: "#003049",
    fontWeight: "700",
  },
  patientInfoSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E9ECEF",
  },
  patientInfoSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 8,
  },
  patientInfoText: {
    fontSize: 14,
    color: "#212529",
    lineHeight: 20,
  },
  viewFullBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E9ECEF",
    paddingTop: 16,
  },
  viewFullBtnText: {
    fontSize: 16,
    color: "#D62828",
    fontWeight: "700",
  },
});
