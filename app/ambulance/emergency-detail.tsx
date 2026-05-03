import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";
import {
  allowsMedicalSnapshotFields,
  ambulanceStatusLabel,
  etaMinutesFromDistanceMeters,
  mergePatientSnapshot,
  snapshotPayloadForLifecycle,
  type ConditionLevel,
  type PatientSnapshot,
  snapshotFromFirestore,
} from "../../src/emergency/patientSnapshot";
import { stripUndefinedDeep } from "../../src/utils/firestoreSanitize";
import {
  canTransitionLifecycle,
  normalizeLifecycleStatus,
  type LifecycleStatus,
} from "../../src/emergency/stateMachine";
import { claimEmergencyTransaction, updateLifecycleTransaction } from "../../src/services/emergencyAssignment";
import { rejectAndReassignEmergency } from "../../src/services/autoDispatch";

interface Emergency {
  id: string;
  userId: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    address: string | null;
  };
  patientLocation?: {
    latitude: number;
    longitude: number;
    address?: string | null;
  };
  timestamp: string;
  status: LifecycleStatus | string;
  sessionStatus?: "active" | "resolved" | "cancelled";
  victimType?: "me" | "other";
  assignedAmbulanceId?: string | null;
  ambulanceLocation?: { latitude?: number; longitude?: number } | null;
  assignedAt?: string | null;
  currentSnapshot?: PatientSnapshot | null;
}

