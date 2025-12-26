import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
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
}

export default function EmergencyDetailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ emergencyId: string }>();
  const [emergency, setEmergency] = useState<Emergency | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ambulanceLocation, setAmbulanceLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    const loadEmergency = async () => {
      if (!params.emergencyId) {
        Alert.alert(t("error") || "Error", "Emergency ID not provided");
        router.back();
        return;
      }

      try {
        // Fetch emergency
        const emergencyDoc = await getDoc(doc(db, "emergencies", params.emergencyId));
        if (!emergencyDoc.exists()) {
          Alert.alert(t("error") || "Error", "Emergency not found");
          router.back();
          return;
        }

        const emergencyData = emergencyDoc.data();
        const emergencyObj: Emergency = {
          id: emergencyDoc.id,
          userId: emergencyData.userId,
          location: emergencyData.location,
          timestamp: emergencyData.timestamp,
          status: emergencyData.status,
        };
        setEmergency(emergencyObj);

        // Fetch user info
        const userDoc = await getDoc(doc(db, "users", emergencyData.userId));
        if (userDoc.exists()) {
          setUserInfo({ id: userDoc.id, ...userDoc.data() });
        }
      } catch (error) {
        console.error("Error loading emergency:", error);
        Alert.alert(t("error") || "Error", "Failed to load emergency details");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadEmergency();
  }, [params.emergencyId]);

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

  const openNavigation = () => {
    if (!emergency) return;

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

  const distance = ambulanceLocation && emergency.location
    ? calculateDistance(
        ambulanceLocation.latitude,
        ambulanceLocation.longitude,
        emergency.location.latitude,
        emergency.location.longitude
      )
    : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("emergencyDetails") || "Emergency Details"}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Emergency Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>🚨 {t("activeEmergency") || "ACTIVE EMERGENCY"}</Text>
          </View>
          <Text style={styles.timeText}>{formatTimeAgo(emergency.timestamp)}</Text>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 {t("location") || "Location"}</Text>
          <TouchableOpacity style={styles.locationCard} onPress={openNavigation}>
            <Text style={styles.locationAddress}>
              {emergency.location.address || 
               `${emergency.location.latitude.toFixed(6)}, ${emergency.location.longitude.toFixed(6)}`}
            </Text>
            <Text style={styles.locationCoords}>
              {emergency.location.latitude.toFixed(6)}, {emergency.location.longitude.toFixed(6)}
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

        {/* User Information */}
        {userInfo && (
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 12,
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
  loadingText: {
    fontSize: 18,
    color: "#6C757D",
  },
  errorText: {
    fontSize: 18,
    color: "#D62828",
  },
});
