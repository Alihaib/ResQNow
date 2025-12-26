import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking, Platform, ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useAuth } from "../../../src/context/AuthContext";
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
  const { t: translate } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams<{ locationData?: string }>();
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationDisplay, setLocationDisplay] = useState<string>("");
  const [autoShareEnabled, setAutoShareEnabled] = useState<boolean | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<Contact[]>([]);

  const shareMedicalInfo = async () => {
    if (!user) {
      Alert.alert(translate("error"), "User not logged in");
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
      Alert.alert(translate("error"), "Failed to share medical information");
    }
  };

  useEffect(() => {
    // Load user preferences and emergency contacts
    if (user) {
      loadUserPreferences();
      loadEmergencyContacts();
    }
  }, [user]);

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
        
        // Save location to Firestore for emergency record
        if (user) {
          saveEmergencyLocation(locationData);
        }
      } catch (error) {
        console.error("Error parsing location data:", error);
        setLocationDisplay(translate("locationLoading") || "Loading location...");
      }
    } else {
      setLocationDisplay(translate("locationNotAvailable") || "Location not available");
    }
  }, [params.locationData, user]);

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

  const saveEmergencyLocation = async (locationData: LocationData) => {
    if (!user) return;
    
    try {
      const emergencyRef = doc(db, "emergencies", `${user.uid}_${Date.now()}`);
      await setDoc(emergencyRef, {
        userId: user.uid,
        location: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          address: locationData.address,
        },
        timestamp: locationData.timestamp,
        status: "active",
      });
    } catch (error) {
      console.error("Error saving emergency location:", error);
    }
  };

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
            translate("error") || "Error", 
            translate("locationNotAvailable") || "Location not available. Please wait for location to load."
          );
          return;
        }
      } else {
        Alert.alert(
          translate("error") || "Error", 
          translate("locationNotAvailable") || "Location not available. Please wait for location to load."
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
      const appleMapsLink = `https://maps.apple.com/?ll=${location.latitude},${location.longitude}`;
      
      // Format location message with all available information
      const addressText = location.address || locationDisplay || "Address not available";
      const timestampText = location.timestamp 
        ? new Date(location.timestamp).toLocaleString()
        : new Date().toLocaleString();
      
      const locationMessage = `
🚨 EMERGENCY LOCATION 🚨

📍 Location:
${addressText}

Coordinates:
${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}

🗺️ Open in Maps:
${googleMapsLink}

Time: ${timestampText}

---
Shared from ResQNow Emergency App
      `.trim();

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
              translate("error") || "Error",
              translate("failedToOpenSMS") || "Failed to open SMS app. Opening share dialog instead.",
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
          translate("error") || "Error", 
          translate("failedToShareLocation") || "Failed to share location. Please try again."
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
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(tabs)/emergency");
          }
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

        {/* Medical Info Share */}
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
        <TouchableOpacity style={styles.endBtn} onPress={endEmergency}>
          <Text style={styles.endBtnText}>{translate("endEmergency")}</Text>
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
  endBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});


