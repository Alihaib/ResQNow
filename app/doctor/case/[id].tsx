import { useLocalSearchParams, useRouter } from "expo-router";
import { arrayUnion, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";

type EmergencyDoc = {
  userId: string;
  victimType?: "me" | "other";
  sessionStatus?: "active" | "resolved" | "cancelled";
  status?: string; // lifecycle
  timestamp?: string;
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
  updatedAt?: string;
  timeline?: Array<{ status?: string; timestamp?: string; ambulanceId?: string; doctorId?: string; text?: string }>;
  doctorNotes?: Array<{ text?: string; timestamp?: string; doctorId?: string }>;
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

const formatMaybe = (v: unknown) => {
  if (v === null || v === undefined || String(v).trim() === "") return "Not provided";
  return String(v);
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

export default function DoctorCaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { role, approved, user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [emergency, setEmergency] = useState<EmergencyDoc | null>(null);
  const [patient, setPatient] = useState<PatientDoc | null>(null);
  const [noteText, setNoteText] = useState("");
  const mapRef = useRef<MapView | null>(null);

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
          status: data.status,
          sessionStatus: data.sessionStatus,
          timestamp: data.timestamp,
          location: data.location,
          patientLocation: data.patientLocation,
          severity: data.severity,
          assignedAmbulanceId: data.assignedAmbulanceId ?? null,
          ambulanceLocation: data.ambulanceLocation ?? null,
          updatedAt: data.updatedAt,
          timeline: Array.isArray(data.timeline) ? data.timeline : undefined,
          doctorNotes: Array.isArray(data.doctorNotes) ? data.doctorNotes : undefined,
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
  const patientLat = basePatientLoc?.latitude;
  const patientLng = basePatientLoc?.longitude;
  const patientHasCoords = typeof patientLat === "number" && typeof patientLng === "number";

  const ambLat = emergency?.ambulanceLocation?.latitude;
  const ambLng = emergency?.ambulanceLocation?.longitude;
  const ambulanceHasCoords = typeof ambLat === "number" && typeof ambLng === "number";

  const distanceKm = useMemo(() => {
    if (!patientHasCoords || !ambulanceHasCoords) return null;
    return haversineKm(patientLat as number, patientLng as number, ambLat as number, ambLng as number);
  }, [patientHasCoords, ambulanceHasCoords, patientLat, patientLng, ambLat, ambLng]);

  const etaMinutes = useMemo(() => {
    if (distanceKm === null) return null;
    // Simple ETA estimation (no routing API): assume average 45 km/h in-city.
    const speedKmh = 45;
    return Math.max(1, Math.round((distanceKm / speedKmh) * 60));
  }, [distanceKm]);

  const openInMaps = () => {
    if (!patientHasCoords) return;
    const url = `https://www.google.com/maps?q=${patientLat},${patientLng}`;
    Linking.openURL(url).catch(() => {});
  };

  // Keep the map viewport aligned with live Firestore updates.
  useEffect(() => {
    if (!patientHasCoords) return;
    if (!mapRef.current) return;

    const patientCoord = { latitude: patientLat as number, longitude: patientLng as number };
    const coords = [patientCoord];
    if (ambulanceHasCoords) {
      coords.push({ latitude: ambLat as number, longitude: ambLng as number });
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
  }, [patientHasCoords, ambulanceHasCoords, patientLat, patientLng, ambLat, ambLng]);

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

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#D62828" />
        <Text style={styles.loadingText}>{t("loading")}</Text>
      </View>
    );
  }

  if (!emergency) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Case not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/doctor/dashboard")}>
          <Text style={styles.backBtnText}>{t("back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/doctor/dashboard"))}>
          <Text style={styles.backText}>‹ {t("back")}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t("caseMonitorTitle")}</Text>
      </View>

      {/* Case summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🚨 Emergency</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{formatMaybe(emergency.status || "dispatched")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Session</Text>
          <Text style={styles.value}>{formatMaybe(emergency.sessionStatus || "active")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Severity</Text>
          <Text style={styles.value}>{formatMaybe(emergency.severity || "Unknown")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Victim</Text>
          <Text style={styles.value}>{emergency.victimType === "other" ? t("someoneElse") : t("caller")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Time</Text>
          <Text style={styles.value}>
            {emergency.timestamp ? new Date(emergency.timestamp).toLocaleString() : "Not provided"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ambulance</Text>
          <Text style={styles.value}>{formatMaybe(emergency.assignedAmbulanceId || t("unassigned"))}</Text>
        </View>
      </View>

      {/* Map */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>📍 Location</Text>
          <TouchableOpacity onPress={openInMaps} disabled={!patientHasCoords}>
            <Text style={[styles.link, !patientHasCoords && styles.linkDisabled]}>{t("openInMaps")}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.smallText}>
          {basePatientLoc?.address ||
            (patientHasCoords ? `${patientLat}, ${patientLng}` : "Not provided")}
        </Text>
        {!ambulanceHasCoords && (
          <Text style={styles.muted}>Ambulance location not available yet.</Text>
        )}

        {patientHasCoords ? (
          <View style={styles.mapFrame}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: patientLat as number,
                longitude: patientLng as number,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled
              zoomEnabled
              showsUserLocation={false}
            >
              <Marker
                coordinate={{ latitude: patientLat as number, longitude: patientLng as number }}
                title="Patient"
                description={basePatientLoc?.address ?? `${patientLat}, ${patientLng}`}
                pinColor="#D62828"
              />

              {ambulanceHasCoords ? (
                <Marker
                  coordinate={{ latitude: ambLat as number, longitude: ambLng as number }}
                  title="Ambulance"
                  description="Live ambulance location"
                  pinColor="#0074D9"
                />
              ) : null}
            </MapView>
          </View>
        ) : (
          <Text style={styles.muted}>{t("mapUnavailable")}</Text>
        )}
      </View>

      {/* Ambulance tracking (read-only) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🚑 Live Ambulance Tracking</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{formatMaybe(emergency.status || "Not available")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Distance</Text>
          <Text style={styles.value}>
            {distanceKm === null ? "Not available" : distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>ETA</Text>
          <Text style={styles.value}>{etaMinutes === null ? "Not available" : `${etaMinutes} min`}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ambulance GPS</Text>
          <Text style={styles.value}>{ambulanceHasCoords ? `${ambLat}, ${ambLng}` : "Not available"}</Text>
        </View>
        <Text style={styles.muted}>
          Updates stream in real time from Firestore (`ambulanceLocation`, `status`, `timeline`).
        </Text>
      </View>

      {/* Timeline */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🕒 Timeline</Text>
        {timelineSorted.length === 0 ? (
          <Text style={styles.muted}>No timeline updates yet.</Text>
        ) : (
          timelineSorted.slice(0, 12).map((item, idx) => (
            <View key={idx} style={styles.timelineRow}>
              <Text style={styles.timelineDot}>•</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineText}>
                  {formatMaybe(item.status)} {item.ambulanceId ? `(${item.ambulanceId})` : ""}
                </Text>
                <Text style={styles.timelineTime}>
                  {item.timestamp ? new Date(item.timestamp).toLocaleString() : "Not provided"}
                </Text>
                {item.text ? <Text style={styles.timelineNote}>{item.text}</Text> : null}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Doctor notes */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🧠 Medical Notes (optional)</Text>
        <TextInput
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Add a note for this case…"
          placeholderTextColor="#ADB5BD"
          style={styles.noteInput}
          multiline
        />
        <TouchableOpacity style={styles.noteBtn} onPress={addDoctorNote} disabled={!noteText.trim()}>
          <Text style={styles.noteBtnText}>{t("saveNote")}</Text>
        </TouchableOpacity>
        {Array.isArray(emergency.doctorNotes) && emergency.doctorNotes.length > 0 ? (
          <View style={{ marginTop: 10 }}>
            {emergency.doctorNotes
              .slice()
              .sort((a, b) => (b.timestamp ? new Date(b.timestamp).getTime() : 0) - (a.timestamp ? new Date(a.timestamp).getTime() : 0))
              .slice(0, 6)
              .map((n, idx) => (
                <View key={idx} style={styles.noteRow}>
                  <Text style={styles.noteText}>{formatMaybe(n.text)}</Text>
                  <Text style={styles.noteMeta}>
                    {n.timestamp ? new Date(n.timestamp).toLocaleString() : ""}
                  </Text>
                </View>
              ))}
          </View>
        ) : (
          <Text style={styles.muted}>No notes yet.</Text>
        )}
      </View>

      {/* Patient medical summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🩺 Patient Medical Summary</Text>
        {emergency.victimType === "other" ? (
          <Text style={styles.muted}>
            {t("privacyModeNoProfile")}
          </Text>
        ) : !patient ? (
          <Text style={styles.muted}>{t("patientProfileNotFound")}</Text>
        ) : (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{formatMaybe(patient.name || patient.email)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Age</Text>
              <Text style={styles.value}>{formatMaybe(patient.age)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Blood Type</Text>
              <Text style={styles.value}>{formatMaybe(patient.bloodType)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Height</Text>
              <Text style={styles.value}>
                {patient.height ? `${patient.height} cm` : "Not provided"}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Weight</Text>
              <Text style={styles.value}>
                {patient.weight ? `${patient.weight} kg` : "Not provided"}
              </Text>
            </View>
            <View style={styles.block}>
              <Text style={styles.label}>Conditions</Text>
              <Text style={styles.blockValue}>{formatMaybe(patient.diseases)}</Text>
            </View>
            <View style={styles.block}>
              <Text style={styles.label}>Medications</Text>
              <Text style={styles.blockValue}>{formatMaybe(patient.medications)}</Text>
            </View>
            <View style={styles.block}>
              <Text style={styles.label}>Allergies</Text>
              <Text style={styles.blockValue}>{formatMaybe(patient.allergies)}</Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  content: { paddingTop: 60, paddingBottom: 30, paddingHorizontal: 20 },
  center: { justifyContent: "center", alignItems: "center", paddingTop: 120 },
  loadingText: { marginTop: 12, color: "#6C757D", fontWeight: "700" },
  errorText: { color: "#DC2626", fontWeight: "800", fontSize: 16, marginBottom: 16 },
  backBtn: { backgroundColor: "#D62828", paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12 },
  backBtnText: { color: "#FFFFFF", fontWeight: "800" },
  header: { marginBottom: 16 },
  backText: { fontSize: 18, color: "#003049", fontWeight: "700", marginBottom: 10 },
  title: { fontSize: 28, fontWeight: "900", color: "#003049" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E9ECEF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#003049", marginBottom: 10 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F5",
  },
  label: { fontSize: 13, fontWeight: "700", color: "#6C757D" },
  value: { flex: 1, textAlign: "right", fontSize: 13, fontWeight: "800", color: "#003049" },
  block: { marginTop: 10 },
  blockValue: { marginTop: 6, fontSize: 13, fontWeight: "700", color: "#003049", lineHeight: 18 },
  smallText: { fontSize: 13, color: "#003049", fontWeight: "700", marginBottom: 10 },
  muted: { fontSize: 12, color: "#6C757D", fontWeight: "600", marginTop: 10, lineHeight: 16 },
  link: { color: "#D62828", fontWeight: "900" },
  linkDisabled: { color: "#ADB5BD" },
  mapFrame: { height: 220, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E9ECEF" },
  map: { width: "100%", height: "100%" },
  timelineRow: { flexDirection: "row", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F3F5" },
  timelineDot: { color: "#D62828", fontWeight: "900" },
  timelineText: { fontSize: 13, fontWeight: "800", color: "#003049" },
  timelineTime: { fontSize: 12, fontWeight: "700", color: "#6C757D", marginTop: 2 },
  timelineNote: { fontSize: 12, fontWeight: "700", color: "#003049", marginTop: 6 },
  noteInput: {
    minHeight: 90,
    borderWidth: 1.5,
    borderColor: "#E9ECEF",
    borderRadius: 12,
    padding: 12,
    color: "#003049",
    fontWeight: "700",
    backgroundColor: "#FFFFFF",
  },
  noteBtn: {
    backgroundColor: "#D62828",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
    alignItems: "center",
    opacity: 1,
  },
  noteBtnText: { color: "#FFFFFF", fontWeight: "900" },
  noteRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F3F5" },
  noteText: { fontSize: 13, fontWeight: "800", color: "#003049", lineHeight: 18 },
  noteMeta: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#6C757D" },
});

