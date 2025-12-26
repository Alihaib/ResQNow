import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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

export default function AmbulanceDashboard() {
  const router = useRouter();
  const { t, lang, toggleLanguage } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loadingEmergencies, setLoadingEmergencies] = useState(true);
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
        }
      } catch (error) {
        console.error("Error getting ambulance location:", error);
      }
    };
    getAmbulanceLocation();
  }, []);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

  // Listen to active emergencies
  useEffect(() => {
    setLoadingEmergencies(true);
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

        // Fetch user info
        const userInfo = await fetchUserInfo(data.userId);
        if (userInfo) {
          emergency.userInfo = userInfo;
        }

        // Calculate distance if ambulance location is available
        if (ambulanceLocation && emergency.location) {
          emergency.distance = calculateDistance(
            ambulanceLocation.latitude,
            ambulanceLocation.longitude,
            emergency.location.latitude,
            emergency.location.longitude
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
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setEmergencies(emergenciesList);
      setLoadingEmergencies(false);
    }, (error) => {
      console.error("Error listening to emergencies:", error);
      setLoadingEmergencies(false);
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
        // Fallback to Google Maps web
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
      }
    }).catch((error) => {
      console.error("Error opening navigation:", error);
      Alert.alert(t("error") || "Error", "Failed to open navigation");
    });
  };

  const handleSearchPatient = async () => {
    if (!searchQuery.trim()) {
      Alert.alert(t("error"), t("enterPatientId") || "Please enter Israeli ID or name");
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
      Alert.alert(t("error"), "Failed to search patient");
    } finally {
      setSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
          <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.logo}>🚑</Text>
      <Text style={styles.title}>{t("ambulance_dashboard_title")}</Text>
      <Text style={styles.subtitle}>{t("ambulance_dashboard_sub")}</Text>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Patient Search for Emergency Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 {t("searchPatient") || "Search Patient"}</Text>
          <Text style={styles.searchSubtitle}>
            {t("searchPatientNote") || "Enter Israeli ID or name to access medical information"}
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
                <Text style={styles.patientName}>{patientData.name || patientData.email}</Text>
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
                  <Text style={styles.patientInfoValue}>{patientData.israeliId}</Text>
                </View>
              )}
              
              <View style={styles.patientInfoRow}>
                <Text style={styles.patientInfoLabel}>{t("phoneNumber")}:</Text>
                <Text style={styles.patientInfoValue}>{patientData.phoneNumber || "N/A"}</Text>
              </View>
              
              {patientData.bloodType && (
                <View style={styles.patientInfoRow}>
                  <Text style={styles.patientInfoLabel}>{t("blood_type")}:</Text>
                  <Text style={styles.patientInfoValue}>{patientData.bloodType}</Text>
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
                  <Text style={styles.patientInfoSectionTitle}>{t("diseases")}:</Text>
                  <Text style={styles.patientInfoText}>{patientData.diseases}</Text>
                </View>
              )}

              {patientData.medications && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>{t("medications")}:</Text>
                  <Text style={styles.patientInfoText}>{patientData.medications}</Text>
                </View>
              )}

              {patientData.allergies && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>{t("allergies")}:</Text>
                  <Text style={styles.patientInfoText}>{patientData.allergies}</Text>
                </View>
              )}

              {patientData.emergencyContacts && patientData.emergencyContacts.length > 0 && (
                <View style={styles.patientInfoSection}>
                  <Text style={styles.patientInfoSectionTitle}>{t("emergency_contact")}:</Text>
                  {patientData.emergencyContacts.map((contact: any, index: number) => (
                    <Text key={index} style={styles.patientInfoText}>
                      {contact.name}: {contact.phone}
                    </Text>
                  ))}
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("live_calls") || "Live Emergency Calls"}</Text>
          {loadingEmergencies ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>{t("loading") || "Loading emergencies..."}</Text>
            </View>
          ) : emergencies.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>🚑</Text>
              <Text style={styles.emptyText}>{t("noActiveEmergencies") || "No active emergencies"}</Text>
            </View>
          ) : (
            emergencies.map((emergency) => (
              <TouchableOpacity
                key={emergency.id}
                style={styles.callCard}
                onPress={() => router.push({
                  pathname: "/ambulance/emergency-detail",
                  params: { emergencyId: emergency.id }
                })}
              >
                <View style={styles.callHeader}>
                  <View style={[styles.priorityBadge, { backgroundColor: "#DC2626" }]}>
                    <Text style={styles.priorityText}>{t("emergency") || "EMERGENCY"}</Text>
                  </View>
                  <Text style={styles.callTime}>{emergency.timeAgo || "Just now"}</Text>
                </View>
                <Text style={styles.callType}>
                  {emergency.userInfo?.name || emergency.userInfo?.email || "Unknown User"}
                </Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    openNavigation(emergency);
                  }}
                  style={styles.locationRow}
                >
                  <Text style={styles.callDistance}>
                    📍 {emergency.location.address || `${emergency.location.latitude.toFixed(4)}, ${emergency.location.longitude.toFixed(4)}`}
                  </Text>
                  {emergency.distance !== undefined && emergency.distance !== null ? (
                    <Text style={styles.distanceText}>
                      {emergency.distance < 1 
                        ? `${(emergency.distance * 1000).toFixed(0)}m away`
                        : `${emergency.distance.toFixed(1)}km away`}
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
              <Text style={styles.actionSubtitle}>{t("nearby_emergencies_desc")}</Text>
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
  languageBtn: {
    backgroundColor: "#003049",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  languageText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
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
