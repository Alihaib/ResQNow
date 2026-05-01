import { useLocalSearchParams, useRouter } from "expo-router";
import { arrayUnion, doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking, Platform, ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useAuth } from "../../../src/context/AuthContext";
import { useEmergency } from "../../../src/context/EmergencyContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string | null;
  timestamp: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function ActiveEmergencyScreen() {
  const { user } = useAuth();
  const { currentEmergency } = useEmergency();
  const { t: translate } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams<{ locationData?: string; victimType?: string }>();
  const initialVictimType = params.victimType === "other" ? "other" : "me";
  const victimType = currentEmergency?.victimType ?? initialVictimType;
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationDisplay, setLocationDisplay] = useState<string>("");
  const [autoShareEnabled, setAutoShareEnabled] = useState<boolean | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<Contact[]>([]);
  const [ending, setEnding] = useState(false);
  const [ambulanceLocation, setAmbulanceLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [ambulanceAssigned, setAmbulanceAssigned] = useState(false);

  // Real-time ambulance location from the emergency doc
  useEffect(() => {
    if (!currentEmergency?.id) return;
    const unsub = onSnapshot(doc(db, "emergencies", currentEmergency.id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      setAmbulanceAssigned(!!data.assignedAmbulanceId);
      const loc = data.ambulanceLocation;
      if (loc?.latitude && loc?.longitude) {
        setAmbulanceLocation({ latitude: loc.latitude, longitude: loc.longitude });
      }
    });
    return () => unsub();
  }, [currentEmergency?.id]);

  const mapRegion = useMemo(() => {
    if (!location) return null;
    if (!ambulanceLocation) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    const minLat = Math.min(location.latitude, ambulanceLocation.latitude);
    const maxLat = Math.max(location.latitude, ambulanceLocation.latitude);
    const minLon = Math.min(location.longitude, ambulanceLocation.longitude);
    const maxLon = Math.max(location.longitude, ambulanceLocation.longitude);
    const pad = 0.005;
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(maxLat - minLat + pad, 0.01),
      longitudeDelta: Math.max(maxLon - minLon + pad, 0.01),
    };
  }, [location, ambulanceLocation]);

  const distanceText = useMemo(() => {
    if (!location || !ambulanceLocation) return null;
    const R = 6371000;
    const dLat = ((ambulanceLocation.latitude - location.latitude) * Math.PI) / 180;
    const dLon = ((ambulanceLocation.longitude - location.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((location.latitude * Math.PI) / 180) *
        Math.cos((ambulanceLocation.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const meters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
  }, [location, ambulanceLocation]);

  // Firestore is the source of truth: if the emergency ends in Firestore and
  // the context clears, navigate away from this screen.
  useEffect(() => {
    if (!currentEmergency) {
      // Emergency is no longer active (cancelled/resolved) → exit screen
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/emergency");
      return;
    }
    if (currentEmergency.sessionStatus !== "active") {
      // Extra guard (context usually clears already)
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/emergency");
    }
  }, [currentEmergency?.id, currentEmergency?.sessionStatus]);

  const shareMedicalInfo = async () => {
    if (victimType === "other") return;
    if (!user) {
      Alert.alert(translate("error"), translate("userNotLoggedIn"));
      return;
    }

    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        Alert.alert(translate("error"), "No medical information found");
        return;
      }

      const data = docSnap.data();
      
      // Format medical information for sharing
      const locationInfo = location
        ? `📍 Location: ${location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`}\n`
        : "";
      
      const medicalInfo = `
⛑ ResQNow Medical Information - EMERGENCY

${locationInfo}
👤 Personal Information:
${data.name ? `Name: ${data.name}` : ""}
${data.age ? `Age: ${data.age}` : ""}
${data.bloodType ? `Blood Type: ${data.bloodType}` : ""}
${data.weight ? `Weight: ${data.weight} kg` : ""}
${data.height ? `Height: ${data.height} cm` : ""}

🏥 Medical History:
${data.diseases ? `Diseases: ${data.diseases}` : ""}
${data.medications ? `Medications: ${data.medications}` : ""}
${data.allergies ? `Allergies: ${data.allergies}` : ""}
${data.sensitiveNotes ? `Notes: ${data.sensitiveNotes}` : ""}

📞 Emergency Contacts:
${data.emergencyContacts && data.emergencyContacts.length > 0
  ? data.emergencyContacts.map((c: any) => `${c.name}: ${c.phone}`).join("\n")
  : "No emergency contacts"}

---
Shared from ResQNow App - Emergency Situation
      `.trim();

      await Share.share({
        message: medicalInfo,
        title: translate("shareMedicalProfile"),
      });
    } catch (error) {
      console.error("Error sharing medical info:", error);
      Alert.alert(translate("error"), translate("failedToShareMedicalInfo"));
    }
  };

  useEffect(() => {
    // Load user preferences and emergency contacts
    if (user && victimType === "me") {
      loadUserPreferences();
      loadEmergencyContacts();
    }
  }, [user, victimType]);

  useEffect(() => {
    // Parse location data from params
    if (params.locationData) {
      try {
        const locationData: LocationData = JSON.parse(params.locationData);
        setLocation(locationData);
        
        // Format location for display
        if (locationData.address) {
          setLocationDisplay(locationData.address);
        } else {
          setLocationDisplay(
            `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`
          );
        }
        
      } catch (error) {
        console.error("Error parsing location data:", error);
        setLocationDisplay(translate("locationLoading"));
      }
    } else {
      // If no params, try to restore location from the active emergency doc (global state)
      if (currentEmergency?.id) {
        (async () => {
          try {
            const snap = await getDoc(doc(db, "emergencies", currentEmergency.id));
            if (snap.exists()) {
              const data = snap.data() as any;
              const loc = data.location;
              if (loc?.latitude && loc?.longitude) {
                const restored: LocationData = {
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  accuracy: null,
                  address: loc.address ?? null,
                  timestamp: data.timestamp ?? new Date().toISOString(),
                };
                setLocation(restored);
                setLocationDisplay(
                  restored.address ||
                    `${restored.latitude.toFixed(6)}, ${restored.longitude.toFixed(6)}`
                );
                return;
              }
            }
          } catch (e) {
            console.error("Error restoring emergency location:", e);
          }
          setLocationDisplay(translate("locationNotAvailable"));
        })();
      } else {
        setLocationDisplay(translate("locationNotAvailable"));
      }
    }
  }, [params.locationData, currentEmergency?.id]);

  const loadUserPreferences = async () => {
    if (!user) return;
    
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAutoShareEnabled(data.autoShareLocationToContacts ?? false);
      }
    } catch (error) {
      console.error("Error loading user preferences:", error);
    }
  };

  const loadEmergencyContacts = async () => {
    if (!user) return;
    
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const contacts = data.emergencyContacts || [];
        setEmergencyContacts(contacts);
      }
    } catch (error) {
      console.error("Error loading emergency contacts:", error);
    }
  };

  const requestAutoSharePermission = (): Promise<boolean> => {
    return new Promise((resolve) => {
      Alert.alert(
        translate("shareLocationToContacts") || "Share Location to Emergency Contacts",
        translate("autoShareLocationPermission") || "Allow ResQNow to automatically share your location with your emergency contacts during emergencies?",
        [
          {
            text: translate("cancel") || "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: translate("dontAllow") || "Don't Allow",
            style: "destructive",
            onPress: () => {
              saveAutoSharePermission(false);
              resolve(false);
            },
          },
          {
            text: translate("allow") || "Allow",
            onPress: () => {
              saveAutoSharePermission(true);
              resolve(true);
            },
          },
        ]
      );
    });
  };

  const saveAutoSharePermission = async (enabled: boolean) => {
    if (!user) return;
    
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { autoShareLocationToContacts: enabled },
        { merge: true }
      );
      setAutoShareEnabled(enabled);
    } catch (error) {
      console.error("Error saving auto-share permission:", error);
    }
  };

  const sendLocationToContacts = async (locationMessage: string): Promise<{ success: number; total: number; names: string[] }> => {
    if (!emergencyContacts || emergencyContacts.length === 0) {
      return { success: 0, total: 0, names: [] };
    }

    let successCount = 0;
    const contactNames: string[] = [];
    const totalContacts = emergencyContacts.length;

    // Send SMS to each emergency contact
    for (let i = 0; i < emergencyContacts.length; i++) {
      const contact = emergencyContacts[i];
      try {
        // Format phone number for SMS
        let phoneNumber = contact.phone.replace(/\D/g, "");
        
        // Convert Israeli format to international if needed
        if (phoneNumber.startsWith("0")) {
          phoneNumber = `+972${phoneNumber.substring(1)}`;
        } else if (!phoneNumber.startsWith("+")) {
          phoneNumber = `+${phoneNumber}`;
        }

        // Create SMS URL - format for both iOS and Android
        // Standard format that works on both platforms
        const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(locationMessage)}`;
        
        // Try to open SMS
        try {
          // For multiple contacts, add a delay before opening next SMS dialog
          if (i > 0) {
            // Wait before opening next SMS dialog to avoid conflicts
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          // Check if SMS URL can be opened
          const canOpen = await Linking.canOpenURL(smsUrl);
          if (canOpen) {
            await Linking.openURL(smsUrl);
            successCount++;
            contactNames.push(contact.name);
          } else {
            // Try alternative format for iOS
            if (Platform.OS === "ios") {
              const smsUrlIOS = `sms:${phoneNumber}&body=${encodeURIComponent(locationMessage)}`;
              const canOpenIOS = await Linking.canOpenURL(smsUrlIOS);
              if (canOpenIOS) {
                await Linking.openURL(smsUrlIOS);
                successCount++;
                contactNames.push(contact.name);
              } else {
                console.warn(`Cannot open SMS for ${contact.name}`);
              }
            } else {
              console.warn(`Cannot open SMS for ${contact.name}`);
            }
          }
        } catch (error) {
          console.error(`Error opening SMS for ${contact.name}:`, error);
        }
      } catch (error) {
        console.error(`Error processing contact ${contact.name}:`, error);
        // Continue with next contact even if one fails
      }
    }

    return { success: successCount, total: totalContacts, names: contactNames };
  };

  // NOTE: Emergency documents are created via the SOS flow (startEmergency). This screen is display-only.

  const shareLocation = async () => {
    // Check if we have location data
    if (!location) {
      // Try to get location from params if not set in state
      if (params.locationData) {
        try {
          const locationData: LocationData = JSON.parse(params.locationData);
          setLocation(locationData);
          // Continue with sharing
        } catch (error) {
          Alert.alert(
            translate("error"),
            translate("locationNotAvailableWait")
          );
          return;
        }
      } else {
        Alert.alert(
          translate("error"),
          translate("locationNotAvailableWait")
        );
        return;
      }
    }

    try {
      // Ensure we have valid coordinates
      if (!location || !location.latitude || !location.longitude) {
        Alert.alert(
          translate("error") || "Error",
          translate("locationNotAvailable") || "Location coordinates are not available."
        );
        return;
      }

      // Create map links for different platforms
      const googleMapsLink = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
      
      // Format location message with all available information
      const addressText = location.address || locationDisplay || "Address not available";
      const timestampText = location.timestamp 
        ? new Date(location.timestamp).toLocaleString()
        : new Date().toLocaleString();
      
      const locationMessage =
        victimType === "other"
          ? `
${translate("emergencyAlertTitle")} 🚨
${translate("emergencyAlertSomeoneNeedsHelpAt")}
${googleMapsLink}

${translate("timeLabel")}: ${timestampText}
          `.trim()
          : `
🚨 EMERGENCY LOCATION 🚨

📍 Location:
${addressText}

Coordinates:
${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}

🗺️ ${translate("openInMaps")}:
${googleMapsLink}

${translate("timeLabel")}: ${timestampText}

---
Shared from ResQNow Emergency App
          `.trim();

      // If helping someone else, avoid loading/using contacts or preferences.
      if (victimType === "other") {
        await Share.share({
          message: locationMessage,
          title: translate("shareLocation") || "Share Emergency Location",
        });
        return;
      }

      // Check if we have emergency contacts to share with
      if (emergencyContacts.length === 0) {
        // No emergency contacts - use native share dialog
        await Share.share({
          message: locationMessage,
          title: translate("shareLocation") || "Share Emergency Location",
        });
        return;
      }

      // We have emergency contacts - check permission first
      let shouldAutoShare = autoShareEnabled;
      
      // If permission hasn't been set yet, ask the user
      if (shouldAutoShare === null) {
        shouldAutoShare = await requestAutoSharePermission();
      }

      // If permission is granted, send directly to emergency contacts
      if (shouldAutoShare) {
        try {
          const result = await sendLocationToContacts(locationMessage);
          if (result.success > 0) {
            // Show success message
            Alert.alert(
              translate("locationShared") || "Location Shared",
              translate("locationSentToContacts") || `Location sent to ${result.success} emergency contact(s). Please send each SMS message.`,
              [{ text: translate("ok") || "OK" }]
            );
          } else {
            // Fallback to native share if SMS failed
            Alert.alert(
              translate("error"),
              translate("failedToOpenSMS"),
              [
                { text: translate("cancel") || "Cancel", style: "cancel" },
                {
                  text: translate("share") || "Share",
                  onPress: async () => {
                    await Share.share({
                      message: locationMessage,
                      title: translate("shareLocation") || "Share Emergency Location",
                    });
                  },
                },
              ]
            );
          }
        } catch (error) {
          console.error("Error sending location to contacts:", error);
          // Fallback to native share
          await Share.share({
            message: locationMessage,
            title: translate("shareLocation") || "Share Emergency Location",
          });
        }
      } else {
        // Permission not granted - use native share dialog
        await Share.share({
          message: locationMessage,
          title: translate("shareLocation") || "Share Emergency Location",
        });
      }
    } catch (error: any) {
      console.error("Error sharing location:", error);
      // Only show alert if it's not a user cancellation
      if (error.message !== "User did not share") {
        Alert.alert(
          translate("error"),
          translate("failedToShareLocation")
        );
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const endEmergency = () => {
    Alert.alert(translate("endEmergency"), translate("endEmergencyConfirm"), [
      { text: translate("cancel"), style: "cancel" },
      {
        text: translate("endEmergency"),
        style: "destructive",
        onPress: () => {
          (async () => {
            try {
              if (currentEmergency?.id) {
                setEnding(true);
                await updateDoc(doc(db, "emergencies", currentEmergency.id), {
                  sessionStatus: "cancelled",
                  status: "cancelled",
                  updatedAt: new Date().toISOString(),
                  timeline: arrayUnion({
                    status: "cancelled",
                    timestamp: new Date().toISOString(),
                  }),
                });
                // Do NOT clear local state or navigate yet.
                // Wait for Firestore confirmation via onSnapshot (EmergencyContext).
                console.log("[ActiveEmergency] cancel requested; waiting for Firestore confirmation");
              }
            } catch (e) {
              console.error("Error ending emergency:", e);
              Alert.alert(translate("error"), translate("failedToEndEmergency") || translate("error"));
              setEnding(false);
            } finally {
              // no-op: snapshot drives the final UI state
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusIndicator} />
        <Text style={styles.statusText}>{translate("emergencyActive")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Timer */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>{translate("timeElapsed")}</Text>
          <Text style={styles.timer}>{formatTime(timeElapsed)}</Text>
        </View>

        {/* Victim label */}
        <View style={styles.victimLabelCard}>
          <Text style={styles.victimLabelText}>
            {victimType === "me" ? translate("victimReceivingHelp") : translate("victimHelpingOther")}
          </Text>
        </View>

        {/* Location */}
        <TouchableOpacity 
          style={styles.infoCard}
          onPress={shareLocation}
          activeOpacity={0.7}
        >
          <Text style={styles.infoIcon}>📍</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>{translate("yourLocation") || "Your Location"}</Text>
            <Text style={styles.infoValue}>
              {locationDisplay || translate("locationLoading") || "Loading location..."}
            </Text>
            {location && (
              <Text style={styles.locationCoords}>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
            )}
            <Text style={styles.tapToShare}>
              {translate("tapToShareLocation") || "Tap to share location"}
            </Text>
          </View>
          <Text style={styles.shareIcon}>📤</Text>
        </TouchableOpacity>

        {/* Ambulance Map */}
        {location && (ambulanceAssigned || ambulanceLocation) && (
          <View style={styles.mapCard}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>🚑 {translate("ambulanceOnWay") || "Ambulance On The Way"}</Text>
              {distanceText && (
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>📏 {distanceText}</Text>
                </View>
              )}
            </View>

            {mapRegion ? (
              <MapView
                style={styles.map}
                region={mapRegion}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                  title={translate("yourLocation") || "Your Location"}
                  pinColor="#DC2626"
                />
                {ambulanceLocation && (
                  <Marker
                    coordinate={ambulanceLocation}
                    title={translate("ambulance") || "Ambulance"}
                    pinColor="#1D4ED8"
                  />
                )}
              </MapView>
            ) : null}

            {!ambulanceLocation && (
              <View style={styles.mapWaiting}>
                <Text style={styles.mapWaitingText}>
                  {translate("ambulanceLocating") || "Locating ambulance..."}
                </Text>
              </View>
            )}

            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#DC2626" }]} />
                <Text style={styles.legendLabel}>{translate("you") || "You"}</Text>
              </View>
              {ambulanceLocation && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#1D4ED8" }]} />
                  <Text style={styles.legendLabel}>{translate("ambulance") || "Ambulance"}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>{translate("stayCalmTitle")}</Text>
          <Text style={styles.instructionsText}>
            {translate("helpOnWay")}{'\n'}
            {translate("stayWhereYouAre")}{'\n'}
            {translate("keepPhoneNearby")}{'\n'}
            {translate("followInstructions")}
          </Text>
        </View>

        {/* Medical Info Share (only when victim is the user) */}
        {victimType === "me" && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={shareMedicalInfo}
          >
            <Text style={styles.actionIcon}>📋</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{translate("shareMedicalProfile")}</Text>
              <Text style={styles.actionSubtitle}>{translate("sendMedicalInfo")}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* First Aid */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push("/(tabs)/firstaid")}
        >
          <Text style={styles.actionIcon}>⛑</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>{translate("medical_guides")}</Text>
            <Text style={styles.actionSubtitle}>{translate("getGuidance")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* End Emergency Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.endBtn, ending && styles.endBtnDisabled]} onPress={endEmergency} disabled={ending}>
          <Text style={styles.endBtnText}>
            {ending ? (translate("loading") || "Ending...") : translate("endEmergency")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#DC2626",
  },
  statusBar: {
    backgroundColor: "#DC2626",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
  content: {
    backgroundColor: "#F8F9FA",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 30,
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  victimLabelCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#E9ECEF",
  },
  victimLabelText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#003049",
    textAlign: "center",
  },
  timerLabel: {
    fontSize: 16,
    color: "#6C757D",
    marginBottom: 8,
  },
  timer: {
    fontSize: 64,
    fontWeight: "900",
    color: "#DC2626",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#D62828",
  },
  infoIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: "#6C757D",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 12,
    color: "#6C757D",
    fontFamily: "monospace",
    marginTop: 4,
  },
  tapToShare: {
    fontSize: 12,
    color: "#D62828",
    fontWeight: "600",
    marginTop: 8,
    fontStyle: "italic",
  },
  shareIcon: {
    fontSize: 24,
    marginLeft: 12,
  },
  instructionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 16,
    color: "#212529",
    lineHeight: 28,
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
  chevron: {
    fontSize: 24,
    color: "#6C757D",
  },
  mapCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#1D4ED8",
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#003049",
  },
  distanceBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  distanceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  map: {
    width: "100%",
    height: 200,
  },
  mapWaiting: {
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
  },
  mapWaitingText: {
    fontSize: 14,
    color: "#6C757D",
    fontStyle: "italic",
  },
  mapLegend: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E9ECEF",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 13,
    color: "#6C757D",
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E9ECEF",
  },
  endBtn: {
    backgroundColor: "#6C757D",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  endBtnDisabled: {
    opacity: 0.7,
  },
  endBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});


