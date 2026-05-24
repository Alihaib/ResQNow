import { useLocalSearchParams, useRouter } from "expo-router";
import { arrayUnion, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import EmergencyChat from "../../../components/EmergencyChat";
import Button, { PrimaryButton } from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import CollapsibleSection from "../../../components/ui/CollapsibleSection";
import ETAHighlight from "../../../components/ui/ETAHighlight";
import InfoRow from "../../../components/ui/InfoRow";
import MapPanel from "../../../components/ui/MapPanel";
import ScreenHeader from "../../../components/ui/ScreenHeader";
import SimpleStatusBlock from "../../../components/ui/SimpleStatusBlock";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { tokens } from "../../../src/ui/tokens";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";
import { normalizeLifecycleStatus } from "../../../src/emergency/stateMachine";
import type { PatientSnapshot } from "../../../src/emergency/patientSnapshot";
import { snapshotFromFirestore } from "../../../src/emergency/patientSnapshot";
import { parseLatLng } from "../../../src/utils/emergencyMapCoords";
import { caseIdSuffix } from "../../../src/utils/formatCaseId";

type EmergencyDoc = {
  userId: string;
  victimType?: "me" | "other";
  sessionStatus?: "active" | "resolved" | "cancelled";
  status?: string; // lifecycle
  timestamp?: string;
  patientName?: string | null;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string | null;
  };
  patientLocation?: {
    latitude?: number;
    longitude?: number;
    address?: string | null;
  };
  // Optional fields if they exist in your Firestore already (read-only for doctor view):
  severity?: string;
  assignedAmbulanceId?: string | null;
  ambulanceLocation?: { latitude?: number; longitude?: number } | null;
  /** Optional — only shown when present on the document */
  doctorLocation?: { latitude?: number; longitude?: number } | null;
  /** Optional — destination during transport phase (read-only for doctor view). */
  hospitalLocation?: { latitude?: number; longitude?: number } | null;
  /** Optional — mission flag (read-only for doctor view). */
  patientPicked?: boolean | null;
  updatedAt?: string;
  timeline?: Array<{ status?: string; timestamp?: string; ambulanceId?: string; doctorId?: string; text?: string }>;
  doctorNotes?: Array<{ text?: string; timestamp?: string; doctorId?: string }>;
  currentSnapshot?: PatientSnapshot | null;
};

type PatientDoc = {
  name?: string;
  email?: string;
  phoneNumber?: string;
  israeliId?: string;
  age?: string | number;
  bloodType?: string;
  height?: string | number;
  weight?: string | number;
  diseases?: string;
  medications?: string;
  allergies?: string;
  emergencyContacts?: Array<{ name?: string; phone?: string; relationship?: string }>;
};

const formatMaybe = (v: unknown, emptyLabel: string) => {
  if (v === null || v === undefined || String(v).trim() === "") return emptyLabel;
  return String(v);
};

const formatHHmm = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
};

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  return haversineKm(lat1, lon1, lat2, lon2) * 1000;
};

