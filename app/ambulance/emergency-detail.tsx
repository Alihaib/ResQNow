import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import EmergencyChat from "../../components/EmergencyChat";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";
import {
  allowsMedicalSnapshotFields,
  ambulanceStatusLabel,
  mergePatientSnapshot,
  snapshotPayloadForLifecycle,
  type ConditionLevel,
  type PatientSnapshot,
  snapshotFromFirestore,
} from "../../src/emergency/patientSnapshot";
import { stripUndefinedDeep } from "../../src/utils/firestoreSanitize";
import { openMapsNavigation } from "../../src/utils/openMapsNavigation";
import {
  canTransitionLifecycle,
  normalizeLifecycleStatus,
  type LifecycleStatus,
} from "../../src/emergency/stateMachine";
import { useAmbulanceGps } from "../../src/hooks/useAmbulanceGps";
import {
  startAmbulanceGpsTracking,
  stopAmbulanceGpsTracking,
} from "../../src/services/ambulanceGpsService";
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
  /** Mission GPS session flag (synced for resume after app restart). */
  gpsActive?: boolean;
  currentSnapshot?: PatientSnapshot | null;
  timeline?: Array<{ status?: string; timestamp?: string; ambulanceId?: string; text?: string }>;
}

const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  dispatched: "Dispatched",
  enRoute: "En route",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

function phaseAccentBar(lc: LifecycleStatus) {
  switch (lc) {
    case "dispatched":
      return styles.phaseBarDispatched;
    case "enRoute":
      return styles.phaseBarEnRoute;
    case "arrived":
      return styles.phaseBarArrived;
    case "completed":
      return styles.phaseBarCompleted;
    case "cancelled":
      return styles.phaseBarCancelled;
    default:
      return styles.phaseBarDispatched;
  }
}

