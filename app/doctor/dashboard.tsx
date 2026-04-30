import { useRouter } from "expo-router";
import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";

type Patient = {
  id: string;
  role?: string;
  approved?: boolean;
  name?: string;
  email?: string;
  israeliId?: string;
  phoneNumber?: string;
  age?: string | number;
  bloodType?: string;
  diseases?: string;
  medications?: string;
  allergies?: string;
  emergencyContacts?: Array<{ name?: string; phone?: string; relationship?: string }>;
};

type Emergency = {
  id: string;
  userId: string;
  victimType?: "me" | "other";
  timestamp?: string;
  status?: string;
  location?: { address?: string | null; latitude?: number; longitude?: number };
};

export default function DoctorDashboard() {
  const router = useRouter();
  const { role, approved, user, loading } = useAuth();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [liveEmergencies, setLiveEmergencies] = useState<Emergency[]>([]);
  const [loadingEmergencies, setLoadingEmergencies] = useState(true);
  const seenEmergencyIdsRef = useRef<Set<string>>(new Set());

  // Access control
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (role !== "doctor") {
      router.replace("/");
      return;
    }
    if (approved !== true) {
      router.replace("/doctor/pending");
      return;
    }
  }, [loading, user, role, approved, router]);

  // Live emergencies (real data; no mock)
  useEffect(() => {
    if (!user?.uid) return;
    if (role !== "doctor" || approved !== true) return;
    setLoadingEmergencies(true);
    const emergenciesRef = collection(db, "emergencies");
    const q = query(emergenciesRef, where("sessionStatus", "==", "active"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        console.log("[DoctorDashboard] emergencies snapshot:", snap.size);
        if (snap.size > 0) {
          console.log("[DoctorDashboard] first emergency id:", snap.docs[0]?.id);
        }
        // Debug: log newly appeared emergency ids
        const nextIds = new Set<string>();
        snap.docs.forEach((d) => nextIds.add(d.id));
        for (const id of nextIds) {
          if (!seenEmergencyIdsRef.current.has(id)) {
            console.log("[DoctorDashboard] NEW emergency received:", id);
          }
        }
        seenEmergencyIdsRef.current = nextIds;

        const list: Emergency[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            userId: data.userId,
            victimType: data.victimType === "other" ? "other" : "me",
            timestamp: data.timestamp,
            status: data.status,
            location: data.location,
          };
        });
        // Sort newest first if timestamp is ISO string
        list.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
        setLiveEmergencies(list);
        setLoadingEmergencies(false);
      },
      (err) => {
        console.error("Doctor emergencies listener error:", err);
        // If you see PERMISSION_DENIED here, your Firestore rules are blocking the query.
        // Check `firestore.rules` and deploy it.
        console.error("Doctor emergencies listener error code:", (err as any)?.code);
        // Typical cause when docs exist but don't show: Firestore security rules (PERMISSION_DENIED).
        setLiveEmergencies([]);
        setLoadingEmergencies(false);
      }
    );
    return () => unsub();
  }, [user?.uid, role, approved]);

  const normalize = (s: string) => s.trim().toLowerCase();

  const handleSearchPatient = async () => {
    if (!searchQuery.trim()) {
      Alert.alert(t("error"), t("enterPatientId") || "Please enter Israeli ID or name");
      return;
    }

    setSearching(true);
    try {
      const raw = searchQuery.trim();
      const queryLower = normalize(raw);
      const queryDigits = raw.replace(/\D/g, "");

      const usersRef = collection(db, "users");

      // Israeli ID: exact match
      if (queryDigits.length === 9) {
        const q = query(
          usersRef,
          where("role", "==", "user"),
          where("israeliId", "==", queryDigits),
          limit(10)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Patient[];
        setResults(list);
        setSelectedPatient(list[0] ?? null);
        if (list.length === 0) Alert.alert(t("error"), t("patientNotFound") || "Patient not found");
        return;
      }

      // Email: exact match
      if (raw.includes("@")) {
        const q = query(usersRef, where("role", "==", "user"), where("email", "==", raw), limit(10));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Patient[];
        setResults(list);
        setSelectedPatient(list[0] ?? null);
        if (list.length === 0) Alert.alert(t("error"), t("patientNotFound") || "Patient not found");
        return;
      }

      // Name (partial): Firestore doesn't support contains; fetch a small set of patients and filter in-memory.
      const q = query(usersRef, where("role", "==", "user"), limit(200));
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }) as Patient)
        .filter((p) => {
          const name = normalize(p.name || "");
          const email = normalize(p.email || "");
          const israeliId = (p.israeliId || "").replace(/\D/g, "");
          return (
            name.includes(queryLower) ||
            email.includes(queryLower) ||
            israeliId.includes(queryDigits)
          );
        })
        .slice(0, 25);

      setResults(list);
      setSelectedPatient(list[0] ?? null);
      if (list.length === 0) Alert.alert(t("error"), t("patientNotFound") || "Patient not found");
    } catch (error) {
      console.error("Error searching patient:", error);
      Alert.alert(t("error"), t("failedToSearchPatient"));
    } finally {
      setSearching(false);
    }
  };

  const selectedId = selectedPatient?.id;
  const selectedContacts = useMemo(() => selectedPatient?.emergencyContacts || [], [selectedId, selectedPatient?.emergencyContacts]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)");
          }}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
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
              keyboardType="default"
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

          {/* Results list */}
          {searching ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#D62828" />
              <Text style={styles.loadingText}>{t("loading")}</Text>
            </View>
          ) : results.length > 0 ? (
            <View style={styles.resultsBox}>
              {results.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.resultRow,
                    selectedPatient?.id === p.id && styles.resultRowActive,
                  ]}
                  onPress={() => setSelectedPatient(p)}
                >
                  <Text style={styles.resultName}>{p.name || p.email || "Unknown"}</Text>
                  <Text style={styles.resultMeta}>
                    {p.israeliId ? `ID: ${p.israeliId}` : p.email || ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Selected Patient Info Display */}
          {selectedPatient && (
            <View style={styles.patientInfoCard}>
              <View style={styles.patientHeader}>
                <Text style={styles.patientName}>{selectedPatient.name || selectedPatient.email}</Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSelectedPatient(null)}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {selectedPatient.israeliId && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.patientInfoLabel}>{t("israeliId")}:</Text>
                  <Text style={styles.patientInfoValue}>{selectedPatient.israeliId}</Text>
                </View>
              )}
              
              <View style={styles.patientInfoRow}>
                <Text style={styles.patientInfoLabel}>{t("phoneNumber")}:</Text>
                <Text style={styles.patientInfoValue}>{selectedPatient.phoneNumber || "N/A"}</Text>
              </View>
              
              {selectedPatient.bloodType && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.patientInfoLabel}>{t("blood_type")}:</Text>
                  <Text style={styles.patientInfoValue}>{selectedPatient.bloodType}</Text>
                </View>
              )}
              
              {selectedPatient.age && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.patientInfoLabel}>{t("age")}:</Text>
                  <Text style={styles.patientInfoValue}>{String(selectedPatient.age)}</Text>
                </View>
              )}

              {selectedPatient.diseases && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>{t("diseases")}:</Text>
                  <Text style={styles.patientInfoText}>{selectedPatient.diseases}</Text>
                </View>
              )}

              {selectedPatient.medications && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>{t("medications")}:</Text>
                  <Text style={styles.patientInfoText}>{selectedPatient.medications}</Text>
                </View>
              )}

              {selectedPatient.allergies && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>{t("allergies")}:</Text>
                  <Text style={styles.patientInfoText}>{selectedPatient.allergies}</Text>
                </View>
              )}

              {selectedContacts.length > 0 && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>{t("emergency_contact")}:</Text>
                  {selectedContacts.map((contact: any, index: number) => (
                    <Text key={index} style={styles.patientInfoText}>
                      {contact.name}: {contact.phone}
                    </Text>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.viewFullBtn}
                onPress={() => router.push(`/doctor/patient/${selectedPatient.id}`)}
              >
                <Text style={styles.viewFullBtnText}>
                  {t("viewFullProfile") || "View Full Profile"} ›
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Live Emergencies (real) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("activeEmergencyCases") || "Active Emergencies"}</Text>
          {loadingEmergencies ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#D62828" />
              <Text style={styles.loadingText}>{t("loading")}</Text>
            </View>
          ) : liveEmergencies.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyBoxText}>{t("noActiveEmergencies")}</Text>
            </View>
          ) : (
            liveEmergencies.slice(0, 10).map((e) => (
              <TouchableOpacity
                key={e.id}
                style={styles.caseCard}
                onPress={() => router.push(`/doctor/case/${e.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.caseHeader}>
                  <View style={[styles.priorityBadge, { backgroundColor: "#DC2626" }]}>
                    <Text style={styles.priorityText}>ACTIVE</Text>
                  </View>
                  <Text style={styles.caseTime}>
                    {e.timestamp ? new Date(e.timestamp).toLocaleString() : "—"}
                  </Text>
                </View>
                <Text style={styles.caseType}>
                  {e.victimType === "other" ? t("someoneElseNeedsHelp") : t("userNeedsHelp")}
                </Text>
                <Text style={styles.caseLocation}>
                  📍 {e.location?.address || (e.location?.latitude && e.location?.longitude ? `${e.location.latitude}, ${e.location.longitude}` : t("locationNotAvailable"))}
                </Text>
                <Text style={styles.caseHint}>{t("tapToOpenCaseMonitor")}</Text>
              </TouchableOpacity>
            ))
          )}
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
  headerSpacer: { width: 40, height: 40 },
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
  caseHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "800",
    color: "#D62828",
  },
  chevron: {
    position: "absolute",
    right: 20,
    top: 20,
    fontSize: 24,
    color: "#6C757D",
  },
  loadingBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: "#6C757D",
    fontWeight: "700",
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  emptyBoxText: {
    color: "#6C757D",
    fontWeight: "700",
  },
  resultsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E9ECEF",
    marginBottom: 12,
  },
  resultRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  resultRowActive: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#D62828",
  },
  resultName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#003049",
  },
  resultMeta: {
    fontSize: 12,
    color: "#6C757D",
    marginTop: 2,
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