const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  dispatched: "Dispatched",
  enRoute: "En route",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function EmergencyDetailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, role, approved, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ emergencyId: string }>();
  const [emergency, setEmergency] = useState<Emergency | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ambulanceLocation, setAmbulanceLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [tracking, setTracking] = useState(false);
  const trackingSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastWriteAtRef = useRef<number>(0);
  const emergencyRef = useRef<Emergency | null>(null);
  const userUidRef = useRef<string | null>(null);
  const mapRef = useRef<MapView | null>(null);

  const [snapCondition, setSnapCondition] = useState<ConditionLevel>("moderate");
  const [snapSymptoms, setSnapSymptoms] = useState("");
  const [snapHr, setSnapHr] = useState("");
  const [snapO2, setSnapO2] = useState("");
  const [snapBp, setSnapBp] = useState("");
  const [snapSaving, setSnapSaving] = useState(false);

  // Access control: block non-ambulance users and non-approved responders
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (role !== "ambulance") {
      router.replace("/");
      return;
    }
    if (approved !== true) {
      router.replace("/ambulance/pending");
      return;
    }
  }, [authLoading, user, role, approved, router]);

  useEffect(() => {
    emergencyRef.current = emergency;
  }, [emergency]);

  useEffect(() => {
    userUidRef.current = user?.uid ?? null;
  }, [user?.uid]);

  // Realtime subscribe to emergency doc (single source of truth)
  useEffect(() => {
    if (!params.emergencyId) return;
    setLoading(true);
    const ref = doc(db, "emergencies", params.emergencyId);
    const unsub = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          setEmergency(null);
          setLoading(false);
          return;
        }
        const data = snap.data() as any;
        const next: Emergency = {
          id: snap.id,
          userId: data.userId,
          location: data.location,
          patientLocation: data.patientLocation,
          timestamp: data.timestamp,
          status: normalizeLifecycleStatus(data.status),
          sessionStatus: data.sessionStatus,
          victimType: data.victimType === "other" ? "other" : "me",
          assignedAmbulanceId: data.assignedAmbulanceId ?? null,
          ambulanceLocation: data.ambulanceLocation ?? null,
          assignedAt: typeof data.assignedAt === "string" ? data.assignedAt : null,
          currentSnapshot: snapshotFromFirestore(data.currentSnapshot),
        };
        console.log(
          "[AmbulanceEmergencyDetail] emergency snapshot:",
          next.id,
          "status=",
          next.status,
          "session=",
          next.sessionStatus,
          "assigned=",
          next.assignedAmbulanceId,
          "hasAmbLoc=",
          !!next.ambulanceLocation
        );
        setEmergency(next);
        setLoading(false);

        // Privacy: if victimType is "other", do NOT load any medical profile data.
        if (next.victimType !== "other" && next.userId) {
          const callerDoc = await getDoc(doc(db, "users", next.userId));
          const caller = callerDoc.exists() ? { id: callerDoc.id, ...callerDoc.data() } : null;
          setUserInfo(caller);
        } else {
          setUserInfo(null);
        }
      },
      (err) => console.error("Ambulance emergency onSnapshot error:", err)
    );
    return () => unsub();
  }, [params.emergencyId]);

  useEffect(() => {
    if (!emergency) return;
    if (!allowsMedicalSnapshotFields(normalizeLifecycleStatus(String(emergency.status)))) return;
    const s = emergency.currentSnapshot;
    if (!s) return;
    setSnapCondition(s.conditionLevel);
    setSnapSymptoms(s.symptoms?.length ? s.symptoms.join(", ") : "");
    setSnapHr(s.vitals?.heartRate != null ? String(s.vitals.heartRate) : "");
    setSnapO2(s.vitals?.oxygen != null ? String(s.vitals.oxygen) : "");
    setSnapBp(s.vitals?.bloodPressure ?? "");
  }, [emergency?.currentSnapshot?.lastUpdate, emergency?.status]);

  useEffect(() => {
    const getAmbulanceLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setAmbulanceLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        console.error("Error getting ambulance location:", error);
      }
    };
    getAmbulanceLocation();
  }, []);

  const isAssignedToMe = useMemo(() => {
    if (!user?.uid) return false;
    if (!emergency?.assignedAmbulanceId) return false;
    return emergency.assignedAmbulanceId === user.uid;
  }, [user?.uid, emergency?.assignedAmbulanceId]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

  const claimIfUnassigned = async () => {
    const uid = userUidRef.current;
    const e = emergencyRef.current;
    if (!uid || !e?.id) return;
    if (e.assignedAmbulanceId) return;
    const res = await claimEmergencyTransaction(e.id, uid);
    if (!res.ok && res.reason !== "already_claimed") {
      console.warn("[AmbulanceEmergencyDetail] claim failed:", res);
    }
  };

  const startTracking = async () => {
    const uid = userUidRef.current;
    const e = emergencyRef.current;
    if (!uid || !e?.id) {
      Alert.alert(t("error"), t("mustBeLoggedInToTrack"));
      return;
    }
    if (trackingSubRef.current) return;

    await claimIfUnassigned();

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("error"), t("locationPermissionDenied"));
      return;
    }

    setTracking(true);
    trackingSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      async (loc) => {
        setAmbulanceLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

        // Throttle Firestore writes (avoid spamming)
        const now = Date.now();
        if (now - lastWriteAtRef.current < 3500) return;
        lastWriteAtRef.current = now;

        try {
          // Only the assigned ambulance should publish location
          const latest = emergencyRef.current;
          const latestUid = userUidRef.current;
          if (!latest?.id || !latestUid) return;
          const assigned = latest.assignedAmbulanceId;
          if (assigned && assigned !== latestUid) {
            console.log(
              "[AmbulanceEmergencyDetail] skip GPS write: assigned to another ambulance",
              assigned
            );
            return;
          }

          console.log(
            "[AmbulanceEmergencyDetail] sending ambulanceLocation:",
            latest.id,
            loc.coords.latitude,
            loc.coords.longitude
          );

          const pat = latest.patientLocation ?? latest.location;
          let distM: number | null = null;
          if (
            pat &&
            typeof pat.latitude === "number" &&
            typeof pat.longitude === "number"
          ) {
            const km = calculateDistance(
              loc.coords.latitude,
              loc.coords.longitude,
              pat.latitude,
              pat.longitude
            );
            distM = km * 1000;
          }
          const eta = etaMinutesFromDistanceMeters(distM);
          const lc = normalizeLifecycleStatus(String(latest.status));
          const snapshot = mergePatientSnapshot(
            latest.currentSnapshot as Record<string, unknown> | undefined,
            {
              eta,
              ambulanceStatus: ambulanceStatusLabel(lc),
            },
            lc,
          );

          await updateDoc(
            doc(db, "emergencies", latest.id),
            stripUndefinedDeep({
              assignedAmbulanceId: assigned ?? latestUid,
              ambulanceLocation: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
              updatedAt: new Date().toISOString(),
              currentSnapshot: snapshotPayloadForLifecycle(lc, snapshot),
            })
          );

          updateDoc(doc(db, "users", latestUid), {
            lastKnownLocation: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
            lastKnownLocationUpdatedAt: new Date().toISOString(),
          }).catch(() => {});
        } catch (e) {
          console.error("Failed to update ambulanceLocation:", e);
        }
      }
    );
  };

  const stopTracking = () => {
    trackingSubRef.current?.remove();
    trackingSubRef.current = null;
    setTracking(false);
  };

  useEffect(() => {
    return () => {
      trackingSubRef.current?.remove();
      trackingSubRef.current = null;
    };
  }, []);

  // Auto-fit map to show both patient and ambulance markers
  useEffect(() => {
    if (!mapRef.current || !emergency) return;
    const patLoc = emergency.patientLocation ?? emergency.location;
    if (!patLoc?.latitude || !patLoc?.longitude) return;

    const coords: { latitude: number; longitude: number }[] = [
      { latitude: patLoc.latitude, longitude: patLoc.longitude },
    ];
    if (ambulanceLocation?.latitude && ambulanceLocation?.longitude) {
      coords.push({ latitude: ambulanceLocation.latitude, longitude: ambulanceLocation.longitude });
    }

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [ambulanceLocation, emergency]);

  const getNextLifecycle = (current: LifecycleStatus): LifecycleStatus | null => {
    if (current === "dispatched") return "enRoute";
    if (current === "enRoute") return "arrived";
    if (current === "arrived") return "completed";
    return null;
  };

  const advanceOneStep = async () => {
    const uid = userUidRef.current;
    const e = emergencyRef.current;
    if (!uid || !e?.id) return;
    await claimIfUnassigned();
    const snap = await getDoc(doc(db, "emergencies", e.id));
    const assigned = snap.exists() ? (snap.data() as any).assignedAmbulanceId : null;
    if (assigned && assigned !== uid) {
      Alert.alert(t("error"), t("caseAssignedToAnotherAmbulance"));
      return;
    }
    if (!assigned) {
      Alert.alert(t("error"), "Claim this emergency before advancing status.");
      return;
    }
    const cur = normalizeLifecycleStatus(snap.data()?.status);
    const next = getNextLifecycle(cur);
    if (!next || !canTransitionLifecycle(cur, next)) {
      Alert.alert(t("error"), "Invalid step");
      return;
    }
    const res = await updateLifecycleTransaction(e.id, uid, next);
    if (!res.ok) {
      Alert.alert(t("error"), String((res as any).reason ?? "Update failed"));
    }
  };

  const onClaimPress = async () => {
    const uid = userUidRef.current;
    const e = emergencyRef.current;
    if (!uid || !e?.id) return;
    const res = await claimEmergencyTransaction(e.id, uid);
    if (!res.ok && (res as any).reason === "already_claimed") {
      Alert.alert(t("error"), t("caseAssignedToAnotherAmbulance"));
    }
  };

  const releaseAssignment = async () => {
    const uid = userUidRef.current;
    const e = emergencyRef.current;
    if (!uid || !e?.id) return;
    if (e.assignedAmbulanceId !== uid) {
      Alert.alert(t("error"), t("caseAssignedToAnotherAmbulance"));
      return;
    }
    const cur = normalizeLifecycleStatus(e.status);
    if (cur !== "dispatched") {
      Alert.alert(t("error"), "Release is only available before leaving for the scene.");
      return;
    }

    const baseLoc = e.patientLocation ?? e.location;
    const lat = baseLoc?.latitude;
    const lng = baseLoc?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") {
      Alert.alert(t("error"), t("locationNotAvailable") || "Patient location not available.");
      return;
    }

    stopTracking();

    await rejectAndReassignEmergency({
      emergencyId: e.id,
      rejectingAmbulanceId: uid,
      patientLocation: { latitude: lat, longitude: lng },
    });

    Alert.alert("Reassigned", "This emergency was reassigned to another ambulance.");
    if (router.canGoBack()) router.back();
    else router.replace("/ambulance/dashboard");
  };

  const saveClinicalSnapshot = async () => {
    const e = emergencyRef.current;
    const uid = userUidRef.current;
    if (!e?.id || !uid) return;
    const lc = normalizeLifecycleStatus(String(e.status));
    if (!allowsMedicalSnapshotFields(lc)) {
      Alert.alert(t("error"), "Patient assessment is only available after you mark Arrived.");
      return;
    }
    if (e.assignedAmbulanceId && e.assignedAmbulanceId !== uid) {
      Alert.alert(t("error"), t("caseAssignedToAnotherAmbulance"));
      return;
    }
    setSnapSaving(true);
    try {
      const snapDoc = await getDoc(doc(db, "emergencies", e.id));
      const prev = snapDoc.data()?.currentSnapshot;
      const symptomsArr = snapSymptoms.split(",").map((x) => x.trim()).filter(Boolean);
      const hrN = snapHr.trim() ? Number(snapHr) : NaN;
      const o2N = snapO2.trim() ? Number(snapO2) : NaN;
      const vitals: NonNullable<PatientSnapshot["vitals"]> = {};
      if (Number.isFinite(hrN)) vitals.heartRate = hrN;
      if (Number.isFinite(o2N)) vitals.oxygen = o2N;
      if (snapBp.trim()) vitals.bloodPressure = snapBp.trim();

      const snapshot = mergePatientSnapshot(
        prev as Record<string, unknown> | undefined,
        {
          conditionLevel: snapCondition,
          symptoms: symptomsArr,
          vitals: Object.keys(vitals).length ? vitals : undefined,
          ambulanceStatus: ambulanceStatusLabel(lc),
        },
        "arrived",
      );

      await updateDoc(
        doc(db, "emergencies", e.id),
        stripUndefinedDeep({
          currentSnapshot: snapshotPayloadForLifecycle("arrived", snapshot),
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (err) {
      console.error(err);
      Alert.alert(t("error"), "Could not save patient snapshot");
    } finally {
      setSnapSaving(false);
    }
  };

  const openNavigation = () => {
    if (!emergency) return;

    const baseLoc = emergency.patientLocation ?? emergency.location;
    const { latitude, longitude } = baseLoc;
    const url = Platform.select({
      ios: `maps://maps.apple.com/?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });

    Linking.canOpenURL(url || "").then((supported) => {
      if (supported) {
        Linking.openURL(url || "");
      } else {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
      }
    }).catch((error) => {
      console.error("Error opening navigation:", error);
      Alert.alert(t("error"), t("failedToOpenNavigation"));
    });
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) > 1 ? "s" : ""} ago`;
    return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) > 1 ? "s" : ""} ago`;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>{t("loading") || "Loading..."}</Text>
      </View>
    );
  }

  if (!emergency) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{t("error") || "Error loading emergency"}</Text>
      </View>
    );
  }

  const baseLoc = emergency.patientLocation ?? emergency.location;
  const distance = ambulanceLocation && baseLoc
    ? calculateDistance(
        ambulanceLocation.latitude,
        ambulanceLocation.longitude,
        baseLoc.latitude,
        baseLoc.longitude
      )
    : null;

  const lifecycle = normalizeLifecycleStatus(String(emergency.status));
  const assessmentMode =
    emergency.sessionStatus === "active" && allowsMedicalSnapshotFields(lifecycle);
  const transportOnly =
    emergency.sessionStatus === "active" &&
    (lifecycle === "dispatched" || lifecycle === "enRoute");

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/ambulance/dashboard");
          }}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("emergencyDetails") || "Emergency Details"}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Emergency Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {emergency.sessionStatus === "active"
                ? `🚨 ${t("activeEmergency") || "ACTIVE EMERGENCY"}`
                : emergency.sessionStatus === "resolved"
                  ? "✓ Case resolved"
                  : "Case cancelled"}
            </Text>
          </View>
          <Text style={styles.timeText}>{formatTimeAgo(emergency.timestamp)}</Text>
          {emergency.victimType === "other" && (
            <Text style={styles.victimBadge}>🆘 {t("victimHelpingOther")}</Text>
          )}
          <Text style={styles.callerBadge}>
            🚑 {t("caseStatusLabel")}:{" "}
            {LIFECYCLE_LABELS[normalizeLifecycleStatus(String(emergency.status))] ?? emergency.status}
          </Text>
          {emergency.assignedAmbulanceId ? (
            <Text style={styles.callerBadge}>
              {t("assignedLabel")}: {isAssignedToMe ? t("you") : emergency.assignedAmbulanceId}
            </Text>
          ) : (
            <Text style={styles.callerBadge}>{t("unassigned")}</Text>
          )}
        </View>

        {transportOnly ? (
          <View style={styles.transportBanner}>
            <Text style={styles.transportBannerTitle}>🚑 Transport phase</Text>
            <Text style={styles.transportBannerText}>
              Use navigation, live map, and GPS below. ETA updates the doctor dashboard automatically. Patient assessment
              (condition, symptoms, vitals) unlocks after you advance status to Arrived.
            </Text>
          </View>
        ) : null}

        {assessmentMode ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🫀 Patient assessment</Text>
            <View style={styles.infoCard}>
              <Text style={styles.snapHint}>
                On-scene clinical snapshot — visible to doctors in real time. Timeline is unchanged.
              </Text>
              <Text style={styles.snapLabel}>Condition</Text>
              <View style={styles.conditionRow}>
                {(["stable", "moderate", "critical"] as const).map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.conditionChip,
                      snapCondition === c && styles.conditionChipActive,
                      c === "critical" && styles.conditionChipDanger,
                    ]}
                    onPress={() => setSnapCondition(c)}
                  >
                    <Text
                      style={[styles.conditionChipText, snapCondition === c && { color: "#FFF" }]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.snapLabel}>Symptoms (comma-separated)</Text>
              <TextInput
                style={styles.snapInput}
                value={snapSymptoms}
                onChangeText={setSnapSymptoms}
                placeholder="e.g. chest pain, shortness of breath"
                placeholderTextColor="#ADB5BD"
                multiline
              />
              <Text style={styles.snapLabel}>Vitals (optional)</Text>
              <View style={styles.vitalsRow}>
                <TextInput
                  style={[styles.snapInput, styles.vitalsField]}
                  value={snapHr}
                  onChangeText={setSnapHr}
                  placeholder="HR"
                  keyboardType="numeric"
                  placeholderTextColor="#ADB5BD"
                />
                <TextInput
                  style={[styles.snapInput, styles.vitalsField]}
                  value={snapO2}
                  onChangeText={setSnapO2}
                  placeholder="SpO₂ %"
                  keyboardType="numeric"
                  placeholderTextColor="#ADB5BD"
                />
              </View>
              <TextInput
                style={styles.snapInput}
                value={snapBp}
                onChangeText={setSnapBp}
                placeholder="Blood pressure e.g. 120/80"
                placeholderTextColor="#ADB5BD"
              />
              <TouchableOpacity
                style={[styles.navigateButton, { marginTop: 12 }, snapSaving && { opacity: 0.7 }]}
                onPress={saveClinicalSnapshot}
                disabled={snapSaving}
              >
                <Text style={styles.navigateButtonText}>
                  {snapSaving ? "Saving…" : "Save assessment"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Live Map */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗺️ Live Map</Text>
          <View style={styles.mapWrapper}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: baseLoc.latitude,
                longitude: baseLoc.longitude,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              }}
              scrollEnabled
              zoomEnabled
              showsUserLocation={false}
            >
              <Marker
                coordinate={{ latitude: baseLoc.latitude, longitude: baseLoc.longitude }}
                title="Patient"
                description={baseLoc.address ?? `${baseLoc.latitude.toFixed(5)}, ${baseLoc.longitude.toFixed(5)}`}
                pinColor="#D62828"
              />
              {ambulanceLocation && (
                <Marker
                  coordinate={{ latitude: ambulanceLocation.latitude, longitude: ambulanceLocation.longitude }}
                  title="Ambulance"
                  description="Your current location"
                  pinColor="#0074D9"
                />
              )}
            </MapView>
            {tracking && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
        </View>

        {/* Ambulance controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚑 Live Updates</Text>
          <View style={styles.infoCard}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[styles.navigateButton, { flex: 1, backgroundColor: tracking ? "#6C757D" : "#D62828" }]}
                onPress={tracking ? stopTracking : startTracking}
              >
                <Text style={styles.navigateButtonText}>
                  {tracking ? t("stopGps") : t("startGps")}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.navigateText}>
              GPS updates are published every few seconds while enabled.
            </Text>
          </View>
        </View>

        {emergency.sessionStatus === "active" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📢 Dispatch control</Text>
            <View style={styles.infoCard}>
              {!emergency.assignedAmbulanceId ? (
                <TouchableOpacity style={styles.navigateButton} onPress={onClaimPress}>
                  <Text style={styles.navigateButtonText}>Claim emergency</Text>
                </TouchableOpacity>
              ) : null}

              {emergency.assignedAmbulanceId && emergency.assignedAmbulanceId !== user?.uid ? (
                <Text style={styles.navigateText}>{t("caseAssignedToAnotherAmbulance")}</Text>
              ) : null}

              {isAssignedToMe && normalizeLifecycleStatus(String(emergency.status)) === "dispatched" ? (
                <TouchableOpacity
                  style={[styles.navigateButton, { backgroundColor: "#6C757D", marginTop: 12 }]}
                  onPress={releaseAssignment}
                >
                  <Text style={styles.navigateButtonText}>Release assignment</Text>
                </TouchableOpacity>
              ) : null}

              {isAssignedToMe && getNextLifecycle(normalizeLifecycleStatus(String(emergency.status))) ? (
                <TouchableOpacity style={[styles.navigateButton, { marginTop: 12 }]} onPress={advanceOneStep}>
                  <Text style={styles.navigateButtonText}>
                    Next:{" "}
                    {LIFECYCLE_LABELS[getNextLifecycle(normalizeLifecycleStatus(String(emergency.status)))!]}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.navigateText}>This case is no longer active.</Text>
          </View>
        )}

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 {t("location") || "Location"}</Text>
          <TouchableOpacity style={styles.locationCard} onPress={openNavigation}>
            <Text style={styles.locationAddress}>
              {baseLoc.address || `${baseLoc.latitude.toFixed(6)}, ${baseLoc.longitude.toFixed(6)}`}
            </Text>
            <Text style={styles.locationCoords}>
              {baseLoc.latitude.toFixed(6)}, {baseLoc.longitude.toFixed(6)}
            </Text>
            {distance && (
              <Text style={styles.distanceText}>
                📏 {distance < 1 
                  ? `${(distance * 1000).toFixed(0)} meters away`
                  : `${distance.toFixed(2)} km away`}
              </Text>
            )}
            <Text style={styles.navigateText}>🗺️ Tap to open navigation</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy message for "other" */}
        {emergency.victimType === "other" && (
          <View style={styles.section}>
            <View style={styles.notFoundCard}>
              <Text style={styles.notFoundTitle}>{t("privacyModeTitle")}</Text>
              <Text style={styles.notFoundText}>
                {t("privacyModeNoProfile")}
              </Text>
            </View>
          </View>
        )}

        {/* User Information (only when victimType is "me") */}
        {emergency.victimType !== "other" && userInfo && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>👤 {t("patientInformation") || "Patient Information"}</Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t("name") || "Name"}:</Text>
                  <Text style={styles.infoValue}>{userInfo.name || userInfo.email || "N/A"}</Text>
                </View>
                {userInfo.israeliId && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t("israeliId") || "Israeli ID"}:</Text>
                    <Text style={styles.infoValue}>{userInfo.israeliId}</Text>
                  </View>
                )}
                {userInfo.phoneNumber && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t("phoneNumber") || "Phone"}:</Text>
                    <Text style={styles.infoValue}>{userInfo.phoneNumber}</Text>
                  </View>
                )}
                {userInfo.age && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t("age") || "Age"}:</Text>
                    <Text style={styles.infoValue}>{userInfo.age}</Text>
                  </View>
                )}
                {userInfo.bloodType && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t("blood_type") || "Blood Type"}:</Text>
                    <Text style={[styles.infoValue, styles.bloodType]}>{userInfo.bloodType}</Text>
                  </View>
                )}
                {userInfo.weight && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t("weight") || "Weight"}:</Text>
                    <Text style={styles.infoValue}>{userInfo.weight} kg</Text>
                  </View>
                )}
                {userInfo.height && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t("height") || "Height"}:</Text>
                    <Text style={styles.infoValue}>{userInfo.height} cm</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Medical History */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏥 {t("medicalHistory") || "Medical History"}</Text>
              <View style={styles.infoCard}>
                {userInfo.diseases && (
                  <View style={styles.medicalSection}>
                    <Text style={styles.medicalLabel}>{t("diseases") || "Diseases"}:</Text>
                    <Text style={styles.medicalValue}>{userInfo.diseases}</Text>
                  </View>
                )}
                {userInfo.medications && (
                  <View style={styles.medicalSection}>
                    <Text style={styles.medicalLabel}>{t("medications") || "Medications"}:</Text>
                    <Text style={styles.medicalValue}>{userInfo.medications}</Text>
                  </View>
                )}
                {userInfo.allergies && (
                  <View style={styles.medicalSection}>
                    <Text style={styles.medicalLabel}>{t("allergies") || "Allergies"}:</Text>
                    <Text style={[styles.medicalValue, styles.allergyWarning]}>{userInfo.allergies}</Text>
                  </View>
                )}
                {userInfo.sensitiveNotes && (
                  <View style={styles.medicalSection}>
                    <Text style={styles.medicalLabel}>{t("sensitiveNotes") || "Sensitive Notes"}:</Text>
                    <Text style={styles.medicalValue}>{userInfo.sensitiveNotes}</Text>
                  </View>
                )}
                {!userInfo.diseases && !userInfo.medications && !userInfo.allergies && !userInfo.sensitiveNotes && (
                  <Text style={styles.noDataText}>{t("noMedicalHistory") || "No medical history available"}</Text>
                )}
              </View>
            </View>

            {/* Emergency Contacts */}
            {userInfo.emergencyContacts && userInfo.emergencyContacts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📞 {t("emergency_contact") || "Emergency Contacts"}</Text>
                <View style={styles.infoCard}>
                  {userInfo.emergencyContacts.map((contact: any, index: number) => (
                    <View key={index} style={styles.contactRow}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactPhone}>{contact.phone}</Text>
                      {contact.relationship && (
                        <Text style={styles.contactRelation}>({contact.relationship})</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* Navigation Button */}
        <TouchableOpacity style={styles.navigateButton} onPress={openNavigation}>
          <Text style={styles.navigateButtonText}>🗺️ {t("openNavigation") || "Open Navigation"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingTop: 60,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  statusCard: {
    backgroundColor: "#DC2626",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: "center",
  },
  statusBadge: {
    marginBottom: 8,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
  timeText: {
    color: "#FFFFFF",
    fontSize: 14,
    opacity: 0.9,
  },
  victimBadge: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 8,
  },
  callerBadge: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginTop: 4,
  },
  snapHint: {
    fontSize: 12,
    color: "#6C757D",
    marginBottom: 12,
    lineHeight: 18,
  },
  snapLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 6,
    marginTop: 10,
  },
  conditionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  conditionChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E9ECEF",
    backgroundColor: "#F8F9FA",
  },
  conditionChipActive: {
    backgroundColor: "#003049",
    borderColor: "#003049",
  },
  conditionChipDanger: {},
  conditionChipText: {
    fontWeight: "800",
    color: "#003049",
    textTransform: "capitalize",
  },
  snapInput: {
    borderWidth: 1.5,
    borderColor: "#E9ECEF",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#003049",
    backgroundColor: "#FFFFFF",
  },
  vitalsRow: {
    flexDirection: "row",
    gap: 10,
  },
  vitalsField: {
    flex: 1,
  },
  notFoundCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "#E9ECEF",
    alignItems: "center",
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 8,
  },
  notFoundText: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 12,
  },
  transportBanner: {
    backgroundColor: "#E7F1FF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: "#B6D4FE",
  },
  transportBannerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 8,
  },
  transportBannerText: {
    fontSize: 14,
    color: "#495057",
    lineHeight: 20,
  },
  locationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#D62828",
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 8,
  },
  locationCoords: {
    fontSize: 12,
    color: "#6C757D",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  distanceText: {
    fontSize: 14,
    color: "#D62828",
    fontWeight: "700",
    marginBottom: 8,
  },
  navigateText: {
    fontSize: 14,
    color: "#D62828",
    fontWeight: "600",
    marginTop: 8,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  infoLabel: {
    fontSize: 14,
    color: "#6C757D",
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    color: "#003049",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  bloodType: {
    color: "#D62828",
    fontSize: 16,
  },
  medicalSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  medicalLabel: {
    fontSize: 14,
    color: "#6C757D",
    fontWeight: "600",
    marginBottom: 8,
  },
  medicalValue: {
    fontSize: 14,
    color: "#212529",
    lineHeight: 20,
  },
  allergyWarning: {
    color: "#D62828",
    fontWeight: "700",
  },
  noDataText: {
    fontSize: 14,
    color: "#6C757D",
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
  },
  contactRow: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  contactName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: "#6C757D",
    marginBottom: 4,
  },
  contactRelation: {
    fontSize: 12,
    color: "#ADB5BD",
  },
  navigateButton: {
    backgroundColor: "#D62828",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  navigateButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  actionStatusBtn: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: "#E9ECEF",
    marginBottom: 10,
  },
  actionStatusBtnActive: {
    backgroundColor: "#D62828",
    borderColor: "#D62828",
  },
  actionStatusBtnText: {
    color: "#003049",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#6C757D",
  },
  errorText: {
    fontSize: 18,
    color: "#D62828",
  },
  mapWrapper: {
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  liveIndicator: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#D62828",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  liveText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
