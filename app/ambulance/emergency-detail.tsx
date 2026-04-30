import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { arrayUnion, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";

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
  status: string;
  sessionStatus?: "active" | "resolved" | "cancelled";
  victimType?: "me" | "other";
  assignedAmbulanceId?: string | null;
  ambulanceLocation?: { latitude?: number; longitude?: number } | null;
}

const AMBULANCE_STATUSES = [
  { key: "en_route", label: "En route" },
  { key: "arrived_patient", label: "Arrived at patient" },
  { key: "patient_picked", label: "Patient picked up" },
  { key: "en_route_hospital", label: "Transporting to hospital" },
  { key: "completed", label: "Completed" },
] as const;

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

  useEffect(() => {
    const loadEmergency = async () => {
      if (!params.emergencyId) {
        Alert.alert(t("error"), t("emergencyIdNotProvided"));
        router.back();
        return;
      }

      try {
        // Initial fetch (so UI can render quickly) + then realtime subscription below
        const emergencyDoc = await getDoc(doc(db, "emergencies", params.emergencyId));
        if (!emergencyDoc.exists()) throw new Error("Emergency not found");
        const data = emergencyDoc.data() as any;
        console.log("[AmbulanceEmergencyDetail] initial load:", emergencyDoc.id, data?.sessionStatus, data?.status);
        setEmergency({
          id: emergencyDoc.id,
          userId: data.userId,
          location: data.location,
          patientLocation: data.patientLocation,
          timestamp: data.timestamp,
          status: data.status,
          sessionStatus: data.sessionStatus,
          victimType: data.victimType === "other" ? "other" : "me",
          assignedAmbulanceId: data.assignedAmbulanceId ?? null,
          ambulanceLocation: data.ambulanceLocation ?? null,
        });
      } catch (error) {
        console.error("Error loading emergency:", error);
        Alert.alert(t("error"), t("failedToLoadEmergencyDetails"));
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadEmergency();
  }, [params.emergencyId]);

  // Realtime subscribe to emergency doc (status + assignment + patient/ambulance locations)
  useEffect(() => {
    if (!params.emergencyId) return;
    const ref = doc(db, "emergencies", params.emergencyId);
    const unsub = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const next: Emergency = {
          id: snap.id,
          userId: data.userId,
          location: data.location,
          patientLocation: data.patientLocation,
          timestamp: data.timestamp,
          status: data.status,
          sessionStatus: data.sessionStatus,
          victimType: data.victimType === "other" ? "other" : "me",
          assignedAmbulanceId: data.assignedAmbulanceId ?? null,
          ambulanceLocation: data.ambulanceLocation ?? null,
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

  const claimIfUnassigned = async () => {
    const uid = userUidRef.current;
    const e = emergencyRef.current;
    if (!uid || !e?.id) return;
    if (e.assignedAmbulanceId) return;
    console.log("[AmbulanceEmergencyDetail] claiming unassigned case:", e.id, "as", uid);
    await updateDoc(doc(db, "emergencies", e.id), {
      assignedAmbulanceId: uid,
      updatedAt: new Date().toISOString(),
      timeline: arrayUnion({
        status: "assigned_ambulance",
        ambulanceId: uid,
        timestamp: new Date().toISOString(),
      }),
    });
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

          await updateDoc(doc(db, "emergencies", latest.id), {
            assignedAmbulanceId: assigned ?? latestUid,
            ambulanceLocation: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
            updatedAt: new Date().toISOString(),
          });
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

  const updateCaseStatus = async (nextStatus: (typeof AMBULANCE_STATUSES)[number]["key"]) => {
    const uid = userUidRef.current;
    const e = emergencyRef.current;
    if (!uid || !e?.id) return;

    await claimIfUnassigned();

    // If assigned to someone else, block updates
    const latest = emergencyRef.current;
    if (latest?.assignedAmbulanceId && latest.assignedAmbulanceId !== uid) {
      Alert.alert(t("error"), t("caseAssignedToAnotherAmbulance"));
      return;
    }

    const nowIso = new Date().toISOString();
    console.log("[AmbulanceEmergencyDetail] update status:", e.id, "->", nextStatus);
    await updateDoc(doc(db, "emergencies", e.id), {
      status: nextStatus,
      sessionStatus: nextStatus === "completed" ? "resolved" : "active",
      updatedAt: nowIso,
      timeline: arrayUnion({
        status: nextStatus,
        ambulanceId: uid,
        timestamp: nowIso,
      }),
    });
  };

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
            <Text style={styles.statusText}>🚨 {t("activeEmergency") || "ACTIVE EMERGENCY"}</Text>
          </View>
          <Text style={styles.timeText}>{formatTimeAgo(emergency.timestamp)}</Text>
          {emergency.victimType === "other" && (
            <Text style={styles.victimBadge}>🆘 {t("victimHelpingOther")}</Text>
          )}
          <Text style={styles.callerBadge}>
            🚑 {t("caseStatusLabel")}: {emergency.status || t("statusDispatched")}
          </Text>
          {emergency.assignedAmbulanceId ? (
            <Text style={styles.callerBadge}>
              {t("assignedLabel")}: {isAssignedToMe ? t("you") : emergency.assignedAmbulanceId}
            </Text>
          ) : (
            <Text style={styles.callerBadge}>{t("unassigned")}</Text>
          )}
        </View>

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📢 Update Case Status</Text>
          <View style={styles.infoCard}>
            {AMBULANCE_STATUSES.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.actionStatusBtn, emergency.status === s.key && styles.actionStatusBtnActive]}
                onPress={() => updateCaseStatus(s.key)}
              >
                <Text
                  style={[
                    styles.actionStatusBtnText,
                    emergency.status === s.key && { color: "#FFFFFF" },
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

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
