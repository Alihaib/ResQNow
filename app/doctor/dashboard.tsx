import { useRouter } from "expo-router";
import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import SectionHeader from "../../components/ui/SectionHeader";
import StatusChip from "../../components/ui/StatusChip";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";

const truncateOneLine = (s: string, max: number) => {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
};

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
  /** Display-only lines from existing doc snapshot (optional). */
  snapshotEtaMin?: number | null;
  snapshotAmbulanceLine?: string | null;
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
          const cs = data.currentSnapshot;
          const eta =
            cs && typeof cs === "object" && typeof (cs as any).eta === "number" && Number.isFinite((cs as any).eta)
              ? (cs as any).eta
              : null;
          const ambLine =
            cs && typeof cs === "object" && typeof (cs as any).ambulanceStatus === "string"
              ? String((cs as any).ambulanceStatus)
              : null;
          return {
            id: d.id,
            userId: data.userId,
            victimType: data.victimType === "other" ? "other" : "me",
            timestamp: data.timestamp,
            status: data.status,
            location: data.location,
            snapshotEtaMin: eta,
            snapshotAmbulanceLine: ambLine,
          };
        });
        // Sort newest first if timestamp is ISO string
        list.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
        setLiveEmergencies(list);
        setLoadingEmergencies(false);
      },
      (err) => {
        console.error("Doctor emergencies listener error:", err);
        console.error("Doctor emergencies listener error code:", (err as any)?.code);
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
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)");
          }}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerEyebrow}>🩺 {t("doctor_role")}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t("doctor_dashboard_title")}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* PRIMARY: Active Emergencies — most important first. */}
        <View style={styles.section}>
          <SectionHeader
            overline={t("active") || "Active"}
            title={t("activeEmergencyCases") || "Active Emergencies"}
            accent={liveEmergencies.length > 0 ? "#DC2626" : undefined}
            trailing={
              !loadingEmergencies && liveEmergencies.length > 0 ? (
                <StatusChip
                  label={String(liveEmergencies.length)}
                  variant="danger"
                  solid
                />
              ) : null
            }
          />
          {loadingEmergencies ? (
            <View style={styles.softCard}>
              <ActivityIndicator size="small" color="#DC2626" />
              <Text style={styles.softMuted}>{t("loading")}</Text>
            </View>
          ) : liveEmergencies.length === 0 ? (
            <View style={styles.softCard}>
              <Text style={styles.emptyTitle}>{t("noActiveEmergencies")}</Text>
              <Text style={styles.emptySub}>{t("checkBackLater")}</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {liveEmergencies.slice(0, 10).map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={styles.caseCard}
                  onPress={() => router.push(`/doctor/case/${e.id}`)}
                  activeOpacity={0.85}
                >
                  <View style={styles.caseTopRow}>
                    <StatusChip label="ACTIVE" variant="danger" solid />
                    <Text style={styles.caseTime}>
                      {e.timestamp ? new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </Text>
                  </View>

                  <Text style={styles.caseType} numberOfLines={1}>
                    {e.victimType === "other" ? t("someoneElseNeedsHelp") : t("userNeedsHelp")}
                  </Text>

                  <Text style={styles.caseLocation} numberOfLines={1}>
                    📍{" "}
                    {e.location?.address ||
                      (e.location?.latitude && e.location?.longitude
                        ? `${e.location.latitude.toFixed(4)}, ${e.location.longitude.toFixed(4)}`
                        : t("locationNotAvailable"))}
                  </Text>

                  {(e.snapshotEtaMin != null || e.snapshotAmbulanceLine) && (
                    <View style={styles.caseMetaRow}>
                      {e.snapshotEtaMin != null ? (
                        <StatusChip
                          label={`ETA ~${e.snapshotEtaMin} min`}
                          variant="info"
                          icon="⏱"
                        />
                      ) : null}
                      {e.snapshotAmbulanceLine ? (
                        <Text style={styles.caseAmbulanceLine} numberOfLines={1}>
                          {truncateOneLine(e.snapshotAmbulanceLine, 60)}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Patient Search */}
        <View style={[styles.section, styles.sectionCard]}>
          <SectionHeader
            overline={t("searchPatient") || "Directory"}
            title={`🔍 ${t("searchPatient") || "Search Patient"}`}
          />
          <Text style={styles.helperText}>
            {t("searchPatientNote") || "Enter Israeli ID or name to access medical information"}
          </Text>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t("enterPatientId") || "Enter Israeli ID or Name"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#94A3B8"
              keyboardType="default"
            />
            <TouchableOpacity
              style={[
                styles.searchBtn,
                (searching || !searchQuery.trim()) && styles.searchBtnDisabled,
              ]}
              onPress={handleSearchPatient}
              disabled={searching || !searchQuery.trim()}
              accessibilityRole="button"
            >
              <Text style={styles.searchBtnText}>
                {searching ? "…" : "🔍"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Results list */}
          {searching ? (
            <View style={styles.softCard}>
              <ActivityIndicator size="small" color="#DC2626" />
              <Text style={styles.softMuted}>{t("loading")}</Text>
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
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {p.name || p.email || "Unknown"}
                    </Text>
                    <Text style={styles.resultMeta} numberOfLines={1}>
                      {p.israeliId ? `ID: ${p.israeliId}` : p.email || ""}
                    </Text>
                  </View>
                  {selectedPatient?.id === p.id ? (
                    <Text style={styles.resultCheck}>✓</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Selected Patient Info Display */}
          {selectedPatient && (
            <View style={styles.patientInfoCard}>
              <View style={styles.patientHeader}>
                <Text style={styles.patientName} numberOfLines={1}>
                  {selectedPatient.name || selectedPatient.email}
                </Text>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setSelectedPatient(null)}
                  accessibilityRole="button"
                >
                  <Text style={styles.iconBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedPatient.israeliId && (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{t("israeliId")}</Text>
                  <Text style={styles.kvValue}>{selectedPatient.israeliId}</Text>
                </View>
              )}
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>{t("phoneNumber")}</Text>
                <Text style={styles.kvValue}>{selectedPatient.phoneNumber || "—"}</Text>
              </View>
              {selectedPatient.bloodType && (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{t("blood_type")}</Text>
                  <Text style={styles.kvValue}>{selectedPatient.bloodType}</Text>
                </View>
              )}
              {selectedPatient.age && (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{t("age")}</Text>
                  <Text style={styles.kvValue}>{String(selectedPatient.age)}</Text>
                </View>
              )}

              {selectedPatient.diseases && (
                <View style={styles.patientSubSection}>
                  <Text style={styles.patientSubTitle}>{t("diseases")}</Text>
                  <Text style={styles.patientSubText}>{selectedPatient.diseases}</Text>
                </View>
              )}
              {selectedPatient.medications && (
                <View style={styles.patientSubSection}>
                  <Text style={styles.patientSubTitle}>{t("medications")}</Text>
                  <Text style={styles.patientSubText}>{selectedPatient.medications}</Text>
                </View>
              )}
              {selectedPatient.allergies && (
                <View style={styles.patientSubSection}>
                  <Text style={styles.patientSubTitle}>{t("allergies")}</Text>
                  <Text style={styles.patientSubText}>{selectedPatient.allergies}</Text>
                </View>
              )}
              {selectedContacts.length > 0 && (
                <View style={styles.patientSubSection}>
                  <Text style={styles.patientSubTitle}>{t("emergency_contact")}</Text>
                  {selectedContacts.map((contact: any, index: number) => (
                    <Text key={index} style={styles.patientSubText}>
                      {contact.name}: {contact.phone}
                    </Text>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.viewFullBtn}
                onPress={() => router.push(`/doctor/patient/${selectedPatient.id}`)}
                accessibilityRole="button"
              >
                <Text style={styles.viewFullBtnText}>
                  {t("viewFullProfile") || "View Full Profile"} ›
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Shortcuts — visually quieter, smaller secondary actions */}
        <View style={styles.section}>
          <SectionHeader overline={t("quickActions")} title={t("quickActions")} />
          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push("/(tabs)/firstaid")}
            activeOpacity={0.85}
          >
            <Text style={styles.shortcutIcon}>⛑</Text>
            <View style={styles.shortcutContent}>
              <Text style={styles.shortcutTitle}>{t("medical_guides")}</Text>
              <Text style={styles.shortcutSub} numberOfLines={1}>
                {t("medical_guides_desc")}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shortcutCard} activeOpacity={0.85}>
            <Text style={styles.shortcutIcon}>🔔</Text>
            <View style={styles.shortcutContent}>
              <Text style={styles.shortcutTitle}>{t("notifications")}</Text>
              <Text style={styles.shortcutSub} numberOfLines={1}>
                {t("notifications_desc")}
              </Text>
            </View>
            <StatusChip label="3" variant="danger" solid />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { fontSize: 24, color: "#0F172A", fontWeight: "800", lineHeight: 26 },
  headerTextWrap: { flex: 1, marginLeft: 12 },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 40, height: 40 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: { marginBottom: 26 },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  helperText: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 12,
    lineHeight: 18,
  },
  caseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  caseTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  caseTime: { fontSize: 13, color: "#64748B", fontWeight: "700" },
  caseType: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  caseLocation: { fontSize: 13, color: "#475569", fontWeight: "600" },
  caseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  caseAmbulanceLine: {
    fontSize: 12,
    color: "#475569",
    fontStyle: "italic",
    flex: 1,
    minWidth: 100,
  },
  softCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  softMuted: { color: "#64748B", fontWeight: "700" },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    color: "#0F172A",
  },
  searchBtn: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 52,
  },
  searchBtnDisabled: { backgroundColor: "#CBD5E1" },
  searchBtnText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  resultsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
    gap: 4,
  },
  resultRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  resultRowActive: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  resultName: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  resultMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  resultCheck: { fontSize: 16, fontWeight: "900", color: "#DC2626" },
  patientInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: "#DC2626",
  },
  patientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  patientName: { fontSize: 18, fontWeight: "900", color: "#0F172A", flex: 1, marginRight: 8 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: { fontSize: 16, color: "#64748B", fontWeight: "800" },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  kvLabel: { fontSize: 13, color: "#64748B", fontWeight: "700" },
  kvValue: { fontSize: 14, color: "#0F172A", fontWeight: "800" },
  patientSubSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  patientSubTitle: { fontSize: 13, fontWeight: "900", color: "#0F172A", marginBottom: 6, letterSpacing: 0.3 },
  patientSubText: { fontSize: 14, color: "#212529", lineHeight: 20 },
  viewFullBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 14,
  },
  viewFullBtnText: { fontSize: 15, color: "#DC2626", fontWeight: "800" },
  shortcutCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  shortcutIcon: { fontSize: 24 },
  shortcutContent: { flex: 1 },
  shortcutTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  shortcutSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  chevron: { fontSize: 22, color: "#94A3B8", fontWeight: "700" },
});
