import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import EmergencyChat from "../../components/EmergencyChat";
import Button, { PrimaryButton } from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import CollapsibleSection from "../../components/ui/CollapsibleSection";
import ETAHighlight from "../../components/ui/ETAHighlight";
import InfoRow from "../../components/ui/InfoRow";
import MapPanel from "../../components/ui/MapPanel";
import ScreenHeader from "../../components/ui/ScreenHeader";
import SimpleStatusBlock from "../../components/ui/SimpleStatusBlock";
import StatusChip from "../../components/ui/StatusChip";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useUiDirection } from "../../components/ui/layout";
import { tokens } from "../../src/ui/tokens";
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
import { caseIdSuffix } from "../../src/utils/formatCaseId";
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
import {
  claimEmergencyTransaction,
  releaseEmergencyTransaction,
  updateLifecycleTransaction,
} from "../../src/services/emergencyAssignment";

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

function lifecycleLabelKey(lc: LifecycleStatus): string {
  if (lc === "enRoute") return "activityEvent_enRoute";
  if (lc === "arrived") return "activityEvent_arrived";
  if (lc === "completed") return "activityEvent_completed";
  if (lc === "cancelled") return "activityEvent_cancelled";
  return "activityEvent_dispatched";
}

export default function EmergencyDetailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { row } = useUiDirection();
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
    // Defensive: the Next button is only rendered when this ambulance is
    // already the assignee, so this path is normally a no-op. We still
    // attempt a single-winner claim in case the listener hasn't caught up.
    await claimIfUnassigned();
    const snap = await getDoc(doc(db, "emergencies", e.id));
    const assigned = snap.exists() ? (snap.data() as any).assignedAmbulanceId : null;
    if (assigned && assigned !== uid) {
      Alert.alert(t("error"), t("caseAssignedToAnotherAmbulance"));
      return;
    }
    if (!assigned) {
      Alert.alert(
        t("error"),
        t(
          "acceptBeforeAdvancing",
          "Accept this case before advancing its status.",
        ),
      );
      return;
    }
    const cur = normalizeLifecycleStatus(snap.data()?.status);
    const next = getNextLifecycle(cur);
    if (!next || !canTransitionLifecycle(cur, next)) {
      Alert.alert(t("error"), t("invalidStep"));
      return;
    }
    const res = await updateLifecycleTransaction(e.id, uid, next);
    if (!res.ok) {
      Alert.alert(t("error"), String((res as any).reason ?? "Update failed"));
    }
  };

  /**
   * Manual case acceptance.
   *
   * Runs the transactional claim; only one ambulance can ever win. On a race
   * with another ambulance the helper returns `reason: "already_claimed"` —
   * we show a friendly toast and stay on the screen so the responder can see
   * the case go to the other ambulance live via the snapshot listener.
   */
  const onAcceptPress = async () => {
    const uid = userUidRef.current;
    const e = emergencyRef.current;
    if (!uid || !e?.id) return;
    const res = await claimEmergencyTransaction(e.id, uid);
    if (!res.ok && (res as any).reason === "already_claimed") {
      Alert.alert(
        t("acceptCase", "Accept case"),
        t("caseAlreadyAssigned", "This case has already been assigned to another ambulance."),
      );
    }
  };

  /**
   * Release a previously-accepted case back to the dispatch pool.
   *
   * The case becomes available again for other ambulances to accept — the
   * system does NOT auto-pick a replacement. Only allowed before the
   * ambulance has marked itself as enRoute.
   */
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
      Alert.alert(t("error"), t("releaseOnlyBeforeEnRoute"));
      return;
    }

    await stopAmbulanceGpsTracking("release_assignment");

    const res = await releaseEmergencyTransaction(e.id, uid);
    if (!res.ok) {
      Alert.alert(t("error"), t("releaseFailed", "Could not release this case."));
      return;
    }

    Alert.alert(
      t("caseReleased", "Case released"),
      t(
        "caseReleasedMessage",
        "Returned to the dispatch pool — other ambulances can now accept it.",
      ),
    );
    if (router.canGoBack()) router.back();
    else router.replace("/ambulance/dashboard");
  };

  const saveClinicalSnapshot = async () => {
    const e = emergencyRef.current;
    const uid = userUidRef.current;
    if (!e?.id || !uid) return;
    const lc = normalizeLifecycleStatus(String(e.status));
    if (!allowsMedicalSnapshotFields(lc)) {
      Alert.alert(t("error"), t("patientAssessmentArrivedOnly"));
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
      Alert.alert(t("error"), t("couldNotSaveSnapshot"));
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

  const timelineSorted = useMemo(() => {
    const items = emergency?.timeline ?? [];
    return [...items].sort((a, b) => {
      const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bt - at;
    });
  }, [emergency?.timeline]);

  const lifecycle = normalizeLifecycleStatus(String(emergency?.status ?? "dispatched"));
  const assessmentMode =
    emergency?.sessionStatus === "active" && allowsMedicalSnapshotFields(lifecycle);
  const transportOnly =
    emergency?.sessionStatus === "active" &&
    (lifecycle === "dispatched" || lifecycle === "enRoute");

  const baseLoc = emergency?.patientLocation ?? emergency?.location;
  const distance =
    emergency && ambulanceLocation && baseLoc
      ? calculateDistance(
          ambulanceLocation.latitude,
          ambulanceLocation.longitude,
          baseLoc.latitude,
          baseLoc.longitude,
        )
      : null;

  const phaseLabel = useMemo(() => {
    const key = lifecycleLabelKey(lifecycle);
    const label = t(key);
    return label !== key ? label : t("missionStatus");
  }, [lifecycle, t]);

  const distanceLabel = useMemo(() => {
    if (distance == null) return null;
    return distance < 1
      ? `${Math.round(distance * 1000)} m`
      : `${distance.toFixed(1)} km`;
  }, [distance]);

  const statusSubtitle = useMemo(() => {
    if (!emergency) return "";
    const parts: string[] = [];
    parts.push(
      emergency.victimType === "other" ? t("victimHelpingOther") : t("caller"),
    );
    if (baseLoc?.address) parts.push(baseLoc.address);
    else if (baseLoc?.latitude) {
      parts.push(`${baseLoc.latitude.toFixed(5)}, ${baseLoc.longitude.toFixed(5)}`);
    }
    if (distanceLabel) {
      parts.push(`${t("distanceToScene")}: ${distanceLabel}`);
    }
    return parts.join(" · ");
  }, [emergency, baseLoc, distanceLabel, t]);

  const primaryMission = useMemo((): 
    | { label: string; onPress: () => void }
    | { blocked: string }
    | null => {
    if (!emergency || emergency.sessionStatus !== "active") return null;
    if (!emergency.assignedAmbulanceId) {
      return { label: t("acceptCase"), onPress: onAcceptPress };
    }
    if (!isAssignedToMe) return { blocked: t("caseAssignedToAnotherAmbulance") };
    if (lifecycle === "dispatched") {
      return { label: t("missionStepNavigate"), onPress: openNavigation };
    }
    if (lifecycle === "enRoute") {
      return { label: t("markArrived"), onPress: advanceOneStep };
    }
    if (lifecycle === "arrived") {
      return { label: t("completeMission"), onPress: advanceOneStep };
    }
    return null;
  }, [
    emergency,
    isAssignedToMe,
    lifecycle,
    t,
    onAcceptPress,
    openNavigation,
    advanceOneStep,
  ]);

  const chipVariant =
    lifecycle === "arrived" || lifecycle === "completed"
      ? "success"
      : lifecycle === "enRoute"
        ? "info"
        : lifecycle === "cancelled"
          ? "danger"
          : "warning";

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

  const baseLocResolved = emergency.patientLocation ?? emergency.location;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("emergencyDetails")}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/ambulance/dashboard");
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SimpleStatusBlock
          title={phaseLabel}
          subtitle={statusSubtitle}
          chip={{
            label: t("activityEmergencyRef", "Case {id}").replace(
              "{id}",
              caseIdSuffix(emergency.id),
            ),
            variant: chipVariant,
          }}
        />

        {lifecycle !== "arrived" &&
        typeof emergency.currentSnapshot?.eta === "number" &&
        Number.isFinite(emergency.currentSnapshot.eta) ? (
          <ETAHighlight
            label={t("etaLabel")}
            value={String(emergency.currentSnapshot.eta)}
            unit={t("etaMinutesUnit")}
            style={styles.etaBlock}
          />
        ) : null}

        <MapPanel style={styles.mapPanel}>
          <MapView
            ref={mapRef}
            style={styles.mapFill}
            initialRegion={{
              latitude: baseLocResolved.latitude,
              longitude: baseLocResolved.longitude,
              latitudeDelta: 0.014,
              longitudeDelta: 0.014,
            }}
            scrollEnabled
            zoomEnabled
            showsUserLocation={false}
          >
            <Marker
              coordinate={{
                latitude: baseLocResolved.latitude,
                longitude: baseLocResolved.longitude,
              }}
              title={t("mapLegendPatient")}
              pinColor={tokens.color.danger}
            />
            {ambulanceLocation ? (
              <Marker
                coordinate={{
                  latitude: ambulanceLocation.latitude,
                  longitude: ambulanceLocation.longitude,
                }}
                title={t("mapLegendAmbulance")}
                pinColor={tokens.color.primary}
              />
            ) : null}
          </MapView>
        </MapPanel>

        {emergency.sessionStatus === "active" ? (
          primaryMission && "blocked" in primaryMission ? (
            <Text style={styles.blockedText}>{primaryMission.blocked}</Text>
          ) : primaryMission && "onPress" in primaryMission ? (
            <View style={styles.primaryWrap}>
              <PrimaryButton
                fullWidth
                size="lg"
                label={primaryMission.label}
                onPress={primaryMission.onPress}
              />
            </View>
          ) : (
            <Text style={styles.hintText}>{t("noFurtherStatusUpdates")}</Text>
          )
        ) : (
          <Text style={styles.hintText}>{t("caseNoLongerActiveShort")}</Text>
        )}

        <CollapsibleSection title={t("sectionCommunication")} subtitle={t("chatTitle")}>
          {params.emergencyId && user?.uid ? (
            <EmergencyChat
              emergencyId={params.emergencyId}
              currentUserId={user.uid}
              currentUserRole="ambulance"
              isActive={emergency.sessionStatus === "active"}
            />
          ) : null}
        </CollapsibleSection>

        {emergency.victimType !== "other" && userInfo ? (
          <CollapsibleSection title={t("sectionPatientDetails")} subtitle={t("patientInformation")}>
            <InfoRow label={t("name")} value={userInfo.name || userInfo.email || t("notProvided")} />
            {userInfo.phoneNumber ? (
              <InfoRow label={t("phoneNumber")} value={userInfo.phoneNumber} />
            ) : null}
            {userInfo.bloodType ? (
              <InfoRow label={t("blood_type")} value={userInfo.bloodType} strong />
            ) : null}
          </CollapsibleSection>
        ) : emergency.victimType === "other" ? (
          <Card tone="subtle" style={styles.privacyCard}>
            <Text style={styles.privacyTitle}>{t("privacyModeTitle")}</Text>
            <Text style={styles.privacyText}>{t("privacyModeNoProfile")}</Text>
          </Card>
        ) : null}

        <CollapsibleSection title={t("sectionTimeline")} subtitle={t("sectionResponderUpdates")}>
          {timelineSorted.length === 0 ? (
            <Text style={styles.muted}>{t("noTimelineYet")}</Text>
          ) : (
            timelineSorted.slice(0, 20).map((item, idx) => (
              <View key={idx} style={styles.timelineEntry}>
                <Text style={styles.timelineTime}>
                  {item.timestamp ? new Date(item.timestamp).toLocaleString() : "—"}
                </Text>
                {item.text ? <Text style={styles.timelineNote}>{item.text}</Text> : null}
              </View>
            ))
          )}
        </CollapsibleSection>

        {assessmentMode ? (
          <CollapsibleSection title={t("sectionClinicalTools")} defaultExpanded>
            <Text style={styles.snapHeading}>{t("conditionLabel")}</Text>
            <View style={[styles.conditionRow, row]}>
              {(["stable", "moderate", "critical"] as const).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.conditionChip, snapCondition === c && styles.conditionChipOn]}
                  onPress={() => setSnapCondition(c)}
                >
                  <Text
                    style={[
                      styles.conditionChipText,
                      snapCondition === c && styles.conditionChipTextOn,
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.snapInput}
              value={snapSymptoms}
              onChangeText={setSnapSymptoms}
              placeholder={t("symptomsLabel")}
              placeholderTextColor={tokens.color.textFaint}
              multiline
            />
            <View style={[styles.vitalsRow, row]}>
              <TextInput
                style={[styles.snapInput, styles.vitalsField]}
                value={snapHr}
                onChangeText={setSnapHr}
                placeholder="HR"
                keyboardType="numeric"
                placeholderTextColor={tokens.color.textFaint}
              />
              <TextInput
                style={[styles.snapInput, styles.vitalsField]}
                value={snapO2}
                onChangeText={setSnapO2}
                placeholder="SpO2"
                keyboardType="numeric"
                placeholderTextColor={tokens.color.textFaint}
              />
            </View>
            <TextInput
              style={styles.snapInput}
              value={snapBp}
              onChangeText={setSnapBp}
              placeholder="BP"
              placeholderTextColor={tokens.color.textFaint}
            />
            <Button
              variant="primary"
              fullWidth
              label={snapSaving ? t("saving") : t("saveAssessment")}
              loading={snapSaving}
              onPress={saveClinicalSnapshot}
            />
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection title={t("sectionQuickActions")} subtitle={t("gpsPublishHint")}>
          {emergency.sessionStatus === "active" && isAssignedToMe ? (
            <>
              {lifecycle === "dispatched" ? (
                <Button
                  variant="secondary"
                  fullWidth
                  label={t("activityEvent_enRoute")}
                  onPress={advanceOneStep}
                />
              ) : null}
              <Button
                variant="secondary"
                fullWidth
                label={
                  ambulanceGps.isBootstrapping
                    ? t("loading")
                    : trackingThisMission
                      ? t("stopGps")
                      : t("startGps")
                }
                disabled={ambulanceGps.isBootstrapping}
                onPress={() => (trackingThisMission ? stopTracking() : void startTracking())}
              />
              {transportOnly && lifecycle === "dispatched" ? (
                <Button
                  variant="ghost"
                  fullWidth
                  label={t("releaseAssignment")}
                  onPress={releaseAssignment}
                />
              ) : null}
            </>
          ) : (
            <Text style={styles.muted}>{t("readOnlyCaseClosed")}</Text>
          )}
        </CollapsibleSection>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.bgPage },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: tokens.space.xl },
  loadingText: { color: tokens.color.textMuted, fontWeight: tokens.fontWeight.semibold },
  errorText: { color: tokens.color.danger, fontWeight: tokens.fontWeight.bold },
  scrollContent: {
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.xxl,
    gap: tokens.space.xs,
  },
  etaBlock: { marginBottom: tokens.space.xl },
  mapPanel: { marginBottom: tokens.space.xl },
  mapFill: { width: "100%", height: "100%" },
  primaryWrap: { marginBottom: tokens.space.xl },
  blockedText: { color: tokens.color.danger, fontWeight: tokens.fontWeight.semibold, marginBottom: tokens.space.md, textAlign: "center" },
  hintText: { color: tokens.color.textMuted, marginBottom: tokens.space.md, textAlign: "center" },
  privacyCard: { marginBottom: tokens.space.md },
  privacyTitle: { fontSize: tokens.font.label, fontWeight: tokens.fontWeight.bold, color: tokens.color.textPrimary, marginBottom: tokens.space.xs },
  privacyText: { fontSize: tokens.font.body, color: tokens.color.textMuted },
  timelineEntry: { marginBottom: tokens.space.sm, gap: tokens.space.xs },
  timelineTime: { fontSize: tokens.font.caption, color: tokens.color.textMuted },
  timelineNote: { fontSize: tokens.font.body, color: tokens.color.textPrimary },
  muted: { fontSize: tokens.font.body, color: tokens.color.textMuted },
  snapHeading: { fontSize: tokens.font.caption, fontWeight: tokens.fontWeight.bold, color: tokens.color.textSecondary, marginBottom: tokens.space.xs, marginTop: tokens.space.sm },
  conditionRow: { gap: tokens.space.sm, marginBottom: tokens.space.sm },
  conditionChip: { flex: 1, paddingVertical: tokens.space.sm, borderRadius: tokens.radius.sm, borderWidth: tokens.hairline, borderColor: tokens.color.border, alignItems: "center", backgroundColor: tokens.color.bgSurface },
  conditionChipOn: { backgroundColor: tokens.color.primary, borderColor: tokens.color.primary },
  conditionChipText: { fontSize: tokens.font.caption, fontWeight: tokens.fontWeight.bold, color: tokens.color.textPrimary, textTransform: "capitalize" },
  conditionChipTextOn: { color: tokens.color.textOnPrimary },
  snapInput: { borderWidth: tokens.hairline, borderColor: tokens.color.border, borderRadius: tokens.radius.sm, padding: tokens.space.md, marginBottom: tokens.space.sm, color: tokens.color.textPrimary, backgroundColor: tokens.color.bgSurface },
  vitalsRow: { gap: tokens.space.sm },
  vitalsField: { flex: 1 },
});