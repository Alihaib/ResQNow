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
import SectionHeader from "../../components/ui/SectionHeader";
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
        style={[
          styles.callCard,
          isNew && styles.callCardNew,
          mine && styles.callCardMine,
        ]}
        onPress={async () => {
          await markEmergencySeen(emergency.id);
          router.push({
            pathname: "/ambulance/emergency-detail",
            params: { emergencyId: emergency.id },
          });
        }}
        activeOpacity={0.85}
      >
        <View style={styles.callTopRow}>
          <View style={styles.chipRow}>
            <StatusChip
              label={mine ? t("activeEmergencyShort", "YOUR MISSION") : t("emergency", "EMERGENCY")}
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
          >
            <Text style={styles.navBtnText}>
              🧭 {t("openNavigation") || "Navigate"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.openHint}>
            {t("tapToOpenCaseMonitor") || "Tap to open"}
          </Text>
        </View>
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
          >
            <Text style={styles.liveBannerDismissText}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

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
          <Text style={styles.headerEyebrow}>🚑 {t("ambulance_role")}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t("ambulance_dashboard_title")}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
        {/* CURRENT MISSION — only when this ambulance is assigned. */}
        {myMission ? (
          <View style={styles.section}>
            <SectionHeader
              overline={t("active") || "Mission"}
              title={t("activeEmergency") || "Your current mission"}
              accent="#DC2626"
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
            accent={otherCalls.length > 0 ? "#DC2626" : undefined}
            trailing={
              otherCalls.length > 0 ? (
                <StatusChip label={String(otherCalls.length)} variant="danger" solid />
              ) : null
            }
          />

          {loadingEmergencies ? (
            <View style={styles.softCard}>
              <Text style={styles.softMuted}>
                {t("loading") || "Loading emergencies..."}
              </Text>
            </View>
          ) : emergenciesError ? (
            <View style={styles.softCard}>
              <Text style={styles.emptyEmoji}>⚠️</Text>
              <Text style={styles.softMuted}>{emergenciesError}</Text>
            </View>
          ) : otherCalls.length === 0 ? (
            <View style={styles.softCard}>
              <Text style={styles.emptyEmoji}>🚑</Text>
              <Text style={styles.emptyTitle}>{t("noActiveEmergencies")}</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {otherCalls.map((emergency) => renderCallCard(emergency, false))}
            </View>
          )}
        </View>

        {/* Dispatcher chat — shown for the assigned mission. */}
        {myMission && user?.uid ? (
          <View style={[styles.section, styles.sectionCard]}>
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
          </View>
        ) : null}

        {/* Patient Search */}
        <View style={[styles.section, styles.sectionCard]}>
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

          {/* Patient Info Display */}
          {patientData && (
            <View style={styles.patientInfoCard}>
              <View style={styles.patientHeader}>
                <Text style={styles.patientName} numberOfLines={1}>
                  {patientData.name || patientData.email}
                </Text>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setPatientData(null)}
                  accessibilityRole="button"
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
                <Text style={styles.kvValue}>{patientData.phoneNumber || "—"}</Text>
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
                  <Text style={styles.patientSubText}>{patientData.diseases}</Text>
                </View>
              )}
              {patientData.medications && (
                <View style={styles.patientSubSection}>
                  <Text style={styles.patientSubTitle}>{t("medications")}</Text>
                  <Text style={styles.patientSubText}>{patientData.medications}</Text>
                </View>
              )}
              {patientData.allergies && (
                <View style={styles.patientSubSection}>
                  <Text style={styles.patientSubTitle}>{t("allergies")}</Text>
                  <Text style={styles.patientSubText}>{patientData.allergies}</Text>
                </View>
              )}
              {patientData.emergencyContacts &&
                patientData.emergencyContacts.length > 0 && (
                  <View style={styles.patientSubSection}>
                    <Text style={styles.patientSubTitle}>{t("emergency_contact")}</Text>
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
                onPress={() => router.push(`/doctor/patient/${patientData.id}`)}
                accessibilityRole="button"
              >
                <Text style={styles.viewFullBtnText}>
                  {t("viewFullProfile") || "View Full Profile"} ›
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/*
          Quick Actions — operational shortcuts wired to existing features.
          Order matches what a responder needs in the field: jump to the
          active mission, scan nearby calls, then start external navigation.
        */}
        <View style={styles.section}>
          <SectionHeader overline={t("quickActions")} title={t("quickActions")} />

          {/* 1. Open the currently assigned mission detail (or alert). */}
          <TouchableOpacity
            style={[
              styles.shortcutCard,
              myMission && styles.shortcutCardPrimary,
            ]}
            onPress={handleQuickCurrentMission}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.shortcutIcon}>🚑</Text>
            <View style={styles.shortcutContent}>
              <Text style={styles.shortcutTitle}>
                {t("quickCurrentMission", "Current Mission")}
              </Text>
              <Text style={styles.shortcutSub} numberOfLines={1}>
                {myMission
                  ? t(
                      "quickCurrentMissionSub",
                      "Open your assigned emergency",
                    )
                  : t("quickNoActiveMission", "No active mission")}
              </Text>
            </View>
            {myMission ? (
              <StatusChip label="ACTIVE" variant="danger" solid />
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </TouchableOpacity>

          {/* 2. Scroll to the live emergencies list above. */}
          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={handleQuickNearbyEmergencies}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.shortcutIcon}>🗺️</Text>
            <View style={styles.shortcutContent}>
              <Text style={styles.shortcutTitle}>{t("nearby_emergencies")}</Text>
              <Text style={styles.shortcutSub} numberOfLines={1}>
                {t("nearby_emergencies_desc")}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {/* 3. Hand off to the device's external navigation app. */}
          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={handleQuickStartNavigation}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.shortcutIcon}>🧭</Text>
            <View style={styles.shortcutContent}>
              <Text style={styles.shortcutTitle}>
                {t("quickStartNavigation", "Start Navigation")}
              </Text>
              <Text style={styles.shortcutSub} numberOfLines={1}>
                {myMission
                  ? t("quickStartNavigationSub", "Navigate to the patient")
                  : t("quickNoDestination", "No destination available")}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
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
  liveBanner: {
    position: "absolute",
    top: 56,
    left: 20,
    right: 20,
    zIndex: 50,
    backgroundColor: "#DC2626",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  liveBannerTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  liveBannerSub: {
    marginTop: 2,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
    fontSize: 12,
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
  section: { marginBottom: 24 },
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
  callCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  callCardNew: {
    borderLeftWidth: 4,
    borderLeftColor: "#DC2626",
    backgroundColor: "#FFFBFB",
  },
  callCardMine: {
    borderWidth: 2,
    borderColor: "#DC2626",
    backgroundColor: "#FFFFFF",
  },
  callTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  callTime: { fontSize: 12, color: "#64748B", fontWeight: "700" },
  callType: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  callLocRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  callLocText: { flex: 1, fontSize: 13, color: "#475569", fontWeight: "600" },
  quickInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    marginBottom: 4,
    gap: 6,
  },
  callActions: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  navBtn: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  navBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  openHint: { fontSize: 12, color: "#64748B", fontWeight: "700" },
  softCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    gap: 8,
  },
  softMuted: { color: "#64748B", fontWeight: "700", textAlign: "center" },
  emptyEmoji: { fontSize: 28 },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
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
  patientName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    flex: 1,
    marginRight: 8,
  },
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
  patientSubSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  patientSubTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
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
  shortcutCardPrimary: {
    borderColor: "#DC2626",
    borderLeftWidth: 4,
    backgroundColor: "#FFFBFB",
  },
  shortcutIcon: { fontSize: 24 },
  shortcutContent: { flex: 1 },
  shortcutTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  shortcutSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  chevron: { fontSize: 22, color: "#94A3B8", fontWeight: "700" },
});
