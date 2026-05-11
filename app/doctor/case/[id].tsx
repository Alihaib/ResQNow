import { useLocalSearchParams, useRouter } from "expo-router";
import { arrayUnion, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import EmergencyChat from "../../../components/EmergencyChat";
import { ActivityIndicator, Animated, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";
import { normalizeLifecycleStatus } from "../../../src/emergency/stateMachine";
import type { PatientSnapshot } from "../../../src/emergency/patientSnapshot";
import { snapshotFromFirestore } from "../../../src/emergency/patientSnapshot";
import { parseLatLng } from "../../../src/utils/emergencyMapCoords";

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

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

const formatMaybe = (v: unknown) => {
  if (v === null || v === undefined || String(v).trim() === "") return "Not provided";
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
  const mapRef = useRef<MapView | null>(null);
  const lastValidRouteRef = useRef<{ start: { latitude: number; longitude: number }; end: { latitude: number; longitude: number } } | null>(null);
  const [route, setRoute] = useState<{ start: { latitude: number; longitude: number }; end: { latitude: number; longitude: number } } | null>(null);
  const routeOpacity = useRef(new Animated.Value(1)).current;
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

  const transportPhase = useMemo(() => {
    const lc = normalizeLifecycleStatus(String(emergency?.status ?? "dispatched"));
    return lc === "arrived" || emergency?.patientPicked === true;
  }, [emergency?.status, emergency?.patientPicked]);

  const routeTarget = useMemo(() => {
    if (!ambulanceHasCoords) return null;
    if (!transportPhase) {
      return patientHasCoords ? patientCoordsLive : null;
    }
    return hospitalCoordsLive ?? (doctorHasCoords ? doctorCoordsLive : null);
  }, [ambulanceHasCoords, transportPhase, patientHasCoords, patientCoordsLive, hospitalCoordsLive, doctorHasCoords, doctorCoordsLive]);

  const routeLabel = useMemo(() => {
    return transportPhase ? "🏥 Transporting to hospital" : "🚑 En route to patient";
  }, [transportPhase]);

  const routeDistanceText = useMemo(() => {
    if (!ambulanceHasCoords || !routeTarget) return null;
    const meters = calculateDistanceMeters(
      ambulanceCoordsLive!.latitude,
      ambulanceCoordsLive!.longitude,
      routeTarget.latitude,
      routeTarget.longitude,
    );
    return formatDistance(meters);
  }, [ambulanceHasCoords, routeTarget, ambulanceCoordsLive]);

  useEffect(() => {
    // Prevent route flicker: keep last valid route if new route is temporarily missing.
    if (!ambulanceHasCoords) return;

    const start = ambulanceCoordsLive
      ? { latitude: ambulanceCoordsLive.latitude, longitude: ambulanceCoordsLive.longitude }
      : null;
    const end = routeTarget ? { latitude: routeTarget.latitude, longitude: routeTarget.longitude } : null;

    if (start && end) {
      const next = { start, end };
      lastValidRouteRef.current = next;
      setRoute(next);

      // Smooth transition when endpoints change (fade 0.5 -> 1)
      routeOpacity.stopAnimation();
      routeOpacity.setValue(0.5);
      Animated.timing(routeOpacity, { toValue: 1, duration: 220, useNativeDriver: false }).start();
      return;
    }

    if (lastValidRouteRef.current) {
      setRoute(lastValidRouteRef.current);
    }
  }, [ambulanceHasCoords, ambulanceCoordsLive, routeTarget, routeOpacity]);

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

      {/* Top: live snapshot summary — condition, ETA, ambulance line (ambulance-maintained) */}
      <View
        style={[
          styles.snapshotPanel,
          emergency.currentSnapshot?.conditionLevel === "critical" && styles.snapshotPanelCritical,
          emergency.currentSnapshot?.conditionLevel === "moderate" && styles.snapshotPanelModerate,
          emergency.currentSnapshot?.conditionLevel === "stable" && styles.snapshotPanelStable,
        ]}
      >
        <Text style={styles.sectionHeadingPrimary}>Live dispatch</Text>
        {!emergency.currentSnapshot ? (
          <Text style={styles.snapshotMuted}>
            Waiting for ambulance snapshot. ETA and status will appear here as soon as the crew updates.
          </Text>
        ) : (
          <>
            <View style={styles.conditionHeroWrap}>
              <Text style={styles.conditionHeroLabel}>Condition</Text>
              <View
                style={[
                  styles.conditionPill,
                  emergency.currentSnapshot.conditionLevel === "critical" && styles.conditionPillCritical,
                  emergency.currentSnapshot.conditionLevel === "moderate" && styles.conditionPillModerate,
                  emergency.currentSnapshot.conditionLevel === "stable" && styles.conditionPillStable,
                ]}
              >
                <Text style={styles.conditionPillText}>
                  {emergency.currentSnapshot.conditionLevel.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>ETA (crew)</Text>
              <Text style={styles.snapshotValue}>
                {normalizeLifecycleStatus(String(emergency.status)) === "arrived"
                  ? t("ambulanceArrivedShort")
                  : emergency.currentSnapshot.eta != null
                    ? `${emergency.currentSnapshot.eta} min`
                    : "—"}
              </Text>
            </View>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>Ambulance status</Text>
              <Text style={[styles.snapshotValue, { flex: 1 }]}>
                {formatMaybe(emergency.currentSnapshot.ambulanceStatus)}
              </Text>
            </View>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>Case lifecycle</Text>
              <Text style={styles.snapshotValue}>{formatMaybe(String(emergency.status || "dispatched"))}</Text>
            </View>
            <Text style={styles.snapshotUpdated}>
              Snapshot updated {new Date(emergency.currentSnapshot.lastUpdate).toLocaleTimeString()}
            </Text>
          </>
        )}
      </View>

      {/* Middle: symptoms */}
      <View style={styles.card}>
        <Text style={styles.sectionHeadingSecondary}>Patient Status</Text>
        {!emergency.currentSnapshot?.symptoms?.length ? (
          <Text style={styles.muted}>No symptoms reported yet.</Text>
        ) : (
          <Text style={styles.snapshotBody}>{emergency.currentSnapshot.symptoms.join(" · ")}</Text>
        )}
      </View>

      {/* Middle: vitals */}
      <View style={styles.card}>
        <Text style={styles.sectionHeadingSecondary}>Vitals</Text>
        {(() => {
          const v = emergency.currentSnapshot?.vitals;
          const hasVitals =
            v?.heartRate != null ||
            v?.oxygen != null ||
            String(v?.bloodPressure ?? "").trim().length > 0;
          if (!hasVitals) {
            return <Text style={styles.muted}>No vitals reported yet.</Text>;
          }
          return (
            <Text style={styles.snapshotBody}>
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
      </View>

      {/* Compact case context */}
      <View style={styles.metaStrip}>
        <Text style={styles.metaStripText} numberOfLines={1}>
          👤 {t("caller")}:{` `}
          {String(emergency.patientName ?? patient?.name ?? "").trim() || "Anonymous Patient"}
        </Text>
        <Text style={styles.metaStripSubText} numberOfLines={1}>
          ⏱ {formatHHmm(emergency.timestamp)}
        </Text>
      </View>

      {/* Map — patient (red), ambulance (blue), optional doctor (green); live via onSnapshot */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionHeadingSecondary}>Live map</Text>
          <TouchableOpacity onPress={openInMaps} disabled={!patientHasCoords}>
            <Text style={[styles.link, !patientHasCoords && styles.linkDisabled]}>{t("openInMaps")}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.smallText}>
          {basePatientLoc?.address ||
            (patientHasCoords ? `${patientLat}, ${patientLng}` : "Not provided")}
        </Text>
        <View style={styles.routeStrip}>
          <Text style={styles.routeLabelText}>{routeLabel}</Text>
          <Text style={styles.routeMetaText}>
            {routeDistanceText ? `📏 ${routeDistanceText}` : " "}
            {stableEtaMinutes != null ? ` · ETA ${Math.max(0, Math.round(stableEtaMinutes))} min` : ""}
          </Text>
        </View>
        {crewEtaMinutes != null ? (
          <Text style={styles.mapEtaCaption}>ETA (crew) · {crewEtaMinutes} min</Text>
        ) : null}
        {!ambulanceHasCoords ? (
          <Text style={styles.muted}>Ambulance GPS not available yet.</Text>
        ) : null}

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
              {route ? (
                <AnimatedPolyline
                  coordinates={[route.start, route.end]}
                  strokeColor={
                    routeOpacity.interpolate({
                      inputRange: [0.5, 1],
                      outputRange: ["rgba(0,116,217,0.5)", "rgba(0,116,217,1)"],
                    }) as unknown as string
                  }
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              ) : null}
              <Marker
                key={`pat-${emergency.updatedAt ?? ""}-${patientLat}-${patientLng}`}
                coordinate={{ latitude: patientLat as number, longitude: patientLng as number }}
                title={t("mapLegendPatient")}
                description={basePatientLoc?.address ?? `${patientLat}, ${patientLng}`}
                pinColor="#D62828"
              />

              {ambulanceHasCoords ? (
                <Marker
                  key={`amb-${emergency.updatedAt ?? ""}-${ambLat}-${ambLng}`}
                  coordinate={{ latitude: ambLat as number, longitude: ambLng as number }}
                  title={t("mapLegendAmbulance")}
                  description={t("ambulance")}
                  pinColor="#0074D9"
                />
              ) : null}

              {doctorHasCoords ? (
                <Marker
                  key={`doc-${emergency.updatedAt ?? ""}-${docLat}-${docLng}`}
                  coordinate={{ latitude: docLat as number, longitude: docLng as number }}
                  title={t("mapLegendDoctor")}
                  description={t("doctor_role")}
                  pinColor="#15803D"
                />
              ) : null}
            </MapView>
          </View>
        ) : (
          <Text style={styles.muted}>{t("mapUnavailable")}</Text>
        )}
        <View style={styles.mapLegendRow}>
          <View style={styles.legendChip}>
            <View style={[styles.legendDotMap, { backgroundColor: "#D62828" }]} />
            <Text style={styles.legendChipText}>{t("mapLegendPatient")}</Text>
          </View>
          <View style={styles.legendChip}>
            <View style={[styles.legendDotMap, { backgroundColor: "#0074D9" }]} />
            <Text style={styles.legendChipText}>{t("mapLegendAmbulance")}</Text>
          </View>
          {doctorHasCoords ? (
            <View style={styles.legendChip}>
              <View style={[styles.legendDotMap, { backgroundColor: "#15803D" }]} />
              <Text style={styles.legendChipText}>{t("mapLegendDoctor")}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* GPS distance only — ETA comes from crew snapshot above */}
      <View style={styles.card}>
        <Text style={styles.sectionHeadingSecondary}>Approach (GPS)</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Ambulance ↔ patient</Text>
          <Text style={styles.value}>
            {distanceMeters === null ? "—" : formatDistance(distanceMeters)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>ETA (crew snapshot)</Text>
          <Text style={styles.value}>{crewEtaMinutes != null ? `${crewEtaMinutes} min` : "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ambulance GPS</Text>
          <Text style={styles.valueSmall}>{ambulanceHasCoords ? `${ambLat?.toFixed(5)}, ${ambLng?.toFixed(5)}` : "—"}</Text>
        </View>
        {!ambulanceHasCoords ? <Text style={styles.muted}>Waiting for ambulance GPS…</Text> : null}
      </View>

      {/* Timeline */}
      <View style={styles.card}>
        <Text style={styles.sectionHeadingSecondary}>Timeline</Text>
        {timelineSorted.length === 0 ? (
          <Text style={styles.muted}>No timeline updates yet.</Text>
        ) : (
          timelineSorted.slice(0, 12).map((item, idx) => (
            <View key={idx} style={styles.timelineRow}>
              <Text style={styles.timelineDot}>•</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineText}>
                  {formatMaybe(item.status)}
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
        <Text style={styles.sectionHeadingSecondary}>Medical Notes</Text>
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

      {/* Dispatcher chat between doctor and ambulance */}
      <View style={styles.card}>
        <Text style={styles.sectionHeadingSecondary}>Dispatcher Chat</Text>
        {id && user?.uid ? (
          <EmergencyChat
            emergencyId={id}
            currentUserId={user.uid}
            currentUserRole="doctor"
            isActive={emergency.sessionStatus === "active"}
          />
        ) : null}
      </View>

      {/* Patient medical summary */}
      <View style={styles.card}>
        <Text style={styles.sectionHeadingSecondary}>Patient record</Text>
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
  snapshotPanel: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: "#E9ECEF",
    backgroundColor: "#FFFFFF",
  },
  snapshotPanelStable: {
    borderColor: "#16A34A",
    backgroundColor: "#F0FDF4",
  },
  snapshotPanelModerate: {
    borderColor: "#D97706",
    backgroundColor: "#FFFBEB",
  },
  snapshotPanelCritical: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  snapshotPanelTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#003049",
    marginBottom: 12,
  },
  sectionHeadingPrimary: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6C757D",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  sectionHeadingSecondary: {
    fontSize: 17,
    fontWeight: "900",
    color: "#003049",
    marginBottom: 12,
  },
  conditionHeroWrap: {
    marginBottom: 14,
  },
  conditionHeroLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6C757D",
    marginBottom: 8,
  },
  conditionPill: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: "#E9ECEF",
  },
  conditionPillStable: {
    backgroundColor: "#DCFCE7",
  },
  conditionPillModerate: {
    backgroundColor: "#FEF3C7",
  },
  conditionPillCritical: {
    backgroundColor: "#FEE2E2",
  },
  conditionPillText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#003049",
    letterSpacing: 0.5,
  },
  metaStrip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  metaStripText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#495057",
    lineHeight: 18,
  },
  metaStripSubText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#6C757D",
    lineHeight: 18,
  },
  snapshotMuted: {
    fontSize: 13,
    color: "#6C757D",
    lineHeight: 18,
    fontWeight: "600",
  },
  snapshotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  snapshotBlock: { marginBottom: 12 },
  snapshotLabel: { fontSize: 12, fontWeight: "800", color: "#6C757D", marginBottom: 4 },
  snapshotValue: { flex: 1, fontSize: 14, fontWeight: "800", color: "#003049", textAlign: "right" },
  snapshotValueEmphasis: {
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    color: "#991B1B",
    textAlign: "right",
  },
  snapshotBody: { fontSize: 14, fontWeight: "700", color: "#212529", lineHeight: 20 },
  snapshotUpdated: { marginTop: 8, fontSize: 11, fontWeight: "700", color: "#6C757D" },
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
  valueSmall: {
    flex: 1,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "700",
    color: "#495057",
    fontFamily: "monospace",
  },
  block: { marginTop: 10 },
  blockValue: { marginTop: 6, fontSize: 13, fontWeight: "700", color: "#003049", lineHeight: 18 },
  smallText: { fontSize: 13, color: "#003049", fontWeight: "700", marginBottom: 10 },
  muted: { fontSize: 12, color: "#6C757D", fontWeight: "600", marginTop: 10, lineHeight: 16 },
  link: { color: "#D62828", fontWeight: "900" },
  linkDisabled: { color: "#ADB5BD" },
  mapFrame: { height: 220, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E9ECEF" },
  map: { width: "100%", height: "100%" },
  mapEtaCaption: {
    fontSize: 14,
    fontWeight: "900",
    color: "#065F46",
    marginBottom: 8,
  },
  mapLegendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
    alignItems: "center",
  },
  routeStrip: {
    marginTop: 6,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  routeLabelText: { fontSize: 14, fontWeight: "900", color: "#0F172A" },
  routeMetaText: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#64748B" },
  legendChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDotMap: { width: 10, height: 10, borderRadius: 5 },
  legendChipText: { fontSize: 12, fontWeight: "700", color: "#495057" },
  etaArriving: { color: "#DC2626" },
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

