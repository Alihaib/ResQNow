import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";

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
  userInfo?: any;
  distance?: number;
  timeAgo?: string;
}

const MAX_DISTANCE_METERS = 200; // 200 meters

export default function NearbyEmergenciesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [ambulanceLocation, setAmbulanceLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Get ambulance location
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
          Alert.alert(
            t("error") || "Permission Denied",
            t("locationPermissionDenied") || "Location permission is required to find nearby emergencies."
          );
          setLoading(false);
        }
      } catch (error) {
        console.error("Error getting ambulance location:", error);
        Alert.alert(t("error") || "Error", "Failed to get location");
        setLoading(false);
      }
    };
    getAmbulanceLocation();
  }, []);

  // Calculate distance between two coordinates (Haversine formula) in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Radius of the Earth in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  };

  // Format time ago
  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} sec ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) > 1 ? "s" : ""} ago`;
    return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) > 1 ? "s" : ""} ago`;
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

  // Listen to active emergencies and filter by distance
  useEffect(() => {
    if (!ambulanceLocation) return;

    setLoading(true);
    const emergenciesRef = collection(db, "emergencies");
    const q = query(emergenciesRef, where("status", "==", "active"));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const emergenciesList: Emergency[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const emergency: Emergency = {
          id: docSnap.id,
          userId: data.userId,
          location: data.location,
          timestamp: data.timestamp,
          status: data.status,
        };

        // Calculate distance in meters
        if (emergency.location) {
          const distanceMeters = calculateDistance(
            ambulanceLocation.latitude,
            ambulanceLocation.longitude,
            emergency.location.latitude,
            emergency.location.longitude
          );

          // Only include emergencies within 200 meters
          if (distanceMeters <= MAX_DISTANCE_METERS) {
            emergency.distance = distanceMeters / 1000; // Convert to km for display
            emergency.timeAgo = formatTimeAgo(emergency.timestamp);

            // Fetch user info
            const userInfo = await fetchUserInfo(data.userId);
            if (userInfo) {
              emergency.userInfo = userInfo;
            }

            emergenciesList.push(emergency);
          }
        }
      }

      // Sort by distance (closest first)
      emergenciesList.sort((a, b) => {
        if (a.distance && b.distance) {
          return a.distance - b.distance;
        }
        return 0;
      });

      setEmergencies(emergenciesList);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to emergencies:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ambulanceLocation]);

  // Open navigation to emergency location
  const openNavigation = (emergency: Emergency) => {
    const { latitude, longitude } = emergency.location;
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
      Alert.alert(t("error") || "Error", "Failed to open navigation");
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("nearby_emergencies") || "Nearby Emergencies"}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoText}>
          📍 {t("showingEmergenciesWithin") || "Showing emergencies within"} {MAX_DISTANCE_METERS}{"m"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.centerContainer}>
            <Text style={styles.loadingText}>{t("loading") || "Loading nearby emergencies..."}</Text>
            {!ambulanceLocation && (
              <Text style={styles.subText}>{t("gettingLocation") || "Getting your location..."}</Text>
            )}
          </View>
        ) : emergencies.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>🚑</Text>
            <Text style={styles.emptyText}>
              {t("noNearbyEmergencies") || "No emergencies within 200 meters"}
            </Text>
            <Text style={styles.subText}>
              {t("checkBackLater") || "Check back later or expand your search radius"}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.countText}>
              {emergencies.length} {emergencies.length === 1 ? (t("emergency") || "emergency") : (t("emergencies") || "emergencies")} {t("found") || "found"}
            </Text>
            {emergencies.map((emergency) => (
              <TouchableOpacity
                key={emergency.id}
                style={styles.emergencyCard}
                onPress={() => router.push({
                  pathname: "/ambulance/emergency-detail",
                  params: { emergencyId: emergency.id }
                })}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.priorityBadge}>
                    <Text style={styles.priorityText}>🚨 {t("emergency") || "EMERGENCY"}</Text>
                  </View>
                  <Text style={styles.timeText}>{emergency.timeAgo || "Just now"}</Text>
                </View>

                <Text style={styles.userName}>
                  {emergency.userInfo?.name || emergency.userInfo?.email || "Unknown User"}
                </Text>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    openNavigation(emergency);
                  }}
                  style={styles.locationSection}
                >
                  <Text style={styles.locationText}>
                    📍 {emergency.location.address || 
                      `${emergency.location.latitude.toFixed(4)}, ${emergency.location.longitude.toFixed(4)}`}
                  </Text>
                  {emergency.distance !== undefined ? (
                    <Text style={styles.distanceText}>
                      📏 {Math.round(emergency.distance * 1000)}{"m"} {t("away") || "away"}
                    </Text>
                  ) : null}
                </TouchableOpacity>

                {emergency.userInfo && (
                  <View style={styles.quickInfo}>
                    {emergency.userInfo.bloodType ? (
                      <Text style={styles.quickInfoText}>
                        🩸 {t("blood_type") || "Blood"}: {emergency.userInfo.bloodType}
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
            ))}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
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
  infoBanner: {
    backgroundColor: "#D62828",
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  infoText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: "#6C757D",
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: "#ADB5BD",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 8,
    textAlign: "center",
  },
  countText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 16,
  },
  emergencyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: "#D62828",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  priorityBadge: {
    backgroundColor: "#DC2626",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  priorityText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  timeText: {
    fontSize: 14,
    color: "#6C757D",
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 12,
  },
  locationSection: {
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    color: "#6C757D",
    marginBottom: 4,
  },
  distanceText: {
    fontSize: 14,
    color: "#D62828",
    fontWeight: "700",
  },
  quickInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
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
  chevron: {
    position: "absolute",
    right: 20,
    top: 20,
    fontSize: 24,
    color: "#6C757D",
  },
});

