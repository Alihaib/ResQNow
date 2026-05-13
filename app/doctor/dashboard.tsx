import { useRouter } from "expo-router";
import { collection, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import SectionHeader from "../../components/ui/SectionHeader";
import ShortcutCard from "../../components/ui/ShortcutCard";
import StatusChip from "../../components/ui/StatusChip";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";
import { tokens } from "../../src/ui/tokens";
import { caseIdSuffix } from "../../src/utils/formatCaseId";

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

  // ----- Quick Actions infrastructure (UI only) ----------------------------
  // Refs that let the bottom Quick Actions section scroll back to the relevant
  // section higher up the page, or focus the patient search input. None of
  // this touches Firestore queries, listeners, or routing semantics — it is a
  // pure UI affordance.
  //
  // The `Ref<number | undefined>` typing is intentional: `undefined` means
  // the wrapper hasn't been laid out yet (onLayout has not fired). The Quick
  // Action handlers fall back to `0` (top of the ScrollView) when the value
  // isn't known yet — for the Active Emergencies section that's actually the
  // correct target anyway since it's the first section in the scroll.
  const scrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput | null>(null);
  const activeSectionYRef = useRef<number | undefined>(undefined);
  const searchSectionYRef = useRef<number | undefined>(undefined);

  const scrollToY = (y: number) => {
    const target = Math.max(0, y - 12);
    if (!scrollRef.current) {
      if (__DEV__) {
        console.warn(
          "[doctor/dashboard] scrollToY called before ScrollView ref attached",
        );
      }
      return;
    }
    scrollRef.current.scrollTo({ y: target, animated: true });
  };

  const handleQuickViewActive = () => {
    const y = activeSectionYRef.current;
    if (y === undefined && __DEV__) {
      // Not fatal — the Active Emergencies section is the first child of the
      // ScrollView, so falling back to y=0 takes the user to the right place.
      console.warn(
        "[doctor/dashboard] activeSectionYRef not measured yet; falling back to top",
      );
    }
    scrollToY(y ?? 0);
  };

  const handleQuickSearchPatient = () => {
    const y = searchSectionYRef.current;
    if (y === undefined && __DEV__) {
      console.warn(
        "[doctor/dashboard] searchSectionYRef not measured yet; falling back to top",
      );
    }
    scrollToY(y ?? 0);
    // Give the scroll animation a moment, then focus the input so the
    // keyboard pops up on tap. Best-effort — silent if input is unmounted.
    setTimeout(() => searchInputRef.current?.focus(), 320);
  };

  const handleQuickOpenRecentCase = () => {
    const latest = liveEmergencies[0];
    if (!latest?.id) {
      Alert.alert(
        t("quickActions"),
        t("quickNoRecentCases", "No recent cases"),
      );
      return;
    }
    router.push(`/doctor/case/${latest.id}`);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("doctor_dashboard_title")}
        eyebrow={`🩺 ${t("doctor_role")}`}
      />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
        {/* PRIMARY: Active Emergencies — most important first. */}
        <View
          style={styles.section}
          onLayout={(e) => {
            activeSectionYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <SectionHeader
            overline={t("active") || "Active"}
            title={t("activeEmergencyCases") || "Active Emergencies"}
            accent={liveEmergencies.length > 0 ? tokens.color.danger : undefined}
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
            <EmptyState loading tone="danger" title={t("loading")} />
          ) : liveEmergencies.length === 0 ? (
            <EmptyState
              icon="🩺"
              title={t("noActiveEmergencies")}
              subtitle={t("checkBackLater")}
            />
          ) : (
            <View style={styles.cardStack}>
              {liveEmergencies.slice(0, 10).map((e) => (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => router.push(`/doctor/case/${e.id}`)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={
                    e.victimType === "other"
                      ? t("someoneElseNeedsHelp")
                      : t("userNeedsHelp")
                  }
                >
                  <Card elevated accentLeft>
                    <View style={styles.caseTopRow}>
                      <StatusChip label="ACTIVE" variant="danger" solid />
                      <Text style={styles.caseTime}>
                        {e.timestamp
                          ? new Date(e.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </Text>
                    </View>

                    <Text style={styles.caseId} numberOfLines={1}>
                      {t("activityEmergencyRef", "Case {id}").replace(
                        "{id}",
                        caseIdSuffix(e.id),
                      )}
                    </Text>

                    <Text style={styles.caseType} numberOfLines={1}>
                      {e.victimType === "other"
                        ? t("someoneElseNeedsHelp")
                        : t("userNeedsHelp")}
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
                            size="sm"
                          />
                        ) : null}
                        {e.snapshotAmbulanceLine ? (
                          <Text
                            style={styles.caseAmbulanceLine}
                            numberOfLines={1}
                          >
                            {truncateOneLine(e.snapshotAmbulanceLine, 60)}
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Patient Search */}
        <Card
          style={styles.section}
          onLayout={(e) => {
            searchSectionYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <SectionHeader
            overline={t("searchPatient") || "Directory"}
            title={`🔍 ${t("searchPatient") || "Search Patient"}`}
          />
          <Text style={styles.helperText}>
            {t("searchPatientNote") ||
              "Enter Israeli ID or name to access medical information"}
          </Text>

          <View style={styles.searchContainer}>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={t("enterPatientId") || "Enter Israeli ID or Name"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={tokens.color.textFaint}
              keyboardType="default"
              returnKeyType="search"
              onSubmitEditing={handleSearchPatient}
            />
            <TouchableOpacity
              style={[
                styles.searchBtn,
                (searching || !searchQuery.trim()) && styles.searchBtnDisabled,
              ]}
              onPress={handleSearchPatient}
              disabled={searching || !searchQuery.trim()}
              accessibilityRole="button"
              accessibilityLabel={t("searchPatient")}
            >
              <Text style={styles.searchBtnText}>
                {searching ? "…" : "🔍"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Results list */}
          {searching ? (
            <EmptyState loading tone="danger" title={t("loading")} />
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
                  accessibilityRole="button"
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
            <Card tone="danger" style={styles.patientInfoCard}>
              <View style={styles.patientHeader}>
                <Text style={styles.patientName} numberOfLines={1}>
                  {selectedPatient.name || selectedPatient.email}
                </Text>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setSelectedPatient(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
            </Card>
          )}
        </Card>

        {/*
          Quick Actions — operational shortcuts. Each one is wired to existing
          navigation / state; no new backend, no new routes.
        */}
        <View style={styles.section}>
          <SectionHeader overline={t("quickActions")} title={t("quickActions")} />

          <ShortcutCard
            icon="🚨"
            title={t("quickViewActiveEmergencies", "View Active Emergencies")}
            subtitle={t("quickViewActiveEmergenciesSub", "Jump to live cases")}
            onPress={handleQuickViewActive}
            trailing={
              !loadingEmergencies && liveEmergencies.length > 0 ? (
                <StatusChip
                  label={String(liveEmergencies.length)}
                  variant="danger"
                  solid
                />
              ) : undefined
            }
          />
          <ShortcutCard
            icon="🔍"
            title={t("quickSearchPatient", "Search Patient")}
            subtitle={t("quickSearchPatientSub", "Find by ID, email or name")}
            onPress={handleQuickSearchPatient}
          />
          <ShortcutCard
            icon="📋"
            title={t("quickOpenRecentCase", "Open Recent Case")}
            subtitle={t("quickOpenRecentCaseSub", "Latest active emergency")}
            onPress={handleQuickOpenRecentCase}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.bgPage,
  },
  scrollContent: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.lg,
    paddingBottom: tokens.space.xxl,
  },
  section: { marginBottom: tokens.space.xl },
  cardStack: { gap: tokens.space.md },
  helperText: {
    fontSize: tokens.font.body,
    color: tokens.color.textMuted,
    marginBottom: tokens.space.md,
    lineHeight: 18,
  },
  caseTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.space.sm,
  },
  caseTime: {
    fontSize: tokens.font.body,
    color: tokens.color.textMuted,
    fontWeight: "700",
  },
  caseId: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginTop: tokens.space.xs,
    marginBottom: tokens.space.xs,
  },
  caseType: {
    fontSize: tokens.font.title,
    fontWeight: "800",
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.xs,
  },
  caseLocation: {
    fontSize: tokens.font.body,
    color: tokens.color.textSecondary,
    fontWeight: "600",
  },
  caseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: tokens.space.sm,
    marginTop: tokens.space.md,
  },
  caseAmbulanceLine: {
    fontSize: tokens.font.caption,
    color: tokens.color.textSecondary,
    fontStyle: "italic",
    flex: 1,
    minWidth: 100,
  },
  searchContainer: {
    flexDirection: "row",
    gap: tokens.space.sm,
    marginBottom: tokens.space.md,
  },
  searchInput: {
    flex: 1,
    backgroundColor: tokens.color.bgSubtle,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
    fontSize: tokens.font.label,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    color: tokens.color.textPrimary,
    minHeight: tokens.hitSlop,
  },
  searchBtn: {
    backgroundColor: tokens.color.danger,
    paddingHorizontal: tokens.space.lg,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 52,
    minHeight: tokens.hitSlop,
  },
  searchBtnDisabled: { backgroundColor: tokens.color.borderStrong },
  searchBtnText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  resultsBox: {
    backgroundColor: tokens.color.bgSubtle,
    borderRadius: tokens.radius.md,
    padding: tokens.space.xs,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    marginBottom: tokens.space.md,
    gap: tokens.space.xs,
  },
  resultRow: {
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.sm,
    flexDirection: "row",
    alignItems: "center",
    minHeight: tokens.hitSlop,
  },
  resultRowActive: {
    backgroundColor: tokens.color.dangerSurface,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.dangerBorder,
  },
  resultName: {
    fontSize: tokens.font.label,
    fontWeight: "800",
    color: tokens.color.textPrimary,
  },
  resultMeta: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    marginTop: 2,
  },
  resultCheck: {
    fontSize: 16,
    fontWeight: "900",
    color: tokens.color.danger,
  },
  patientInfoCard: {
    marginTop: tokens.space.md,
  },
  patientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.space.md,
    paddingBottom: tokens.space.md,
    borderBottomWidth: tokens.hairline,
    borderBottomColor: tokens.color.dangerBorder,
  },
  patientName: {
    fontSize: tokens.font.h3,
    fontWeight: "900",
    color: tokens.color.textPrimary,
    flex: 1,
    marginRight: tokens.space.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.color.bgPage,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: {
    fontSize: 16,
    color: tokens.color.textMuted,
    fontWeight: "800",
  },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: tokens.space.sm,
    borderBottomWidth: tokens.hairline,
    borderBottomColor: tokens.color.border,
  },
  kvLabel: {
    fontSize: tokens.font.body,
    color: tokens.color.textMuted,
    fontWeight: "700",
  },
  kvValue: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textPrimary,
    fontWeight: "800",
  },
  patientSubSection: {
    marginTop: tokens.space.md,
    paddingTop: tokens.space.md,
    borderTopWidth: tokens.hairline,
    borderTopColor: tokens.color.border,
  },
  patientSubTitle: {
    fontSize: tokens.font.body,
    fontWeight: "900",
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.xs,
    letterSpacing: 0.3,
  },
  patientSubText: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textPrimary,
    lineHeight: 20,
  },
  viewFullBtn: {
    marginTop: tokens.space.md,
    paddingVertical: tokens.space.md,
    alignItems: "center",
    borderTopWidth: tokens.hairline,
    borderTopColor: tokens.color.dangerBorder,
    paddingTop: tokens.space.md,
    minHeight: tokens.hitSlop,
  },
  viewFullBtnText: {
    fontSize: tokens.font.label,
    color: tokens.color.danger,
    fontWeight: "800",
  },
});
