import * as Location from "expo-location";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import EmergencyChat from "../../components/EmergencyChat";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import SectionHeader from "../../components/ui/SectionHeader";
import ShortcutCard from "../../components/ui/ShortcutCard";
import StatusChip from "../../components/ui/StatusChip";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";
import { normalizeLifecycleStatus } from "../../src/emergency/stateMachine";
import {
  autoDispatchEmergency,
  rejectAndReassignEmergency,
} from "../../src/services/autoDispatch";
import { tokens } from "../../src/ui/tokens";
import { openMapsNavigation } from "../../src/utils/openMapsNavigation";

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
    latitude?: number;
    longitude?: number;
    address?: string | null;
  } | null;
  timestamp: string;
  status: string;
  assignedAmbulanceId?: string | null;
  assignedAt?: string | null;
  victimType?: "me" | "other";
  userInfo?: any;
  distance?: number;
  timeAgo?: string;
}

export default function AmbulanceDashboard() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, role, approved, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loadingEmergencies, setLoadingEmergencies] = useState(true);
  const [emergenciesError, setEmergenciesError] = useState<string | null>(null);
  const [ambulanceLocation, setAmbulanceLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const attemptedAutoDispatchRef = useRef<Record<string, true>>({});
  const attemptedTimeoutReassignRef = useRef<Record<string, true>>({});
  const DISPATCH_TIMEOUT_MS = 45000;

  // "Live alert" UI state (local only)
  const [lastSeenEmergencyTs, setLastSeenEmergencyTs] = useState<string | null>(
    null,
  );
  const [newEmergencyIds, setNewEmergencyIds] = useState<Record<string, true>>(
    {},
  );
  const [bannerEmergencyId, setBannerEmergencyId] = useState<string | null>(
    null,
  );
  const [bannerVisible, setBannerVisible] = useState(false);
  const [liveCallsScrollY, setLiveCallsScrollY] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  const SEEN_KEY = "ambulance_last_seen_emergency_ts";

  // Restore last-seen timestamp to decide what is "NEW"
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(SEEN_KEY);
        setLastSeenEmergencyTs(stored || null);
      } catch {
        setLastSeenEmergencyTs(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveLastSeenTs = async (ts: string) => {
    setLastSeenEmergencyTs(ts);
    await SecureStore.setItemAsync(SEEN_KEY, ts).catch(() => {});
  };

  const markEmergencySeen = async (emergencyId: string) => {
    setNewEmergencyIds((prev) => {
      const next = { ...prev };
      delete next[emergencyId];
      return next;
    });
    if (bannerEmergencyId === emergencyId) {
      setBannerVisible(false);
      setBannerEmergencyId(null);
    }
    const found = emergencies.find((e) => e.id === emergencyId);
    if (found?.timestamp) await saveLastSeenTs(found.timestamp);
  };

  // Pulse animation for banner/new emergencies
  useEffect(() => {
    if (!bannerVisible) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [bannerVisible, pulse]);

  // Access control (keep behavior consistent with doctor/admin)
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

  // Get ambulance location
  useEffect(() => {
    const getAmbulanceLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setAmbulanceLocation(coords);

          if (user?.uid) {
            updateDoc(doc(db, "users", user.uid), {
              lastKnownLocation: coords,
              lastKnownLocationUpdatedAt: new Date().toISOString(),
            }).catch((e) => {
              console.warn(
                "[AmbulanceDashboard] failed to update lastKnownLocation:",
                e,
              );
            });
          }
        }
      } catch (error) {
        console.error("Error getting ambulance location:", error);
      }
    };
    getAmbulanceLocation();
  }, [user?.uid]);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371; // Radius of the Earth in km
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

  // Format time ago
  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diffInSeconds < 60)
      return t("timeAgoSec").replace("{count}", String(diffInSeconds));
    if (diffInSeconds < 3600)
      return t("timeAgoMin").replace(
        "{count}",
        String(Math.floor(diffInSeconds / 60)),
      );
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return (hours === 1 ? t("timeAgoHour") : t("timeAgoHours")).replace(
        "{count}",
        String(hours),
      );
    }
    const days = Math.floor(diffInSeconds / 86400);
    return (days === 1 ? t("timeAgoDay") : t("timeAgoDays")).replace(
      "{count}",
      String(days),
    );
  };

  // Fetch user info for emergency
  const fetchUserInfo = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        return { id: userId, ...userDoc.data() };
      }
      return null;
    } catch (error) {
      console.error("Error fetching user info:", error);
      return null;
    }
  };

  // Listen to active emergencies
  useEffect(() => {
    if (authLoading) return;
    if (!user?.uid) return;
    if (role !== "ambulance" || approved !== true) return;
    if (!ambulanceLocation) return;

    setLoadingEmergencies(true);
    setEmergenciesError(null);
    const emergenciesRef = collection(db, "emergencies");
    const q = query(emergenciesRef, where("sessionStatus", "==", "active"));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        try {
          console.log(
            "[AmbulanceDashboard] active emergencies snapshot:",
            snapshot.size,
          );
          console.log(
            "[AmbulanceDashboard] emergencies snapshot:",
            snapshot.size,
          );
          if (snapshot.size > 0) {
            console.log(
              "[AmbulanceDashboard] first emergency id:",
              snapshot.docs[0]?.id,
            );
          }
          const emergenciesList: Emergency[] = [];
          const incomingNewIds: Record<string, true> = {};
          let newestIncoming: { id: string; timestamp: string } | null = null;

          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const sessionStatus =
              typeof data.sessionStatus === "string"
                ? data.sessionStatus
                : "active";
            if (sessionStatus !== "active") continue;

            const ts =
              typeof data.timestamp === "string" ? data.timestamp : null;
            const isNew =
              !!ts &&
              (!!lastSeenEmergencyTs ? ts > lastSeenEmergencyTs : false);
            if (isNew) {
              incomingNewIds[docSnap.id] = true;
              if (!newestIncoming || ts! > newestIncoming.timestamp) {
                newestIncoming = { id: docSnap.id, timestamp: ts! };
              }
            }

            const emergency: Emergency = {
              id: docSnap.id,
              userId: data.userId,
              location: data.location,
              patientLocation: data.patientLocation ?? null,
              timestamp: data.timestamp,
              status: data.status,
              assignedAmbulanceId: data.assignedAmbulanceId ?? null,
              assignedAt:
                typeof data.assignedAt === "string" ? data.assignedAt : null,
              victimType: data.victimType === "other" ? "other" : "me",
            };

            if (emergency.victimType !== "other") {
              const userInfo = await fetchUserInfo(data.userId);
              if (userInfo) {
                emergency.userInfo = userInfo;
              }
            }

            if (ambulanceLocation && emergency.location) {
              emergency.distance = calculateDistance(
                ambulanceLocation.latitude,
                ambulanceLocation.longitude,
                emergency.location.latitude,
                emergency.location.longitude,
              );
            }

            emergency.timeAgo = formatTimeAgo(emergency.timestamp);

            emergenciesList.push(emergency);
          }

          emergenciesList.sort((a, b) => {
            if (a.distance && b.distance) {
              return a.distance - b.distance;
            }
            return (
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });

          setEmergencies(emergenciesList);

          // AUTO DISPATCH
          for (const e of emergenciesList) {
            if (e.assignedAmbulanceId) continue;
            if (attemptedAutoDispatchRef.current[e.id]) continue;

            const baseLoc: any = e.patientLocation ?? e.location;
            const lat = baseLoc?.latitude;
            const lng = baseLoc?.longitude;
            if (typeof lat !== "number" || typeof lng !== "number") continue;

            attemptedAutoDispatchRef.current[e.id] = true;
            autoDispatchEmergency({
              emergencyId: e.id,
              patientLocation: { latitude: lat, longitude: lng },
            })
              .then((res) => {
                if (res.ok && res.assigned) {
                  console.log(
                    "[AutoDispatch] assigned",
                    e.id,
                    "->",
                    res.assignedAmbulanceId,
                  );
                } else if (res.ok) {
                  console.log(
                    "[AutoDispatch] skipped",
                    e.id,
                    "reason=",
                    (res as any).reason,
                  );
                } else {
                  console.warn(
                    "[AutoDispatch] failed",
                    e.id,
                    "reason=",
                    (res as any).reason,
                  );
                }
              })
              .catch((err) => console.warn("[AutoDispatch] error", e.id, err));
          }

          if (Object.keys(incomingNewIds).length > 0) {
            setNewEmergencyIds((prev) => ({ ...prev, ...incomingNewIds }));
          }

          if (newestIncoming) {
            setBannerEmergencyId(newestIncoming.id);
            setBannerVisible(true);
            console.log(
              "[AmbulanceDashboard] NEW emergency alert:",
              newestIncoming.id,
            );
            if (liveCallsScrollY !== null && scrollRef.current?.scrollTo) {
              scrollRef.current.scrollTo({
                y: Math.max(0, liveCallsScrollY - 12),
                animated: true,
              });
            }
          }

          setLoadingEmergencies(false);
        } catch (error) {
          console.error("Error processing emergencies snapshot:", error);
          setEmergenciesError(
            t("failedToLoadEmergencies") || "Failed to load emergencies.",
          );
          setLoadingEmergencies(false);
        }
      },
      (error) => {
        console.error("Error listening to emergencies:", error);
        console.error(
          "Ambulance emergencies listener error code:",
          (error as any)?.code,
        );
        setEmergenciesError(
          (error as any)?.code === "permission-denied" ||
            (error as any)?.code === "PERMISSION_DENIED"
            ? "PERMISSION_DENIED: responder not approved or rules not deployed."
            : t("failedToLoadEmergencies") || "Failed to load emergencies.",
        );
        setLoadingEmergencies(false);
      },
    );

    return () => unsubscribe();
  }, [
    ambulanceLocation,
    authLoading,
    user?.uid,
    role,
    approved,
    t,
    lastSeenEmergencyTs,
    liveCallsScrollY,
  ]);

  // SMART REASSIGNMENT: timeout-based reassignment loop
  useEffect(() => {
    if (authLoading) return;
    if (!user?.uid) return;
    if (role !== "ambulance" || approved !== true) return;

    const timer = setInterval(() => {
      const now = Date.now();
      for (const e of emergencies) {
        if (normalizeLifecycleStatus(e.status) !== "dispatched") continue;
        if (!e.assignedAmbulanceId) continue;
        if (!e.assignedAt) continue;
        if (attemptedTimeoutReassignRef.current[e.id]) continue;

        const assignedAtMs = new Date(e.assignedAt).getTime();
        if (!Number.isFinite(assignedAtMs)) continue;
        if (now - assignedAtMs < DISPATCH_TIMEOUT_MS) continue;

        const baseLoc: any = e.patientLocation ?? e.location;
        const lat = baseLoc?.latitude;
        const lng = baseLoc?.longitude;
        if (typeof lat !== "number" || typeof lng !== "number") continue;

        attemptedTimeoutReassignRef.current[e.id] = true;
        console.log(
          "[AutoDispatch][timeout] reassigning emergency:",
          e.id,
          "assigned=",
          e.assignedAmbulanceId,
        );
        rejectAndReassignEmergency({
          emergencyId: e.id,
          rejectingAmbulanceId: e.assignedAmbulanceId,
          patientLocation: { latitude: lat, longitude: lng },
        })
          .then((res) =>
            console.log("[AutoDispatch][timeout] result:", e.id, res),
          )
          .catch((err) =>
            console.warn("[AutoDispatch][timeout] error:", e.id, err),
          )
          .finally(() => {
            setTimeout(() => {
              delete attemptedTimeoutReassignRef.current[e.id];
            }, 15000);
          });
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [authLoading, user?.uid, role, approved, emergencies]);

  /**
   * Open turn-by-turn navigation to the emergency location.
   *
   * Delegates to the shared `openMapsNavigation` utility which enforces the
   * codebase-wide invariants: `maps://` is gated behind both an iOS check
   * and `canOpenURL`, `google.navigation:` is never used, and the Google
   * Maps HTTPS URL is the universal fallback (always safe to open).
   */
  const openNavigation = async (emergency: Emergency) => {
    const result = await openMapsNavigation({
      latitude: emergency?.location?.latitude,
      longitude: emergency?.location?.longitude,
    });
    if (result.ok) return;
    Alert.alert(
      t("error"),
      result.reason === "invalid_coords"
        ? t("locationNotAvailable")
        : t("failedToOpenNavigation"),
    );
  };

  const handleSearchPatient = async () => {
    if (!searchQuery.trim()) {
      Alert.alert(
        t("error"),
        t("enterPatientId") || "Please enter Israeli ID or name",
      );
      return;
    }

    setSearching(true);
    try {
      const queryLower = searchQuery.trim().toLowerCase();
      const queryDigits = searchQuery.trim().replace(/\D/g, "");

      const usersSnapshot = await getDocs(collection(db, "users"));

      const foundDoc = usersSnapshot.docs.find((docSnap) => {
        const data = docSnap.data();
        return (
          data.israeliId === queryDigits ||
          data.name?.toLowerCase().includes(queryLower) ||
          data.email?.toLowerCase().includes(queryLower)
        );
      });

      if (foundDoc) {
        const foundPatient = { id: foundDoc.id, ...foundDoc.data() };
        setPatientData(foundPatient);
      } else {
        Alert.alert(t("error"), t("patientNotFound") || "Patient not found");
        setPatientData(null);
      }
    } catch (error) {
      console.error("Error searching patient:", error);
      Alert.alert(t("error"), t("failedToSearchPatient"));
    } finally {
      setSearching(false);
    }
  };

  // ----- Derived data for rendering -----

  const myMission = emergencies.find(
    (e) => e.assignedAmbulanceId === user?.uid,
  );
  const otherCalls = emergencies.filter(
    (e) => e.assignedAmbulanceId !== user?.uid,
  );

  // ----- Quick Actions handlers (UI only) ---------------------------------
  // Each handler reuses an already-wired feature (router push, scrollTo, or
  // the existing openNavigation helper). No new backend logic.
  const handleQuickCurrentMission = () => {
    if (!myMission) {
      Alert.alert(
        t("quickActions"),
        t("quickNoActiveMission", "No active mission"),
      );
      return;
    }
    router.push({
      pathname: "/ambulance/emergency-detail",
      params: { emergencyId: myMission.id },
    });
  };

  const handleQuickNearbyEmergencies = () => {
    // Prefer scrolling to the in-screen "Live calls" section because that
    // list is already live-updating via the Firestore listener. The
    // dedicated nearby-emergencies route stays available as the secondary
    // entry point (still reachable from anywhere else in the app).
    if (liveCallsScrollY !== null && scrollRef.current?.scrollTo) {
      scrollRef.current.scrollTo({
        y: Math.max(0, liveCallsScrollY - 12),
        animated: true,
      });
      return;
    }
    router.push("/ambulance/nearby-emergencies");
  };

  const handleQuickStartNavigation = () => {
    if (!myMission) {
      Alert.alert(
        t("quickActions"),
        t("quickNoDestination", "No destination available"),
      );
      return;
    }
    openNavigation(myMission);
  };

  const formatDistance = (km?: number) => {
    if (km == null || !Number.isFinite(km)) return null;
    return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(1)} km`;
  };

  // Compact card used both for "your mission" and "other calls".
  const renderCallCard = (emergency: Emergency, mine: boolean) => {
    const isNew = !!newEmergencyIds[emergency.id];
    const distLabel = formatDistance(emergency.distance);
    return (
      <TouchableOpacity
        key={emergency.id}
        onPress={async () => {
          await markEmergencySeen(emergency.id);
          router.push({
            pathname: "/ambulance/emergency-detail",
            params: { emergencyId: emergency.id },
          });
        }}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Card
          elevated
          tone={mine ? "danger" : "default"}
          accentLeft={isNew && !mine}
        >
          <View style={styles.callTopRow}>
            <View style={styles.chipRow}>
              <StatusChip
                label={
                  mine
                    ? t("activeEmergencyShort", "YOUR MISSION")
                    : t("emergency", "EMERGENCY")
                }
                variant="danger"
                solid
              />
              {isNew ? (
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.06],
                        }),
                      },
                    ],
                  }}
                >
                  <StatusChip label="NEW" variant="warning" solid />
                </Animated.View>
              ) : null}
            </View>
            <Text style={styles.callTime} numberOfLines={1}>
              {emergency.timeAgo || t("justNow")}
            </Text>
          </View>

          <Text style={styles.callType} numberOfLines={1}>
            {emergency.victimType === "other"
              ? t("someoneElse")
              : emergency.userInfo?.name ||
                emergency.userInfo?.email ||
                t("unknownUser")}
          </Text>

          <View style={styles.callLocRow}>
            <Text style={styles.callLocText} numberOfLines={1}>
              📍{" "}
              {emergency.location.address ||
                `${emergency.location.latitude.toFixed(4)}, ${emergency.location.longitude.toFixed(4)}`}
            </Text>
            {distLabel ? (
              <StatusChip label={distLabel} variant="info" />
            ) : null}
          </View>

          {emergency.victimType !== "other" && emergency.userInfo ? (
            <View style={styles.quickInfo}>
              {emergency.userInfo.bloodType ? (
                <StatusChip
                  label={`🩸 ${emergency.userInfo.bloodType}`}
                  variant="neutral"
                />
              ) : null}
              {emergency.userInfo.age ? (
                <StatusChip
                  label={`👤 ${emergency.userInfo.age}`}
                  variant="neutral"
                />
              ) : null}
            </View>
          ) : null}

          <View style={styles.callActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                openNavigation(emergency);
              }}
              style={styles.navBtn}
              accessibilityRole="button"
              accessibilityLabel={t("openNavigation")}
            >
              <Text style={styles.navBtnText}>
                🧭 {t("openNavigation") || "Navigate"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.openHint}>
              {t("tapToOpenCaseMonitor") || "Tap to open"}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Live banner alert (local-only) */}
      {bannerVisible && bannerEmergencyId && (
        <Animated.View
          style={[
            styles.liveBanner,
            {
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.02],
                  }),
                },
              ],
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1],
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.9}
            onPress={async () => {
              await markEmergencySeen(bannerEmergencyId);
              router.push({
                pathname: "/ambulance/emergency-detail",
                params: { emergencyId: bannerEmergencyId },
              });
            }}
            accessibilityRole="button"
          >
            <Text style={styles.liveBannerTitle}>
              🚨 New Emergency Received
            </Text>
            <Text style={styles.liveBannerSub}>Tap to open</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setBannerVisible(false);
              setBannerEmergencyId(null);
            }}
            style={styles.liveBannerDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.liveBannerDismissText}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <ScreenHeader
        title={t("ambulance_dashboard_title")}
        eyebrow={`🚑 ${t("ambulance_role")}`}
      />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
        {/* CURRENT MISSION — only when this ambulance is assigned.
            Visually dominant: red border + ACTIVE chip. */}
        {myMission ? (
          <View style={styles.section}>
            <SectionHeader
              overline={t("active") || "Mission"}
              title={t("activeEmergency") || "Your current mission"}
              accent={tokens.color.danger}
            />
            {renderCallCard(myMission, true)}
          </View>
        ) : null}

        {/* Nearby / live emergencies */}
        <View
          style={styles.section}
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            setLiveCallsScrollY(y);
          }}
        >
          <SectionHeader
            overline={t("live_calls") || "Active"}
            title={t("live_calls") || "Live Emergency Calls"}
            accent={
              otherCalls.length > 0 ? tokens.color.danger : undefined
            }
            trailing={
              otherCalls.length > 0 ? (
                <StatusChip
                  label={String(otherCalls.length)}
                  variant="danger"
                  solid
                />
              ) : null
            }
          />

          {loadingEmergencies ? (
            <EmptyState
              loading
              title={t("loading") || "Loading emergencies..."}
            />
          ) : emergenciesError ? (
            <EmptyState icon="⚠️" title={emergenciesError} />
          ) : otherCalls.length === 0 ? (
            <EmptyState icon="🚑" title={t("noActiveEmergencies")} />
          ) : (
            <View style={styles.cardStack}>
              {otherCalls.map((emergency) => renderCallCard(emergency, false))}
            </View>
          )}
        </View>

        {/* Dispatcher chat — shown only for the assigned mission. */}
        {myMission && user?.uid ? (
          <Card style={styles.section}>
            <SectionHeader
              overline={t("chatTitle") || "Dispatcher"}
              title={t("chatTitle") || "Dispatcher Chat"}
            />
            <EmergencyChat
              emergencyId={myMission.id}
              currentUserId={user.uid}
              currentUserRole="ambulance"
              isActive
            />
          </Card>
        ) : null}

        {/* Patient Search */}
        <Card style={styles.section}>
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

          {/* Patient Info Display */}
          {patientData && (
            <Card tone="danger" style={styles.patientInfoCard}>
              <View style={styles.patientHeader}>
                <Text style={styles.patientName} numberOfLines={1}>
                  {patientData.name || patientData.email}
                </Text>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setPatientData(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.iconBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {patientData.israeliId && (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{t("israeliId")}</Text>
                  <Text style={styles.kvValue}>{patientData.israeliId}</Text>
                </View>
              )}
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>{t("phoneNumber")}</Text>
                <Text style={styles.kvValue}>
                  {patientData.phoneNumber || "—"}
                </Text>
              </View>
              {patientData.bloodType && (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{t("blood_type")}</Text>
                  <Text style={styles.kvValue}>{patientData.bloodType}</Text>
                </View>
              )}
              {patientData.age && (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>{t("age")}</Text>
                  <Text style={styles.kvValue}>{patientData.age}</Text>
                </View>
              )}

              {patientData.diseases && (
                <View style={styles.patientSubSection}>
                  <Text style={styles.patientSubTitle}>{t("diseases")}</Text>
                  <Text style={styles.patientSubText}>
                    {patientData.diseases}
                  </Text>
                </View>
              )}
              {patientData.medications && (
                <View style={styles.patientSubSection}>
                  <Text style={styles.patientSubTitle}>
                    {t("medications")}
                  </Text>
                  <Text style={styles.patientSubText}>
                    {patientData.medications}
                  </Text>
                </View>
              )}
              {patientData.allergies && (
                <View style={styles.patientSubSection}>
                  <Text style={styles.patientSubTitle}>{t("allergies")}</Text>
                  <Text style={styles.patientSubText}>
                    {patientData.allergies}
                  </Text>
                </View>
              )}
              {patientData.emergencyContacts &&
                patientData.emergencyContacts.length > 0 && (
                  <View style={styles.patientSubSection}>
                    <Text style={styles.patientSubTitle}>
                      {t("emergency_contact")}
                    </Text>
                    {patientData.emergencyContacts.map(
                      (contact: any, index: number) => (
                        <Text key={index} style={styles.patientSubText}>
                          {contact.name}: {contact.phone}
                        </Text>
                      ),
                    )}
                  </View>
                )}

              <TouchableOpacity
                style={styles.viewFullBtn}
                onPress={() =>
                  router.push(`/doctor/patient/${patientData.id}`)
                }
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
          Quick Actions — operational shortcuts wired to existing features.
          Order matches what a responder needs in the field: jump to the
          active mission, scan nearby calls, then start external navigation.
        */}
        <View style={styles.section}>
          <SectionHeader
            overline={t("quickActions")}
            title={t("quickActions")}
          />

          <ShortcutCard
            icon="🚑"
            title={t("quickCurrentMission", "Current Mission")}
            subtitle={
              myMission
                ? t("quickCurrentMissionSub", "Open your assigned emergency")
                : t("quickNoActiveMission", "No active mission")
            }
            onPress={handleQuickCurrentMission}
            emphasis={myMission ? "primary" : "default"}
            trailing={
              myMission ? (
                <StatusChip label="ACTIVE" variant="danger" solid />
              ) : undefined
            }
          />
          <ShortcutCard
            icon="🗺️"
            title={t("nearby_emergencies")}
            subtitle={t("nearby_emergencies_desc")}
            onPress={handleQuickNearbyEmergencies}
          />
          <ShortcutCard
            icon="🧭"
            title={t("quickStartNavigation", "Start Navigation")}
            subtitle={
              myMission
                ? t("quickStartNavigationSub", "Navigate to the patient")
                : t("quickNoDestination", "No destination available")
            }
            onPress={handleQuickStartNavigation}
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
  liveBanner: {
    position: "absolute",
    top: 56,
    left: tokens.space.xl,
    right: tokens.space.xl,
    zIndex: 50,
    backgroundColor: tokens.color.danger,
    borderRadius: tokens.radius.lg,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.md + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  liveBannerTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: tokens.font.bodyLg,
    letterSpacing: 0.5,
  },
  liveBannerSub: {
    marginTop: 2,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
    fontSize: tokens.font.caption,
  },
  liveBannerDismiss: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  liveBannerDismissText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  scrollContent: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.xl,
    paddingBottom: tokens.space.xxl + tokens.space.sm,
  },
  section: { marginBottom: tokens.space.xl },
  cardStack: { gap: tokens.space.md },
  helperText: {
    fontSize: tokens.font.body,
    color: tokens.color.textMuted,
    marginBottom: tokens.space.md,
    lineHeight: 18,
  },
  callTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.space.sm,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.xs + 2,
  },
  callTime: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    fontWeight: "700",
  },
  callType: {
    fontSize: tokens.font.title,
    fontWeight: "800",
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.sm,
  },
  callLocRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space.sm,
    marginBottom: tokens.space.sm,
  },
  callLocText: {
    flex: 1,
    fontSize: tokens.font.body,
    color: tokens.color.textSecondary,
    fontWeight: "600",
  },
  quickInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: tokens.space.xs,
    marginBottom: tokens.space.xs,
    gap: tokens.space.xs + 2,
  },
  callActions: {
    marginTop: tokens.space.md,
    paddingTop: tokens.space.md,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space.sm,
  },
  navBtn: {
    backgroundColor: tokens.color.primarySolid,
    paddingHorizontal: tokens.space.md + 2,
    paddingVertical: tokens.space.sm + 2,
    borderRadius: tokens.radius.sm,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: tokens.font.body },
  openHint: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    fontWeight: "700",
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
    paddingHorizontal: tokens.space.md + 2,
    paddingVertical: tokens.space.md,
    fontSize: tokens.font.label,
    borderWidth: 1.5,
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
  patientInfoCard: {
    marginTop: tokens.space.md,
  },
  patientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.space.md + 2,
    paddingBottom: tokens.space.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
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
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.bgPage,
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
    marginTop: tokens.space.md + 2,
    paddingTop: tokens.space.md + 2,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  patientSubTitle: {
    fontSize: tokens.font.body,
    fontWeight: "900",
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.xs + 2,
    letterSpacing: 0.3,
  },
  patientSubText: {
    fontSize: tokens.font.bodyLg,
    color: "#212529",
    lineHeight: 20,
  },
  viewFullBtn: {
    marginTop: tokens.space.lg,
    paddingVertical: tokens.space.md,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    paddingTop: tokens.space.md + 2,
    minHeight: tokens.hitSlop,
  },
  viewFullBtnText: {
    fontSize: tokens.font.label,
    color: tokens.color.danger,
    fontWeight: "800",
  },
});