const formatDistance = (meters: number) => {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

export default function DoctorCaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { role, approved, user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [emergency, setEmergency] = useState<EmergencyDoc | null>(null);
  const [patient, setPatient] = useState<PatientDoc | null>(null);
  const [noteText, setNoteText] = useState("");
  const [focusPanel, setFocusPanel] = useState<"vitals" | "notes">("vitals");
  const mapRef = useRef<MapView | null>(null);
  const prevEtaRef = useRef<number | null>(null);
  const [stableEtaMinutes, setStableEtaMinutes] = useState<number | null>(null);

  // Access control
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (role !== "doctor" || approved !== true) {
      router.replace("/");
    }
  }, [authLoading, user, role, approved, router]);

  // Subscribe to emergency doc
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setEmergency(null);
      return;
    }

    setLoading(true);
    const ref = doc(db, "emergencies", id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setEmergency(null);
          setPatient(null);
          setLoading(false);
          return;
        }
        const data = snap.data() as any;
        const e: EmergencyDoc = {
          userId: data.userId,
          victimType: data.victimType === "other" ? "other" : "me",
          status: normalizeLifecycleStatus(data.status),
          sessionStatus: data.sessionStatus,
          timestamp: data.timestamp,
          patientName: typeof data.patientName === "string" ? data.patientName : null,
          location: data.location,
          patientLocation: data.patientLocation,
          severity: data.severity,
          assignedAmbulanceId: data.assignedAmbulanceId ?? null,
          ambulanceLocation: data.ambulanceLocation ?? null,
          hospitalLocation:
            data.hospitalLocation &&
            typeof data.hospitalLocation === "object" &&
            typeof (data.hospitalLocation as any).latitude === "number" &&
            typeof (data.hospitalLocation as any).longitude === "number"
              ? {
                  latitude: (data.hospitalLocation as any).latitude as number,
                  longitude: (data.hospitalLocation as any).longitude as number,
                }
              : null,
          doctorLocation:
            data.doctorLocation &&
            typeof data.doctorLocation === "object" &&
            typeof (data.doctorLocation as any).latitude === "number" &&
            typeof (data.doctorLocation as any).longitude === "number"
              ? {
                  latitude: (data.doctorLocation as any).latitude as number,
                  longitude: (data.doctorLocation as any).longitude as number,
                }
              : null,
          patientPicked: typeof data.patientPicked === "boolean" ? data.patientPicked : null,
          updatedAt: data.updatedAt,
          timeline: Array.isArray(data.timeline) ? data.timeline : undefined,
          doctorNotes: Array.isArray(data.doctorNotes) ? data.doctorNotes : undefined,
          currentSnapshot: snapshotFromFirestore(data.currentSnapshot),
        };
        setEmergency(e);
        setLoading(false);
      },
      (err) => {
        console.error("Doctor case emergency onSnapshot error:", err);
        setEmergency(null);
        setPatient(null);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!emergency?.sessionStatus) return;
    if (emergency.sessionStatus !== "active") {
      router.replace("/doctor/dashboard");
    }
  }, [emergency?.sessionStatus, router]);

  // Subscribe to patient doc (only when victimType === "me")
  useEffect(() => {
    if (!emergency?.userId) return;
    if (emergency.victimType === "other") {
      setPatient(null);
      return;
    }

    const ref = doc(db, "users", emergency.userId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setPatient(null);
          return;
        }
        setPatient(snap.data() as PatientDoc);
      },
      (err) => {
        console.error("Doctor case patient onSnapshot error:", err);
        setPatient(null);
      }
    );
    return () => unsub();
  }, [emergency?.userId, emergency?.victimType]);

  const basePatientLoc = emergency?.patientLocation ?? emergency?.location;

  /** All map coordinates come from the emergency document Firestore `onSnapshot` only. */
  const patientCoordsLive = useMemo(
    () => parseLatLng(emergency?.patientLocation) ?? parseLatLng(emergency?.location),
    [emergency?.patientLocation, emergency?.location, emergency?.updatedAt],
  );
  const ambulanceCoordsLive = useMemo(
    () => parseLatLng(emergency?.ambulanceLocation),
    [emergency?.ambulanceLocation, emergency?.updatedAt],
  );
  const doctorCoordsLive = useMemo(
    () => parseLatLng(emergency?.doctorLocation ?? undefined),
    [emergency?.doctorLocation, emergency?.updatedAt],
  );
  const hospitalCoordsLive = useMemo(
    () => parseLatLng(emergency?.hospitalLocation ?? undefined),
    [emergency?.hospitalLocation, emergency?.updatedAt],
  );

  const patientLat = patientCoordsLive?.latitude;
  const patientLng = patientCoordsLive?.longitude;
  const patientHasCoords = patientCoordsLive != null;

  const ambLat = ambulanceCoordsLive?.latitude;
  const ambLng = ambulanceCoordsLive?.longitude;
  const ambulanceHasCoords = ambulanceCoordsLive != null;

  const docLat = doctorCoordsLive?.latitude;
  const docLng = doctorCoordsLive?.longitude;
  const doctorHasCoords = doctorCoordsLive != null;

  const distanceMeters = useMemo(() => {
    if (!patientHasCoords || !ambulanceHasCoords) return null;
    return calculateDistanceMeters(patientLat as number, patientLng as number, ambLat as number, ambLng as number);
  }, [patientHasCoords, ambulanceHasCoords, patientLat, patientLng, ambLat, ambLng]);

  /** Crew ETA from snapshot — hidden once on scene (ETA may remain stale on doc). */
  const crewEtaMinutes =
    emergency != null &&
    normalizeLifecycleStatus(String(emergency.status)) !== "arrived" &&
    typeof emergency.currentSnapshot?.eta === "number" &&
    Number.isFinite(emergency.currentSnapshot.eta)
      ? emergency.currentSnapshot.eta
      : null;

  useEffect(() => {
    // Smooth ETA: weighted average; keep last valid ETA instead of dropping.
    if (typeof crewEtaMinutes === "number" && Number.isFinite(crewEtaMinutes)) {
      const prev = prevEtaRef.current;
      const next = prev == null ? crewEtaMinutes : prev * 0.7 + crewEtaMinutes * 0.3;
      prevEtaRef.current = next;
      setStableEtaMinutes(next);
      return;
    }
    if (prevEtaRef.current != null) {
      setStableEtaMinutes(prevEtaRef.current);
    } else {
      setStableEtaMinutes(null);
    }
  }, [crewEtaMinutes]);

  // Keep the map viewport aligned with live Firestore updates.
  useEffect(() => {
    if (!patientHasCoords) return;
    if (!mapRef.current) return;

    const patientCoord = { latitude: patientLat as number, longitude: patientLng as number };
    const coords = [patientCoord];
    if (ambulanceHasCoords) {
      coords.push({ latitude: ambLat as number, longitude: ambLng as number });
    }
    if (doctorHasCoords) {
      coords.push({ latitude: docLat as number, longitude: docLng as number });
    }

    const timer = setTimeout(() => {
      if (!mapRef.current) return;
      if (coords.length === 1) {
        mapRef.current.animateToRegion(
          {
            ...patientCoord,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          250
        );
        return;
      }

      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [patientHasCoords, ambulanceHasCoords, doctorHasCoords, patientLat, patientLng, ambLat, ambLng, docLat, docLng]);

  const timelineSorted = useMemo(() => {
    const items = emergency?.timeline ?? [];
    return [...items].sort((a, b) => {
      const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bt - at;
    });
  }, [emergency?.timeline]);

  const addDoctorNote = async () => {
    if (!id || !user?.uid) return;
    if (emergency?.sessionStatus !== "active") return;
    const text = noteText.trim();
    if (!text) return;
    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, "emergencies", id), {
      updatedAt: nowIso,
      doctorNotes: arrayUnion({ text, doctorId: user.uid, timestamp: nowIso }),
      timeline: arrayUnion({ status: "doctor_note", doctorId: user.uid, text, timestamp: nowIso }),
    });
    setNoteText("");
  };

  const fmt = (v: unknown) => formatMaybe(v, t("notProvided"));
  const lifecycle = normalizeLifecycleStatus(String(emergency?.status ?? "dispatched"));
  const lifecycleKey =
    lifecycle === "enRoute"
      ? "activityEvent_enRoute"
      : lifecycle === "arrived"
        ? "activityEvent_arrived"
        : lifecycle === "completed"
          ? "activityEvent_completed"
          : lifecycle === "cancelled"
            ? "activityEvent_cancelled"
            : "activityEvent_dispatched";
  const lifecycleLabel =
    t(lifecycleKey) !== lifecycleKey ? t(lifecycleKey) : String(lifecycle);

  const conditionChipVariant =
    emergency?.currentSnapshot?.conditionLevel === "critical"
      ? "danger"
      : emergency?.currentSnapshot?.conditionLevel === "stable"
        ? "success"
        : "warning";

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={tokens.color.primary} />
        <Text style={styles.loadingText}>{t("loading")}</Text>
      </View>
    );
  }

  if (!emergency) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{t("caseNotFound")}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/doctor/dashboard")}>
          <Text style={styles.backBtnText}>{t("back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const patientDisplayName =
    String(emergency.patientName ?? patient?.name ?? "").trim() || t("anonymousPatient");
  const statusSubtitle = [
    patientDisplayName,
    emergency.assignedAmbulanceId ? t("assignedLabel") : t("unassigned"),
    distanceMeters != null ? formatDistance(distanceMeters) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("caseMonitorTitle")}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/doctor/dashboard")
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SimpleStatusBlock
          title={lifecycleLabel}
          subtitle={statusSubtitle}
          chip={
            emergency.currentSnapshot?.conditionLevel
              ? {
                  label: emergency.currentSnapshot.conditionLevel.toUpperCase(),
                  variant: conditionChipVariant,
                }
              : undefined
          }
        />

        {stableEtaMinutes != null && lifecycle !== "arrived" ? (
          <ETAHighlight
            label={t("etaLabel")}
            value={String(Math.max(0, Math.round(stableEtaMinutes)))}
            unit={t("etaMinutesUnit")}
            style={styles.etaBlock}
          />
        ) : null}

        {emergency.currentSnapshot ? (
          <Card tone="subtle" style={styles.snapshotCard}>
            <InfoRow
              label={t("responderStatus")}
              value={fmt(emergency.currentSnapshot.ambulanceStatus)}
            />
            <InfoRow label={t("caseLifecycle")} value={lifecycleLabel} />
          </Card>
        ) : (
          <Text style={styles.muted}>{t("waitingForSnapshot")}</Text>
        )}

        {patientHasCoords ? (
          <MapPanel style={styles.mapPanel}>
            <MapView
              ref={mapRef}
              style={styles.mapFill}
              initialRegion={{
                latitude: patientLat as number,
                longitude: patientLng as number,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker
                coordinate={{ latitude: patientLat as number, longitude: patientLng as number }}
                pinColor={tokens.color.danger}
              />
              {ambulanceHasCoords ? (
                <Marker
                  coordinate={{ latitude: ambLat as number, longitude: ambLng as number }}
                  pinColor={tokens.color.primary}
                />
              ) : null}
            </MapView>
          </MapPanel>
        ) : null}

        <View style={styles.primaryWrap}>
          <PrimaryButton
            fullWidth
            size="lg"
            label={focusPanel === "vitals" ? t("openNotes") : t("viewVitals")}
            onPress={() => setFocusPanel((p) => (p === "vitals" ? "notes" : "vitals"))}
          />
        </View>

        {focusPanel === "vitals" ? (
          <Card style={styles.focusCard}>
            <Text style={styles.focusTitle}>{t("vitalsLabel")}</Text>
            {!emergency.currentSnapshot?.symptoms?.length ? (
              <Text style={styles.muted}>{t("noSymptomsYet")}</Text>
            ) : (
              <Text style={styles.bodyText}>
                {emergency.currentSnapshot.symptoms.join(" · ")}
              </Text>
            )}
            {(() => {
              const v = emergency.currentSnapshot?.vitals;
              const has =
                v?.heartRate != null ||
                v?.oxygen != null ||
                String(v?.bloodPressure ?? "").trim().length > 0;
              if (!has) return <Text style={styles.muted}>{t("noVitalsYet")}</Text>;
              return (
                <Text style={styles.bodyText}>
                  {[
                    v?.heartRate != null ? `HR ${v.heartRate}` : null,
                    v?.oxygen != null ? `SpO₂ ${v.oxygen}%` : null,
                    v?.bloodPressure ? `BP ${v.bloodPressure}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              );
            })()}
          </Card>
        ) : (
          <Card style={styles.focusCard}>
            <Text style={styles.focusTitle}>{t("openNotes")}</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder={t("addNotePlaceholder")}
              placeholderTextColor={tokens.color.textFaint}
              style={styles.noteInput}
              multiline
            />
            <Button
              variant="secondary"
              size="md"
              fullWidth
              label={t("saveNote")}
              onPress={addDoctorNote}
              disabled={!noteText.trim()}
            />
            {Array.isArray(emergency.doctorNotes) && emergency.doctorNotes.length > 0 ? (
              emergency.doctorNotes
                .slice()
                .sort(
                  (a, b) =>
                    (b.timestamp ? new Date(b.timestamp).getTime() : 0) -
                    (a.timestamp ? new Date(a.timestamp).getTime() : 0),
                )
                .slice(0, 6)
                .map((n, idx) => (
                  <View key={idx} style={styles.noteRow}>
                    <Text style={styles.noteBody}>{fmt(n.text)}</Text>
                    <Text style={styles.noteMeta}>
                      {n.timestamp ? new Date(n.timestamp).toLocaleString() : ""}
                    </Text>
                  </View>
                ))
            ) : (
              <Text style={styles.muted}>{t("noNotesYet")}</Text>
            )}
          </Card>
        )}

        <CollapsibleSection title={t("sectionTimeline")} subtitle={t("sectionResponderUpdates")}>
          {timelineSorted.length === 0 ? (
            <Text style={styles.muted}>{t("noTimelineYet")}</Text>
          ) : (
            timelineSorted.slice(0, 12).map((item, idx) => (
              <View key={idx} style={styles.timelineRow}>
                <Text style={styles.timelineText}>{fmt(item.status)}</Text>
                <Text style={styles.timelineTime}>
                  {item.timestamp ? new Date(item.timestamp).toLocaleString() : "—"}
                </Text>
              </View>
            ))
          )}
        </CollapsibleSection>

        <CollapsibleSection title={t("sectionCommunication")} subtitle={t("chatTitle")}>
          {id && user?.uid ? (
            <EmergencyChat
              emergencyId={id}
              currentUserId={user.uid}
              currentUserRole="doctor"
              isActive={emergency.sessionStatus === "active"}
            />
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection title={t("sectionPatientRecord")} subtitle={t("patientInformation")}>
          {emergency.victimType === "other" ? (
            <Text style={styles.muted}>{t("privacyModeNoProfile")}</Text>
          ) : !patient ? (
            <Text style={styles.muted}>{t("patientProfileNotFound")}</Text>
          ) : (
            <>
              <InfoRow label={t("name")} value={fmt(patient.name || patient.email)} />
              <InfoRow label={t("age")} value={fmt(patient.age)} />
              <InfoRow label={t("blood_type")} value={fmt(patient.bloodType)} />
              <InfoRow label={t("diseases")} value={fmt(patient.diseases)} />
              <InfoRow label={t("medications")} value={fmt(patient.medications)} />
              <InfoRow label={t("allergies")} value={fmt(patient.allergies)} />
            </>
          )}
        </CollapsibleSection>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: tokens.space.lg, paddingBottom: tokens.space.xxl },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: tokens.space.xl },
  loadingText: { marginTop: tokens.space.md, color: tokens.color.textMuted, fontWeight: tokens.fontWeight.semibold },
  errorText: { color: tokens.color.danger, fontWeight: tokens.fontWeight.bold, marginBottom: tokens.space.md },
  backBtn: { backgroundColor: tokens.color.primary, paddingVertical: tokens.space.md, paddingHorizontal: tokens.space.lg, borderRadius: tokens.radius.md },
  backBtnText: { color: tokens.color.textOnPrimary, fontWeight: tokens.fontWeight.bold },
  etaBlock: { marginBottom: tokens.space.md },
  snapshotCard: { marginBottom: tokens.space.md },
  mapPanel: { marginBottom: tokens.space.md },
  mapFill: { width: "100%", height: "100%" },
  primaryWrap: { marginBottom: tokens.space.md },
  focusCard: { marginBottom: tokens.space.md },
  focusTitle: { fontSize: tokens.font.h3, fontWeight: tokens.fontWeight.heavy, color: tokens.color.textPrimary, marginBottom: tokens.space.sm },
  bodyText: { fontSize: tokens.font.bodyLg, color: tokens.color.textPrimary, lineHeight: 20 },
  muted: { fontSize: tokens.font.body, color: tokens.color.textMuted, marginBottom: tokens.space.sm },
  noteInput: { minHeight: 88, borderWidth: tokens.hairline, borderColor: tokens.color.border, borderRadius: tokens.radius.md, padding: tokens.space.md, color: tokens.color.textPrimary, backgroundColor: tokens.color.bgSurface, marginBottom: tokens.space.sm },
  noteRow: { marginTop: tokens.space.sm, paddingTop: tokens.space.sm, borderTopWidth: tokens.hairline, borderTopColor: tokens.color.border },
  noteBody: { fontSize: tokens.font.bodyLg, color: tokens.color.textPrimary, fontWeight: tokens.fontWeight.semibold },
  noteMeta: { fontSize: tokens.font.caption, color: tokens.color.textMuted, marginTop: tokens.space.xs },
  timelineRow: { marginBottom: tokens.space.sm },
  timelineText: { fontSize: tokens.font.bodyLg, fontWeight: tokens.fontWeight.semibold, color: tokens.color.textPrimary },
  timelineTime: { fontSize: tokens.font.caption, color: tokens.color.textMuted },
});