export default function EmergencyDetailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, role, approved, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ emergencyId: string }>();
  const [emergency, setEmergency] = useState<Emergency | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const ambulanceGps = useAmbulanceGps();
  const trackingThisMission =
    ambulanceGps.isGpsActive && ambulanceGps.activeEmergencyId === params.emergencyId;
  /** One-shot device location before Firestore / mission GPS fills the marker. */
  const [geoBootstrapLoc, setGeoBootstrapLoc] = useState<{ latitude: number; longitude: number } | null>(null);
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
          gpsActive: data.gpsActive === true,
          currentSnapshot: snapshotFromFirestore(data.currentSnapshot),
          timeline: Array.isArray(data.timeline) ? data.timeline : undefined,
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
          setGeoBootstrapLoc({
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

  const ambulanceLocation = useMemo(() => {
    if (trackingThisMission && ambulanceGps.lastCoords) return ambulanceGps.lastCoords;
    const al = emergency?.ambulanceLocation;
    if (al != null && typeof al.latitude === "number" && typeof al.longitude === "number") {
      return { latitude: al.latitude, longitude: al.longitude };
    }
    return geoBootstrapLoc;
  }, [trackingThisMission, ambulanceGps.lastCoords, emergency?.ambulanceLocation, geoBootstrapLoc]);

  /** Resume mission GPS after process kill when Firestore still marks the session active. */
  useEffect(() => {
    if (!emergency?.id || !user?.uid) return;
    if (emergency.gpsActive !== true) return;
    if (emergency.assignedAmbulanceId !== user.uid) return;
    if (emergency.sessionStatus !== "active") return;
    const lc = normalizeLifecycleStatus(String(emergency.status));
    if (lc === "completed" || lc === "cancelled") return;

    void startAmbulanceGpsTracking(emergency.id, user.uid).catch((err) => {
      console.warn("[AmbulanceEmergencyDetail] resume GPS failed:", err);
    });
  }, [
    emergency?.id,
    emergency?.gpsActive,
    emergency?.assignedAmbulanceId,
    emergency?.sessionStatus,
    emergency?.status,
    user?.uid,
  ]);

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
    if (ambulanceGps.isBootstrapping) return;

    try {
      await startAmbulanceGpsTracking(e.id, uid);
    } catch (err: unknown) {
      console.error("[AmbulanceEmergencyDetail] startTracking failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "location_permission_denied") {
        Alert.alert(t("error"), t("locationPermissionDenied"));
      } else {
        Alert.alert(
          t("error"),
          t("locationPermissionDenied") || "Could not start GPS tracking. Check location services.",
        );
      }
    }
  };

  const stopTracking = () => {
    void stopAmbulanceGpsTracking("user_stop");
  };

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

    await stopAmbulanceGpsTracking("release_assignment");

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

  // Delegates to the shared `openMapsNavigation` utility — see that file
  // for the cross-platform safety contract (no `maps://` outside iOS, no
  // `google.navigation:` anywhere, HTTPS Google Maps as universal fallback).
  const openNavigation = async () => {
    if (!emergency) return;
    const baseLoc = emergency.patientLocation ?? emergency.location;
    const result = await openMapsNavigation({
      latitude: baseLoc?.latitude as number,
      longitude: baseLoc?.longitude as number,
    });
    if (result.ok) return;
    Alert.alert(
      t("error"),
      result.reason === "invalid_coords"
        ? t("locationNotAvailable")
        : t("failedToOpenNavigation"),
    );
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

  const timelineSorted = useMemo(() => {
    const items = emergency?.timeline ?? [];
    return [...items].sort((a, b) => {
      const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bt - at;
    });
  }, [emergency?.timeline]);

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
        {/* 1 — Mission header: phase, ETA, primary action */}
        <View style={[styles.missionCard, phaseAccentBar(lifecycle)]}>
          <Text style={styles.missionKicker}>Mission</Text>
          <Text style={styles.missionPhaseTitle}>{LIFECYCLE_LABELS[lifecycle]}</Text>
          <Text style={styles.missionSessionTag}>
            {emergency.sessionStatus === "active"
              ? "ACTIVE"
              : emergency.sessionStatus === "resolved"
                ? "Resolved"
                : "Cancelled"}
          </Text>

          {lifecycle !== "arrived" &&
          typeof emergency.currentSnapshot?.eta === "number" &&
          Number.isFinite(emergency.currentSnapshot.eta) ? (
            <View style={styles.missionEtaRow}>
              <Text style={styles.missionEtaLabel}>ETA</Text>
              <Text style={styles.missionEtaValue}>{emergency.currentSnapshot.eta} min</Text>
            </View>
          ) : null}

          {distance != null ? (
            <Text style={styles.missionDistance}>
              ≈{" "}
              {distance < 1
                ? `${Math.round(distance * 1000)} m`
                : `${distance.toFixed(1)} km`}{" "}
              to scene
            </Text>
          ) : null}

          {emergency.sessionStatus === "active" ? (
            <>
              {!emergency.assignedAmbulanceId ? (
                <TouchableOpacity style={styles.missionPrimaryBtn} onPress={onClaimPress}>
                  <Text style={styles.missionPrimaryBtnText}>Claim emergency</Text>
                </TouchableOpacity>
              ) : null}

              {emergency.assignedAmbulanceId && emergency.assignedAmbulanceId !== user?.uid ? (
                <Text style={styles.missionBlocked}>{t("caseAssignedToAnotherAmbulance")}</Text>
              ) : null}

              {isAssignedToMe && getNextLifecycle(lifecycle) ? (
                <TouchableOpacity style={styles.missionPrimaryBtn} onPress={advanceOneStep}>
                  <Text style={styles.missionPrimaryBtnText}>
                    Next: {LIFECYCLE_LABELS[getNextLifecycle(lifecycle)!]}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {isAssignedToMe && !getNextLifecycle(lifecycle) ? (
                <Text style={styles.missionHint}>No further status updates</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.missionHint}>This case is no longer active.</Text>
          )}

          <View style={styles.missionMetaRow}>
            <Text style={styles.missionMeta} numberOfLines={2}>
              {emergency.victimType === "other" ? `🆘 ${t("victimHelpingOther")}` : "Caller"} ·{" "}
              {formatTimeAgo(emergency.timestamp)}
            </Text>
            <Text style={styles.missionMeta} numberOfLines={1}>
              {emergency.assignedAmbulanceId
                ? isAssignedToMe
                  ? `✓ ${t("you")}`
                  : t("assignedLabel")
                : t("unassigned")}
            </Text>
          </View>
        </View>

        {/* 2 — Map & route */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>Navigation</Text>
          <Text style={styles.sectionTitle}>Map & route</Text>
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
                title={t("mapLegendPatient")}
                description={baseLoc.address ?? `${baseLoc.latitude.toFixed(5)}, ${baseLoc.longitude.toFixed(5)}`}
                pinColor="#D62828"
              />
              {ambulanceLocation && (
                <Marker
                  coordinate={{ latitude: ambulanceLocation.latitude, longitude: ambulanceLocation.longitude }}
                  title={t("mapLegendAmbulance")}
                  description={t("you")}
                  pinColor="#0074D9"
                />
              )}
            </MapView>
            <View style={styles.mapTrackingOverlay} pointerEvents="none">
              {lifecycle !== "arrived" &&
              typeof emergency.currentSnapshot?.eta === "number" &&
              Number.isFinite(emergency.currentSnapshot.eta) ? (
                <Text style={styles.mapTrackingEta}>
                  ETA (crew) · {emergency.currentSnapshot.eta} min
                </Text>
              ) : null}
              {distance != null ? (
                <Text style={styles.mapTrackingDist}>
                  ≈{" "}
                  {distance < 1
                    ? `${Math.round(distance * 1000)} m`
                    : `${distance.toFixed(1)} km`}{" "}
                  to patient
                </Text>
              ) : null}
            </View>
            {trackingThisMission && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.mapNavButton} onPress={openNavigation} activeOpacity={0.85}>
            <Text style={styles.mapNavButtonText}>🗺️ {t("openNavigation") || "Open turn-by-turn navigation"}</Text>
          </TouchableOpacity>
          <Text style={styles.destOneLine} numberOfLines={2}>
            {baseLoc.address || `${baseLoc.latitude.toFixed(5)}, ${baseLoc.longitude.toFixed(5)}`}
          </Text>
        </View>

        {/* 3 — Context actions (secondary; primary lifecycle control is in Mission) */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>{transportOnly ? "Transport" : assessmentMode ? "On scene" : "Actions"}</Text>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.infoCard}>
            {emergency.sessionStatus === "active" && isAssignedToMe ? (
              <>
                {transportOnly ? (
                  <TouchableOpacity style={styles.actionOutlineBtn} onPress={openNavigation}>
                    <Text style={styles.actionOutlineBtnText}>Continue navigation</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.actionOutlineBtn,
                    trackingThisMission && styles.actionOutlineBtnActive,
                  ]}
                  onPress={() => (trackingThisMission ? stopTracking() : void startTracking())}
                  disabled={ambulanceGps.isBootstrapping}
                >
                  <Text
                    style={[
                      styles.actionOutlineBtnText,
                      trackingThisMission && styles.actionOutlineBtnTextActive,
                    ]}
                  >
                    {ambulanceGps.isBootstrapping
                      ? t("loading")
                      : trackingThisMission
                        ? t("stopGps")
                        : t("startGps")}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.actionHelp}>
                  GPS publishes your position for dispatch while enabled (updates about every 4s).
                </Text>
                {transportOnly && lifecycle === "dispatched" ? (
                  <TouchableOpacity style={styles.actionMutedBtn} onPress={releaseAssignment}>
                    <Text style={styles.actionMutedBtnText}>Release assignment</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}

            {assessmentMode ? (
              <Text style={styles.actionHelp}>
                Document condition, symptoms, and vitals below, then use Mission → Next when ready to complete transport.
              </Text>
            ) : null}

            {!transportOnly && !assessmentMode && emergency.sessionStatus === "active" ? (
              <TouchableOpacity style={styles.actionOutlineBtn} onPress={openNavigation}>
                <Text style={styles.actionOutlineBtnText}>Open navigation</Text>
              </TouchableOpacity>
            ) : null}

            {emergency.sessionStatus !== "active" ? (
              <Text style={styles.missionHint}>Read-only — case closed.</Text>
            ) : null}
          </View>
        </View>

        {/* 4 — Patient snapshot (compact) + on-scene edits when arrived */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>Patient</Text>
          <Text style={styles.sectionTitle}>Live snapshot</Text>
          <View style={styles.compactSnapCard}>
            {transportOnly ? (
              <Text style={styles.compactLine}>
                <Text style={styles.compactBold}>Crew · </Text>
                {emergency.currentSnapshot?.ambulanceStatus?.trim() || "—"}
              </Text>
            ) : assessmentMode ? (
              <>
                <Text style={styles.compactLine}>
                  <Text style={styles.compactBold}>Condition · </Text>
                  {emergency.currentSnapshot?.conditionLevel ?? "—"}
                </Text>
                <Text style={styles.compactLine} numberOfLines={4}>
                  <Text style={styles.compactBold}>Symptoms · </Text>
                  {emergency.currentSnapshot?.symptoms?.length
                    ? emergency.currentSnapshot.symptoms.join(", ")
                    : "—"}
                </Text>
                <Text style={styles.compactLine} numberOfLines={3}>
                  <Text style={styles.compactBold}>Vitals · </Text>
                  {[
                    emergency.currentSnapshot?.vitals?.heartRate != null
                      ? `HR ${emergency.currentSnapshot.vitals.heartRate}`
                      : null,
                    emergency.currentSnapshot?.vitals?.oxygen != null
                      ? `SpO₂ ${emergency.currentSnapshot.vitals.oxygen}%`
                      : null,
                    emergency.currentSnapshot?.vitals?.bloodPressure
                      ? `BP ${emergency.currentSnapshot.vitals.bloodPressure}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </Text>
              </>
            ) : (
              <Text style={styles.compactMuted}>Snapshot details follow crew updates for this phase.</Text>
            )}
          </View>

          {assessmentMode ? (
            <View style={styles.infoCard}>
              <Text style={styles.assessmentIntroTitle}>Patient Assessment Mode</Text>
              <Text style={styles.assessmentIntroText}>
                Updates sync to dispatch live. Use Mission → Next when transport is complete.
              </Text>
              <Text style={styles.snapSectionHeading}>Condition level</Text>
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
                    <Text style={[styles.conditionChipText, snapCondition === c && { color: "#FFF" }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.snapSectionHeading}>Symptoms</Text>
              <TextInput
                style={styles.snapInput}
                value={snapSymptoms}
                onChangeText={setSnapSymptoms}
                placeholder="Comma-separated, e.g. chest pain, dyspnea"
                placeholderTextColor="#ADB5BD"
                multiline
              />
              <Text style={styles.snapSectionHeading}>Vitals</Text>
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
                style={[styles.saveAssessmentBtn, snapSaving && { opacity: 0.7 }]}
                onPress={saveClinicalSnapshot}
                disabled={snapSaving}
              >
                <Text style={styles.saveAssessmentBtnText}>{snapSaving ? "Saving…" : "Save assessment"}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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

        {/* 5 — Timeline / log */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>Secondary</Text>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timelineCard}>
            {timelineSorted.length === 0 ? (
              <Text style={styles.compactMuted}>No timeline entries yet.</Text>
            ) : (
              timelineSorted.slice(0, 20).map((item, idx) => (
                <View key={idx} style={styles.timelineEntry}>
                  <Text style={styles.timelineStatus}>{item.status ?? "—"}</Text>
                  <Text style={styles.timelineTime}>
                    {item.timestamp ? new Date(item.timestamp).toLocaleString() : "—"}
                  </Text>
                  {item.text ? <Text style={styles.timelineNote}>{item.text}</Text> : null}
                </View>
              ))
            )}
          </View>
        </View>

        {/* Dispatcher chat between ambulance and doctor */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>Communication</Text>
          <Text style={styles.sectionTitle}>Dispatcher Chat</Text>
          <View style={styles.timelineCard}>
            {params.emergencyId && user?.uid ? (
              <EmergencyChat
                emergencyId={params.emergencyId}
                currentUserId={user.uid}
                currentUserRole="ambulance"
                isActive={emergency.sessionStatus === "active"}
              />
            ) : null}
          </View>
        </View>

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
    paddingBottom: 36,
  },
  missionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  phaseBarDispatched: {
    borderLeftWidth: 6,
    borderLeftColor: "#F59E0B",
  },
  phaseBarEnRoute: {
    borderLeftWidth: 6,
    borderLeftColor: "#2563EB",
  },
  phaseBarArrived: {
    borderLeftWidth: 6,
    borderLeftColor: "#16A34A",
  },
  phaseBarCompleted: {
    borderLeftWidth: 6,
    borderLeftColor: "#64748B",
  },
  phaseBarCancelled: {
    borderLeftWidth: 6,
    borderLeftColor: "#9CA3AF",
  },
  missionKicker: {
    fontSize: 11,
    fontWeight: "900",
    color: "#868E96",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  missionPhaseTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#003049",
    letterSpacing: -0.5,
  },
  missionSessionTag: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "900",
    color: "#D62828",
    letterSpacing: 0.5,
  },
  missionEtaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFF5F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  missionEtaLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#991B1B",
  },
  missionEtaValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#D62828",
  },
  missionDistance: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "800",
    color: "#495057",
  },
  missionPrimaryBtn: {
    marginTop: 16,
    backgroundColor: "#D62828",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  missionPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  missionBlocked: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "700",
    color: "#991B1B",
    textAlign: "center",
  },
  missionHint: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#6C757D",
    textAlign: "center",
  },
  missionMetaRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E9ECEF",
    gap: 6,
  },
  missionMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6C757D",
    lineHeight: 17,
  },
  mapNavButton: {
    marginTop: 14,
    backgroundColor: "#003049",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  mapNavButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  destOneLine: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
    color: "#495057",
    lineHeight: 18,
  },
  actionOutlineBtn: {
    borderWidth: 2,
    borderColor: "#003049",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  actionOutlineBtnActive: {
    borderColor: "#6C757D",
    backgroundColor: "#F8F9FA",
  },
  actionOutlineBtnText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#003049",
  },
  actionOutlineBtnTextActive: {
    color: "#495057",
  },
  actionHelp: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6C757D",
    lineHeight: 17,
    marginBottom: 12,
  },
  actionMutedBtn: {
    marginTop: 4,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionMutedBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6C757D",
    textDecorationLine: "underline",
  },
  compactSnapCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  compactLine: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212529",
    lineHeight: 20,
    marginBottom: 8,
  },
  compactBold: {
    fontWeight: "900",
    color: "#003049",
  },
  compactMuted: {
    fontSize: 13,
    fontWeight: "600",
    color: "#868E96",
    fontStyle: "italic",
  },
  saveAssessmentBtn: {
    marginTop: 16,
    backgroundColor: "#D62828",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveAssessmentBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  timelineCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  timelineEntry: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F5",
  },
  timelineStatus: {
    fontSize: 13,
    fontWeight: "900",
    color: "#003049",
  },
  timelineTime: {
    fontSize: 11,
    fontWeight: "700",
    color: "#868E96",
    marginTop: 4,
  },
  timelineNote: {
    fontSize: 12,
    fontWeight: "600",
    color: "#495057",
    marginTop: 6,
    lineHeight: 17,
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
  sectionOverline: {
    fontSize: 11,
    fontWeight: "800",
    color: "#868E96",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 12,
  },
  etaPill: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF8F8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: "#F5C2C7",
  },
  etaPillLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#495057",
  },
  etaPillValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#D62828",
  },
  assessmentIntro: {
    backgroundColor: "#F8F9FA",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  assessmentIntroTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#003049",
    marginBottom: 6,
  },
  assessmentIntroText: {
    fontSize: 13,
    color: "#495057",
    lineHeight: 19,
    fontWeight: "600",
  },
  snapSectionHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: "#495057",
    marginBottom: 8,
    marginTop: 4,
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
  mapTrackingOverlay: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  mapTrackingEta: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F5132",
  },
  mapTrackingDist: {
    fontSize: 12,
    fontWeight: "700",
    color: "#495057",
    marginTop: 4,
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
