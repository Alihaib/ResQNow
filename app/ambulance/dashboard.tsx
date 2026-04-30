import * as Location from "expo-location";
import { useRouter } from "expo-router";
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
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";
import { autoDispatchEmergency, rejectAndReassignEmergency } from "../../src/services/autoDispatch";

interface Emergency {
  id: string;
  userId: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    address: string | null;
  };
  patientLocation?: { latitude?: number; longitude?: number; address?: string | null } | null;
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
  const [lastSeenEmergencyTs, setLastSeenEmergencyTs] = useState<string | null>(null);
  const [newEmergencyIds, setNewEmergencyIds] = useState<Record<string, true>>({});
  const [bannerEmergencyId, setBannerEmergencyId] = useState<string | null>(null);
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
    // Remove NEW badge and hide banner if it was referencing this emergency
    setNewEmergencyIds((prev) => {
      const next = { ...prev };
      delete next[emergencyId];
      return next;
    });
    if (bannerEmergencyId === emergencyId) {
      setBannerVisible(false);
      setBannerEmergencyId(null);
    }
    // Update last seen timestamp to the newest emergency currently known (best effort)
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
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
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

          // Publish last known ambulance location for auto-dispatch selection.
          if (user?.uid) {
            updateDoc(doc(db, "users", user.uid), {
              lastKnownLocation: coords,
              lastKnownLocationUpdatedAt: new Date().toISOString(),
            }).catch((e) => {
              console.warn("[AmbulanceDashboard] failed to update lastKnownLocation:", e);
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
    // Only mount listener when access is valid (avoids PERMISSION_DENIED during auth bootstrap)
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
          console.log("[AmbulanceDashboard] active emergencies snapshot:", snapshot.size);
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
            // Defensive validation for legacy/malformed docs (don't crash UI)
            const sessionStatus = typeof data.sessionStatus === "string" ? data.sessionStatus : "active";
            if (sessionStatus !== "active") continue;

            // Determine if this emergency is "new" relative to the last seen timestamp.
            const ts = typeof data.timestamp === "string" ? data.timestamp : null;
            const isNew = !!ts && (!!lastSeenEmergencyTs ? ts > lastSeenEmergencyTs : false);
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
              assignedAt: typeof data.assignedAt === "string" ? data.assignedAt : null,
              victimType: data.victimType === "other" ? "other" : "me",
            };

            // Privacy: if victimType is "other", do NOT fetch or display medical profile data.
            if (emergency.victimType !== "other") {
              const userInfo = await fetchUserInfo(data.userId);
              if (userInfo) {
                emergency.userInfo = userInfo;
              }
            }

            // Calculate distance if ambulance location is available
            if (ambulanceLocation && emergency.location) {
              emergency.distance = calculateDistance(
                ambulanceLocation.latitude,
                ambulanceLocation.longitude,
                emergency.location.latitude,
                emergency.location.longitude,
              );
            }

            // Calculate time ago
            emergency.timeAgo = formatTimeAgo(emergency.timestamp);

            emergenciesList.push(emergency);
          }

          // Sort by distance (closest first) or by time (newest first)
          emergenciesList.sort((a, b) => {
            if (a.distance && b.distance) {
              return a.distance - b.distance;
            }
            return (
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });

          setEmergencies(emergenciesList);

          // AUTO DISPATCH: attempt closest-ambulance assignment for unassigned emergencies.
          // Triggered by Firestore realtime only (no push, no backend). Transaction prevents races.
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
                  console.log("[AutoDispatch] assigned", e.id, "->", res.assignedAmbulanceId);
                } else if (res.ok) {
                  console.log("[AutoDispatch] skipped", e.id, "reason=", (res as any).reason);
                } else {
                  console.warn("[AutoDispatch] failed", e.id, "reason=", (res as any).reason);
                }
              })
              .catch((err) => console.warn("[AutoDispatch] error", e.id, err));
          }

          // Merge NEW ids into local state (so badge persists until seen)
          if (Object.keys(incomingNewIds).length > 0) {
            setNewEmergencyIds((prev) => ({ ...prev, ...incomingNewIds }));
          }

          // Show live banner for the newest unseen emergency (and auto-scroll to calls section)
          if (newestIncoming) {
            setBannerEmergencyId(newestIncoming.id);
            setBannerVisible(true);
            console.log("[AmbulanceDashboard] NEW emergency alert:", newestIncoming.id);
            if (liveCallsScrollY !== null && scrollRef.current?.scrollTo) {
              scrollRef.current.scrollTo({ y: Math.max(0, liveCallsScrollY - 12), animated: true });
            }
          }

          setLoadingEmergencies(false);
        } catch (error) {
          console.error("Error processing emergencies snapshot:", error);
          setEmergenciesError(t("failedToLoadEmergencies") || "Failed to load emergencies.");
          setLoadingEmergencies(false);
        }
      },
      (error) => {
        console.error("Error listening to emergencies:", error);
        console.error(
          "Ambulance emergencies listener error code:",
          (error as any)?.code,
        );
        // Typical cause when docs exist but don't show: Firestore security rules (PERMISSION_DENIED).
        setEmergenciesError(
          (error as any)?.code === "permission-denied" || (error as any)?.code === "PERMISSION_DENIED"
            ? "PERMISSION_DENIED: responder not approved or rules not deployed."
            : t("failedToLoadEmergencies") || "Failed to load emergencies."
        );
        setLoadingEmergencies(false);
      },
    );

    return () => unsubscribe();
  }, [ambulanceLocation, authLoading, user?.uid, role, approved, t, lastSeenEmergencyTs, liveCallsScrollY]);

  // SMART REASSIGNMENT: timeout-based reassignment loop (local-only, Firestore-driven).
  // Any approved ambulance client can act as a dispatcher; transaction guarantees single-winner updates.
  useEffect(() => {
    if (authLoading) return;
    if (!user?.uid) return;
    if (role !== "ambulance" || approved !== true) return;

    const timer = setInterval(() => {
      const now = Date.now();
      for (const e of emergencies) {
        if (e.status !== "assigned") continue; // only waiting-for-response state
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
        console.log("[AutoDispatch][timeout] reassigning emergency:", e.id, "assigned=", e.assignedAmbulanceId);
        rejectAndReassignEmergency({
          emergencyId: e.id,
          rejectingAmbulanceId: e.assignedAmbulanceId,
          patientLocation: { latitude: lat, longitude: lng },
        })
          .then((res) => console.log("[AutoDispatch][timeout] result:", e.id, res))
          .catch((err) => console.warn("[AutoDispatch][timeout] error:", e.id, err))
          .finally(() => {
            // allow future attempts if still assigned after this run
            setTimeout(() => {
              delete attemptedTimeoutReassignRef.current[e.id];
            }, 15000);
          });
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [authLoading, user?.uid, role, approved, emergencies]);

  // Open navigation to emergency location
  const openNavigation = (emergency: Emergency) => {
    const { latitude, longitude } = emergency.location;
    const url = Platform.select({
      ios: `maps://maps.apple.com/?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });

    Linking.canOpenURL(url || "")
      .then((supported) => {
        if (supported) {
          Linking.openURL(url || "");
        } else {
          // Fallback to Google Maps web
          Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
          );
        }
      })
      .catch((error) => {
        console.error("Error opening navigation:", error);
        Alert.alert(t("error"), t("failedToOpenNavigation"));
      });
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
      const queryDigits = searchQuery.trim().replace(/\D/g, ""); // Extract digits for ID search

      // Search by Israeli ID or name or email
      const usersSnapshot = await getDocs(collection(db, "users"));

      // Use find() to stop searching once we find a match
      const foundDoc = usersSnapshot.docs.find((docSnap) => {
        const data = docSnap.data();

        // Check if search matches Israeli ID, name, or email
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
            <Text style={styles.liveBannerTitle}>🚨 New Emergency Received</Text>
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)");
          }}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.logo}>🚑</Text>
      <Text style={styles.title}>{t("ambulance_dashboard_title")}</Text>
      <Text style={styles.subtitle}>{t("ambulance_dashboard_sub")}</Text>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
        {/* Patient Search for Emergency Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            🔍 {t("searchPatient") || "Search Patient"}
          </Text>
          <Text style={styles.searchSubtitle}>
            {t("searchPatientNote") ||
              "Enter Israeli ID or name to access medical information"}
          </Text>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t("enterPatientId") || "Enter Israeli ID or Name"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#ADB5BD"
              keyboardType="default"
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={handleSearchPatient}
              disabled={searching || !searchQuery.trim()}
            >
              <Text style={styles.searchBtnText}>
                {searching ? t("loading") : "🔍"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Patient Info Display */}
          {patientData && (
            <View style={styles.patientInfoCard}>
              <View style={styles.patientHeader}>
                <Text style={styles.patientName}>
                  {patientData.name || patientData.email}
                </Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setPatientData(null)}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {patientData.israeliId && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.patientInfoLabel}>{t("israeliId")}:</Text>
                  <Text style={styles.patientInfoValue}>
                    {patientData.israeliId}
                  </Text>
                </View>
              )}

              <View style={styles.patientInfoRow}>
                <Text style={styles.patientInfoLabel}>{t("phoneNumber")}:</Text>
                <Text style={styles.patientInfoValue}>
                  {patientData.phoneNumber || "N/A"}
                </Text>
              </View>

              {patientData.bloodType && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.patientInfoLabel}>
                    {t("blood_type")}:
                  </Text>
                  <Text style={styles.patientInfoValue}>
                    {patientData.bloodType}
                  </Text>
                </View>
              )}

              {patientData.age && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.patientInfoLabel}>{t("age")}:</Text>
                  <Text style={styles.patientInfoValue}>{patientData.age}</Text>
                </View>
              )}

              {patientData.diseases && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>
                    {t("diseases")}:
                  </Text>
                  <Text style={styles.patientInfoText}>
                    {patientData.diseases}
                  </Text>
                </View>
              )}

              {patientData.medications && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>
                    {t("medications")}:
                  </Text>
                  <Text style={styles.patientInfoText}>
                    {patientData.medications}
                  </Text>
                </View>
              )}

              {patientData.allergies && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>
                    {t("allergies")}:
                  </Text>
                  <Text style={styles.patientInfoText}>
                    {patientData.allergies}
                  </Text>
                </View>
              )}

              {patientData.emergencyContacts &&
                patientData.emergencyContacts.length > 0 && (
                  <View style={styles.patientInfoSection}>
                    <Text style={styles.patientInfoSectionTitle}>
                      {t("emergency_contact")}:
                    </Text>
                    {patientData.emergencyContacts.map(
                      (contact: any, index: number) => (
                        <Text key={index} style={styles.patientInfoText}>
                          {contact.name}: {contact.phone}
                        </Text>
                      ),
                    )}
                  </View>
                )}

              <TouchableOpacity
                style={styles.viewFullBtn}
                onPress={() => router.push(`/doctor/patient/${patientData.id}`)}
              >
                <Text style={styles.viewFullBtnText}>
                  {t("viewFullProfile") || "View Full Profile"} ›
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Live Emergency Calls */}
        <View
          style={styles.section}
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            setLiveCallsScrollY(y);
          }}
        >
          <Text style={styles.sectionTitle}>
            {t("live_calls") || "Live Emergency Calls"}
          </Text>
          {loadingEmergencies ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>
                {t("loading") || "Loading emergencies..."}
              </Text>
            </View>
          ) : emergenciesError ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>⚠️</Text>
              <Text style={styles.loadingText}>{emergenciesError}</Text>
            </View>
          ) : emergencies.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>🚑</Text>
              <Text style={styles.emptyText}>{t("noActiveEmergencies")}</Text>
            </View>
          ) : (
            emergencies.map((emergency) => (
              <TouchableOpacity
                key={emergency.id}
                style={[
                  styles.callCard,
                  newEmergencyIds[emergency.id] ? styles.callCardNew : undefined,
                ]}
                onPress={async () => {
                  await markEmergencySeen(emergency.id);
                  router.push({
                    pathname: "/ambulance/emergency-detail",
                    params: { emergencyId: emergency.id },
                  });
                }}
              >
                <View style={styles.callHeader}>
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: "#DC2626" },
                    ]}
                  >
                    <Text style={styles.priorityText}>
                      {t("emergency") || "EMERGENCY"}
                    </Text>
                  </View>
                  <Text style={styles.callTime}>
                    {emergency.timeAgo || t("justNow")}
                  </Text>
                </View>
                {newEmergencyIds[emergency.id] ? (
                  <Animated.View
                    style={[
                      styles.newBadge,
                      {
                        transform: [
                          {
                            scale: pulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.08],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </Animated.View>
                ) : null}
                <Text style={styles.callType}>
                  {emergency.victimType === "other"
                    ? t("someoneElse")
                    : emergency.userInfo?.name ||
                      emergency.userInfo?.email ||
                      t("unknownUser")}
                </Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    openNavigation(emergency);
                  }}
                  style={styles.locationRow}
                >
                  <Text style={styles.callDistance}>
                    📍{" "}
                    {emergency.location.address ||
                      `${emergency.location.latitude.toFixed(4)}, ${emergency.location.longitude.toFixed(4)}`}
                  </Text>
                  {emergency.distance !== undefined &&
                  emergency.distance !== null ? (
                    <Text style={styles.distanceText}>
                      {emergency.distance < 1
                        ? `${(emergency.distance * 1000).toFixed(0)}m away`
                        : `${emergency.distance.toFixed(1)}km away`}
                    </Text>
                  ) : null}
                </TouchableOpacity>
                {emergency.victimType !== "other" && emergency.userInfo && (
                  <View style={styles.quickInfo}>
                    {emergency.userInfo.bloodType ? (
                      <Text style={styles.quickInfoText}>
                        🩸 {t("blood_type") || "Blood"}:{" "}
                        {emergency.userInfo.bloodType}
                      </Text>
                    ) : null}
                    {emergency.userInfo.age ? (
                      <Text style={styles.quickInfoText}>
                        👤 {t("age") || "Age"}: {emergency.userInfo.age}
                      </Text>
                    ) : null}
                  </View>
                )}
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Vehicle Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("vehicle_status")}</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>{t("vehicle_status")}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{t("ready")}</Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>{t("equipment")}</Text>
              <Text style={styles.statusValue}>✓ {t("complete")}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>{t("fuelLevel")}</Text>
              <Text style={styles.statusValue}>85%</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("quickActions")}</Text>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/ambulance/nearby-emergencies")}
          >
            <Text style={styles.actionIcon}>🗺️</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{t("nearby_emergencies")}</Text>
              <Text style={styles.actionSubtitle}>
                {t("nearby_emergencies_desc")}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionIcon}>📋</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{t("routePlanning")}</Text>
              <Text style={styles.actionSubtitle}>{t("planRoutes")}</Text>
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
    backgroundColor: "#F8F9FA",
    paddingTop: 60,
    paddingHorizontal: 20,
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  headerSpacer: { width: 40, height: 40 },
  logo: {
    fontSize: 60,
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#003049",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6C757D",
    textAlign: "center",
    marginBottom: 24,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 16,
  },
  callCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  callCardNew: {
    borderLeftWidth: 4,
    borderLeftColor: "#DC2626",
    backgroundColor: "#FFF5F5",
  },
  newBadge: {
    alignSelf: "flex-start",
    marginBottom: 8,
    backgroundColor: "#111827",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  callHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  priorityBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  priorityText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  callTime: {
    fontSize: 14,
    color: "#6C757D",
  },
  callType: {
    fontSize: 20,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 8,
  },
  reporterLabel: {
    fontSize: 12,
    color: "#6C757D",
    marginBottom: 6,
  },
  callDistance: {
    fontSize: 14,
    color: "#6C757D",
  },
  chevron: {
    position: "absolute",
    right: 20,
    top: 20,
    fontSize: 24,
    color: "#6C757D",
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 16,
    color: "#6C757D",
  },
  statusBadge: {
    backgroundColor: "#D1FAE5",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2D6A4F",
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
  },
  actionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: "#6C757D",
  },
  searchSubtitle: {
    fontSize: 13,
    color: "#6C757D",
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "#E9ECEF",
    marginRight: 8,
  },
  searchBtn: {
    backgroundColor: "#D62828",
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
  },
  searchBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  patientInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#D62828",
  },
  patientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  patientName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 18,
    color: "#6C757D",
    fontWeight: "700",
  },
  patientInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  patientInfoLabel: {
    fontSize: 14,
    color: "#6C757D",
    fontWeight: "600",
  },
  patientInfoValue: {
    fontSize: 14,
    color: "#003049",
    fontWeight: "700",
  },
  patientInfoSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E9ECEF",
  },
  patientInfoSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 8,
  },
  patientInfoText: {
    fontSize: 14,
    color: "#212529",
    lineHeight: 20,
  },
  viewFullBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E9ECEF",
    paddingTop: 16,
  },
  viewFullBtnText: {
    fontSize: 16,
    color: "#D62828",
    fontWeight: "700",
  },
  loadingContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6C757D",
  },
  emptyContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6C757D",
    marginTop: 8,
  },
  locationRow: {
    marginTop: 8,
  },
  distanceText: {
    fontSize: 14,
    color: "#D62828",
    fontWeight: "700",
    marginTop: 4,
  },
  quickInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  quickInfoText: {
    fontSize: 12,
    color: "#6C757D",
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
});
