import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import StatusChip from "../../components/ui/StatusChip";
import SubScreenShell from "../../components/ui/SubScreenShell";
import { subScreenStyles } from "../../components/ui/subScreenStyles";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";
import { openMapsNavigation } from "../../src/utils/openMapsNavigation";
import { caseIdSuffix } from "../../src/utils/formatCaseId";
import { useUiDirection } from "../../components/ui/layout";
import { tokens } from "../../src/ui/tokens";

interface Emergency {
  id: string;
  userId: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    address: string | null;
  };
  timestamp: string;
  status: string;
  victimType?: "me" | "other";
  userInfo?: {
    name?: string;
    email?: string;
    age?: string | number;
    bloodType?: string;
  };
  distance?: number;
  timeAgo?: string;
}

const MAX_DISTANCE_METERS = 200;

export default function NearbyEmergenciesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { row, chevronForward } = useUiDirection();
  const { user, role, approved, loading: authLoading } = useAuth();
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [ambulanceLocation, setAmbulanceLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
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
        } else {
          Alert.alert(t("error"), t("locationPermissionDenied"));
          setErrorText(t("locationPermissionDenied") || "Location permission denied.");
          setLoading(false);
        }
      } catch (error) {
        console.error("Error getting ambulance location:", error);
        Alert.alert(t("error"), t("failedToGetLocation"));
        setErrorText(t("failedToGetLocation") || "Failed to get location.");
        setLoading(false);
      }
    };
    getAmbulanceLocation();
  }, []);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371000;
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

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diffInSeconds < 60)
      return t("timeAgoSec").replace("{count}", String(diffInSeconds));
    if (diffInSeconds < 3600)
      return t("timeAgoMin").replace("{count}", String(Math.floor(diffInSeconds / 60)));
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

  useEffect(() => {
    if (!ambulanceLocation) return;
    if (authLoading) return;
    if (!user?.uid) return;
    if (role !== "ambulance" || approved !== true) return;

    setLoading(true);
    setErrorText(null);
    const emergenciesRef = collection(db, "emergencies");
    const q = query(emergenciesRef, where("sessionStatus", "==", "active"));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const emergenciesList: Emergency[] = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const emergency: Emergency = {
            id: docSnap.id,
            userId: data.userId,
            location: data.location,
            timestamp: data.timestamp,
            status: data.status,
            victimType: data.victimType === "other" ? "other" : "me",
          };

          if (emergency.location) {
            const distanceMeters = calculateDistance(
              ambulanceLocation.latitude,
              ambulanceLocation.longitude,
              emergency.location.latitude,
              emergency.location.longitude,
            );

            if (distanceMeters <= MAX_DISTANCE_METERS) {
              emergency.distance = distanceMeters / 1000;
              emergency.timeAgo = formatTimeAgo(emergency.timestamp);

              if (emergency.victimType !== "other") {
                const userInfo = await fetchUserInfo(data.userId);
                if (userInfo) {
                  emergency.userInfo = userInfo;
                }
              }

              emergenciesList.push(emergency);
            }
          }
        }

        emergenciesList.sort((a, b) => {
          if (a.distance && b.distance) {
            return a.distance - b.distance;
          }
          return 0;
        });

        setEmergencies(emergenciesList);
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to emergencies:", error);
        setErrorText(
          (error as { code?: string })?.code === "permission-denied" ||
          (error as { code?: string })?.code === "PERMISSION_DENIED"
            ? "PERMISSION_DENIED: responder not approved or rules not deployed."
            : t("failedToLoadEmergencies") || "Failed to load emergencies.",
        );
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [ambulanceLocation, authLoading, user?.uid, role, approved, t]);

  const openNavigation = async (emergency: Emergency) => {
    const result = await openMapsNavigation({
      latitude: emergency?.location?.latitude,
      longitude: emergency?.location?.longitude,
    });
    if (result.ok) return;
    const { Alert } = await import("react-native");
    Alert.alert(
      t("error"),
      result.reason === "invalid_coords"
        ? t("locationNotAvailable")
        : t("failedToOpenNavigation"),
    );
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/ambulance/dashboard");
  };

  return (
    <SubScreenShell
      title={t("nearby_emergencies") || "Nearby Emergencies"}
      onBack={goBack}
      fallbackRoute="/ambulance/dashboard"
    >
      <Card tone="accent" compact style={styles.banner}>
        <Text style={styles.bannerText}>
          {t("showingEmergenciesWithin") || "Showing emergencies within"}{" "}
          {MAX_DISTANCE_METERS}m
        </Text>
      </Card>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={tokens.color.primary} />
          <Text style={styles.loadingText}>
            {t("loadingNearbyEmergencies")}
          </Text>
          {!ambulanceLocation ? (
            <Text style={styles.subText}>{t("gettingLocation")}</Text>
          ) : null}
        </View>
      ) : errorText ? (
        <EmptyState ionIcon="alert-circle-outline" title={errorText} tone="danger" />
      ) : emergencies.length === 0 ? (
        <EmptyState
          ionIcon="car-outline"
          title={t("noNearbyEmergencies").replace(
            "{meters}",
            String(MAX_DISTANCE_METERS),
          )}
          subtitle={t("checkBackLater")}
        />
      ) : (
        <>
          <Text style={styles.countText}>
            {emergencies.length}{" "}
            {emergencies.length === 1
              ? t("emergency") || "emergency"
              : t("emergencies") || "emergencies"}{" "}
            {t("found") || "found"}
          </Text>
          {emergencies.map((emergency) => (
            <Card
              key={emergency.id}
              tone="default"
              accentStart={tokens.color.danger}
              style={styles.emergencyCard}
            >
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/ambulance/emergency-detail",
                    params: { emergencyId: emergency.id },
                  })
                }
                activeOpacity={0.85}
              >
                <View style={[styles.cardHeader, row]}>
                  <StatusChip
                    label={t("emergency") || "EMERGENCY"}
                    variant="danger"
                    size="sm"
                    solid
                  />
                  <Text style={styles.timeText}>
                    {emergency.timeAgo || t("justNow")}
                  </Text>
                </View>

                <Text style={styles.caseIdText} numberOfLines={1}>
                  {t("activityEmergencyRef", "Case {id}").replace(
                    "{id}",
                    caseIdSuffix(emergency.id),
                  )}
                </Text>

                <Text style={styles.userName}>
                  {emergency.victimType === "other"
                    ? t("someoneElse")
                    : emergency.userInfo?.name ||
                      emergency.userInfo?.email ||
                      t("unknownUser")}
                </Text>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    openNavigation(emergency);
                  }}
                  style={styles.locationSection}
                >
                  <Text style={styles.locationText}>
                    {emergency.location.address ||
                      `${emergency.location.latitude.toFixed(4)}, ${emergency.location.longitude.toFixed(4)}`}
                  </Text>
                  {emergency.distance !== undefined ? (
                    <Text style={styles.distanceText}>
                      {Math.round(emergency.distance * 1000)}m{" "}
                      {t("away") || "away"}
                    </Text>
                  ) : null}
                </TouchableOpacity>

                {emergency.victimType !== "other" && emergency.userInfo ? (
                  <View style={[styles.quickInfo, row]}>
                    {emergency.userInfo.bloodType ? (
                      <StatusChip
                        label={`${t("blood_type")}: ${emergency.userInfo.bloodType}`}
                        variant="neutral"
                        size="sm"
                      />
                    ) : null}
                    {emergency.userInfo.age ? (
                      <StatusChip
                        label={`${t("age")}: ${emergency.userInfo.age}`}
                        variant="neutral"
                        size="sm"
                      />
                    ) : null}
                  </View>
                ) : null}

                <Text style={styles.chevron}>{chevronForward}</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </>
      )}
    </SubScreenShell>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: tokens.space.lg,
  },
  bannerText: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    textAlign: "center",
  },
  center: {
    alignItems: "center",
    paddingVertical: tokens.space.xxl,
    gap: tokens.space.sm,
  },
  loadingText: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textMuted,
    fontWeight: tokens.fontWeight.medium,
  },
  subText: {
    fontSize: tokens.font.body,
    color: tokens.color.textFaint,
    textAlign: "center",
  },
  countText: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.md,
  },
  emergencyCard: {
    marginBottom: tokens.space.sm,
  },
  cardHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.space.sm,
    gap: tokens.space.sm,
  },
  timeText: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
  },
  caseIdText: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.bold,
    color: tokens.color.textMuted,
    letterSpacing: 0.4,
    marginBottom: tokens.space.xs,
  },
  userName: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.sm,
  },
  locationSection: {
    marginBottom: tokens.space.sm,
  },
  locationText: {
    fontSize: tokens.font.body,
    color: tokens.color.textSecondary,
    marginBottom: tokens.space.xs,
  },
  distanceText: {
    fontSize: tokens.font.body,
    color: tokens.color.primary,
    fontWeight: tokens.fontWeight.semibold,
  },
  quickInfo: {
    flexWrap: "wrap",
    gap: tokens.space.xs,
    marginTop: tokens.space.xs,
  },
  chevron: {
    position: "absolute",
    end: tokens.space.lg,
    top: tokens.space.lg,
    fontSize: tokens.font.h3,
    color: tokens.color.textFaint,
    fontWeight: tokens.fontWeight.semibold,
  },
});
