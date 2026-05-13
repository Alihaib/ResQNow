import { useLocalSearchParams, useRouter } from "expo-router";
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmergencyChat from "../../../components/EmergencyChat";
import Button from "../../../components/ui/Button";
import SectionHeader from "../../../components/ui/SectionHeader";
import ShortcutCard from "../../../components/ui/ShortcutCard";
import StatusChip from "../../../components/ui/StatusChip";
import {
  ActivityIndicator,
  Alert,
  Linking, Platform, ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useAuth } from "../../../src/context/AuthContext";
import { useEmergency } from "../../../src/context/EmergencyContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";
import { normalizeLifecycleStatus } from "../../../src/emergency/stateMachine";
import { SosSmartFirstAid } from "../../../src/firstAid/SosSmartFirstAid";
import { tokens } from "../../../src/ui/tokens";
import { parseLatLng } from "../../../src/utils/emergencyMapCoords";
import AiEmergencyCompanion from "../../../components/AiEmergencyCompanion";
import { isOpenAiConfigured } from "../../../src/services/openaiEmergency";

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
  const { currentEmergency, liveEmergency, activeEmergencyHydrated } = useEmergency();
  const { t: translate, lang } = useLanguage();
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
  const [aiCompanionVisible, setAiCompanionVisible] = useState(false);
  const aiAvailable = isOpenAiConfigured();
  const ambulanceAssigned = !!liveEmergency?.assignedAmbulanceId;
  /** Crew position — parsed from `liveEmergency.ambulanceLocation` (Firestore via EmergencyContext onSnapshot). */
  const ambulanceCoordsLive = useMemo(
    () => parseLatLng(liveEmergency?.ambulanceLocation),
    [liveEmergency?.ambulanceLocation, liveEmergency?.updatedAt],
  );

  /** Patient scene coords — Firestore `patientLocation` ?? `location` (real-time via EmergencyContext onSnapshot). */
  const patientCoordsLive = useMemo(() => {
    const live = liveEmergency;
    if (!live) return null;
    const pl = live.patientLocation ?? live.location;
    if (
      pl?.latitude != null &&
      pl?.longitude != null &&
      typeof pl.latitude === "number" &&
      typeof pl.longitude === "number"
    ) {
      return { latitude: pl.latitude, longitude: pl.longitude };
    }
    return null;
  }, [liveEmergency]);

  /** Prefer live Firestore patient pin; fall back to locally captured coords from SOS flow. */
  const mapPatientAnchor = patientCoordsLive
    ?? (location
      ? { latitude: location.latitude, longitude: location.longitude }
      : null);

  const lifecycleStatus = liveEmergency?.status
    ? normalizeLifecycleStatus(String(liveEmergency.status))
    : null;
  /** Ignore snapshot ETA in UI once crew has marked arrived (field may still exist on doc). */
  const isAmbulanceArrived = lifecycleStatus === "arrived";

  /** Caller may end session only before crew marks on-scene (dispatched / enRoute). */
  const canCallerCancelEmergency = useMemo(() => {
    if (!liveEmergency || liveEmergency.sessionStatus !== "active") return false;
    const s = normalizeLifecycleStatus(String(liveEmergency.status));
    return s !== "arrived" && s !== "completed" && s !== "cancelled";
  }, [liveEmergency]);

  /** After arrival (or terminal lifecycle while session still active), cancel is blocked. */
  const emergencyLockedAfterArrival = useMemo(() => {
    if (!liveEmergency || liveEmergency.sessionStatus !== "active") return false;
    const s = normalizeLifecycleStatus(String(liveEmergency.status));
    return s === "arrived" || s === "completed";
  }, [liveEmergency]);

  const crewEtaMinutes =
    !isAmbulanceArrived &&
    typeof liveEmergency?.currentSnapshot?.eta === "number" &&
    Number.isFinite(liveEmergency.currentSnapshot.eta)
      ? liveEmergency.currentSnapshot.eta
      : null;

  const ambulanceStatusLine =
    typeof liveEmergency?.currentSnapshot?.ambulanceStatus === "string"
      ? liveEmergency.currentSnapshot.ambulanceStatus.trim() || null
      : null;

  const distanceText = useMemo(() => {
    if (!mapPatientAnchor || !ambulanceCoordsLive) return null;
    const R = 6371000;
    const dLat = ((ambulanceCoordsLive.latitude - mapPatientAnchor.latitude) * Math.PI) / 180;
    const dLon = ((ambulanceCoordsLive.longitude - mapPatientAnchor.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((mapPatientAnchor.latitude * Math.PI) / 180) *
        Math.cos((ambulanceCoordsLive.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const meters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
  }, [mapPatientAnchor, ambulanceCoordsLive]);

  const mapRef = useRef<MapView | null>(null);
  const mainScrollRef = useRef<ScrollView>(null);
  const firstAidSectionYRef = useRef(0);
  const scrollToFirstAidSection = useCallback(() => {
    mainScrollRef.current?.scrollTo({
      y: Math.max(0, firstAidSectionYRef.current - 12),
      animated: true,
    });
  }, []);

  /** Refit viewport when Firestore pushes new patient or ambulance coordinates (same source as markers). */
  useEffect(() => {
    if (!mapPatientAnchor || !mapRef.current) return;
    const coords: { latitude: number; longitude: number }[] = [
      { latitude: mapPatientAnchor.latitude, longitude: mapPatientAnchor.longitude },
    ];
    if (ambulanceCoordsLive) {
      coords.push({
        latitude: ambulanceCoordsLive.latitude,
        longitude: ambulanceCoordsLive.longitude,
      });
    }
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 56, right: 56, bottom: 56, left: 56 },
        animated: true,
      });
    }, 280);
    return () => clearTimeout(timer);
  }, [
    mapPatientAnchor.latitude,
    mapPatientAnchor.longitude,
    ambulanceCoordsLive?.latitude,
    ambulanceCoordsLive?.longitude,
    liveEmergency?.updatedAt,
  ]);

  // Keep on-screen address text aligned with Firestore patient location when it streams in.
  useEffect(() => {
    if (!patientCoordsLive) return;
    const addr =
      liveEmergency?.patientLocation?.address ?? liveEmergency?.location?.address ?? null;
    setLocationDisplay(
      addr ?? `${patientCoordsLive.latitude.toFixed(6)}, ${patientCoordsLive.longitude.toFixed(6)}`,
    );
    setLocation((prev) => ({
      latitude: patientCoordsLive.latitude,
      longitude: patientCoordsLive.longitude,
      accuracy: prev?.accuracy ?? null,
      address: addr ?? prev?.address ?? null,
      timestamp: liveEmergency?.updatedAt ?? prev?.timestamp ?? new Date().toISOString(),
    }));
  }, [
    patientCoordsLive?.latitude,
    patientCoordsLive?.longitude,
    liveEmergency?.updatedAt,
    liveEmergency?.patientLocation?.address,
    liveEmergency?.location?.address,
  ]);

  // Firestore is the source of truth: if the emergency ends in Firestore and
  // the context clears, navigate away from this screen.
  // Wait until at least one sync — otherwise transient null during hydration navigates away incorrectly.
  useEffect(() => {
    if (!activeEmergencyHydrated) return;
    if (!currentEmergency) {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/emergency");
      return;
    }
    if (currentEmergency.sessionStatus !== "active") {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/emergency");
    }
  }, [activeEmergencyHydrated, currentEmergency?.id, currentEmergency?.sessionStatus, router]);

  /** Clear "Ending…" if context drops the doc (cancel confirmed) or after safety timeout. */
  useEffect(() => {
    if (!ending) return;
    if (!liveEmergency) setEnding(false);
  }, [ending, liveEmergency]);

  useEffect(() => {
    if (!ending) return;
    const t = setTimeout(() => setEnding(false), 12000);
    return () => clearTimeout(t);
  }, [ending]);

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
    if (!canCallerCancelEmergency) {
      Alert.alert(
        translate("error") || "Error",
        translate(
          "emergencyLockedAfterArrival",
          "This emergency cannot be cancelled because the ambulance has already arrived or the case is in progress.",
        ),
      );
      return;
    }
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
                console.log("[ActiveEmergency] cancel requested; waiting for Firestore confirmation");
              }
            } catch (e) {
              console.error("Error ending emergency:", e);
              Alert.alert(translate("error"), translate("failedToEndEmergency") || translate("error"));
              setEnding(false);
            }
          })();
        },
      },
    ]);
  };

  /**
   * Build a short, structured context string for the AI companion.
   *
   * IMPORTANT: only public-ish facts from the active session are included.
   * No medical-profile fields, no chat content, no auth identifiers. The
   * service-level system prompt does the actual safety enforcement.
   */
  const aiEmergencyContext = useMemo(() => {
    const lines: string[] = [
      "An emergency is in progress in the ResQNow app.",
      `Language: ${lang === "he" ? "Hebrew" : "English"}.`,
      `Victim: ${victimType === "me" ? "the caller themselves" : "another person nearby"}.`,
    ];
    if (lifecycleStatus) {
      lines.push(`Ambulance lifecycle: ${lifecycleStatus}.`);
    }
    if (crewEtaMinutes != null) {
      lines.push(`Estimated ambulance ETA: ~${crewEtaMinutes} minutes.`);
    } else if (ambulanceAssigned) {
      lines.push("An ambulance has been assigned and is locating the patient.");
    } else {
      lines.push("Ambulance is being dispatched.");
    }
    if (ambulanceStatusLine) {
      lines.push(`Crew status note: ${ambulanceStatusLine}.`);
    }
    if (locationDisplay) {
      lines.push(`Approximate location: ${locationDisplay}.`);
    }
    const snap = liveEmergency?.currentSnapshot;
    if (snap?.symptoms && Array.isArray(snap.symptoms) && snap.symptoms.length) {
      lines.push(`Reported symptoms: ${snap.symptoms.join(", ")}.`);
    }
    if (snap?.conditionLevel) {
      lines.push(`Condition level: ${snap.conditionLevel}.`);
    }

    lines.push("");
    lines.push(
      "Give ONE short first-aid step the bystander can do right now while waiting for the ambulance. Follow your safety rules strictly.",
    );
    return lines.join("\n");
  }, [
    lang,
    victimType,
    lifecycleStatus,
    crewEtaMinutes,
    ambulanceAssigned,
    ambulanceStatusLine,
    locationDisplay,
    liveEmergency?.currentSnapshot,
  ]);

  return (
    <View style={styles.container}>
      {/*
        Hero status header — keeps status + elapsed timer + victim chip
        within a single calm, scannable block at the very top.
      */}
      <View style={styles.statusBar}>
        <View style={styles.statusTopRow}>
          <View style={styles.statusLeft}>
            <View style={styles.statusIndicator} />
            <Text style={styles.statusText}>{translate("emergencyActive")}</Text>
          </View>
          <View style={styles.statusTimerBlock}>
            <Text style={styles.statusTimerLabel}>{translate("timeElapsed")}</Text>
            <Text style={styles.statusTimerValue}>{formatTime(timeElapsed)}</Text>
          </View>
        </View>
        <View style={styles.statusBottomRow}>
          <StatusChip
            label={
              victimType === "me"
                ? translate("victimReceivingHelp")
                : translate("victimHelpingOther")
            }
            bg="rgba(255,255,255,0.18)"
            fg="#FFFFFF"
          />
          {isAmbulanceArrived ? (
            <StatusChip
              label={translate("ambulanceArrivedShort")}
              bg="#FFFFFF"
              fg="#DC2626"
              solid
            />
          ) : crewEtaMinutes != null ? (
            <StatusChip
              label={`ETA ~${crewEtaMinutes} min`}
              bg="rgba(255,255,255,0.95)"
              fg="#B91C1C"
            />
          ) : null}
        </View>
      </View>

      <ScrollView ref={mainScrollRef} contentContainerStyle={styles.content}>
        {/* 1. LOCATION + SHARE — tap to share with emergency contacts. */}
        <TouchableOpacity
          style={styles.infoCard}
          onPress={shareLocation}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.infoIcon}>📍</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>
              {translate("yourLocation") || "Your Location"}
            </Text>
            <Text style={styles.infoValue} numberOfLines={2}>
              {locationDisplay ||
                translate("locationLoading") ||
                "Loading location..."}
            </Text>
            {location ? (
              <Text style={styles.locationCoords}>
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </Text>
            ) : null}
            <View style={styles.shareHintRow}>
              <Text style={styles.shareIcon}>📤</Text>
              <Text style={styles.tapToShare}>
                {translate("tapToShareLocation") || "Tap to share location"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 2. LIVE MAP — see ambulance approach in real time. */}
        {mapPatientAnchor && (
          <View style={styles.mapCard}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>
                🚑{" "}
                {isAmbulanceArrived
                  ? translate("ambulanceArrivedShort")
                  : translate("ambulanceOnWay") || "Ambulance On The Way"}
              </Text>
              {distanceText ? (
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>📏 {distanceText}</Text>
                </View>
              ) : null}
            </View>

            {isAmbulanceArrived ? (
              <View style={styles.etaBannerArrived}>
                <Text style={styles.etaBannerArrivedText}>
                  {translate("ambulanceArrivedBanner")}
                </Text>
              </View>
            ) : crewEtaMinutes != null ? (
              <View style={styles.etaBanner}>
                <Text style={styles.etaBannerText}>
                  {translate("ambulanceArrivingMinutes").replace("{minutes}", String(crewEtaMinutes))}
                </Text>
              </View>
            ) : ambulanceAssigned || ambulanceCoordsLive ? (
              <Text style={styles.etaPending}>
                {translate("ambulanceLocating") || "Locating ambulance…"}
              </Text>
            ) : null}

            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: mapPatientAnchor.latitude,
                longitude: mapPatientAnchor.longitude,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              }}
              scrollEnabled
              zoomEnabled
              pitchEnabled={false}
              rotateEnabled={false}
            >
              {ambulanceCoordsLive ? (
                <Polyline
                  coordinates={[ambulanceCoordsLive, mapPatientAnchor]}
                  strokeColor="#0074D9"
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              ) : null}
              <Marker
                coordinate={mapPatientAnchor}
                title={translate("mapLegendPatient") || "Patient"}
                description={translate("yourLocation") || "Your position"}
                pinColor="#D62828"
              />
              {ambulanceCoordsLive ? (
                <Marker
                  key={`amb-${liveEmergency?.updatedAt ?? ""}-${ambulanceCoordsLive.latitude}-${ambulanceCoordsLive.longitude}`}
                  coordinate={ambulanceCoordsLive}
                  title={translate("mapLegendAmbulance") || "Ambulance"}
                  description={translate("ambulance") || "Ambulance"}
                  pinColor="#0074D9"
                />
              ) : null}
            </MapView>

            {ambulanceAssigned && !ambulanceCoordsLive && crewEtaMinutes == null && !isAmbulanceArrived ? (
              <View style={styles.mapWaiting}>
                <Text style={styles.mapWaitingText}>
                  {translate("ambulanceLocating") || "Locating ambulance..."}
                </Text>
              </View>
            ) : null}

            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#D62828" }]} />
                <Text style={styles.legendLabel}>{translate("mapLegendPatient") || "Patient"}</Text>
              </View>
              {ambulanceCoordsLive ? (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#0074D9" }]} />
                  <Text style={styles.legendLabel}>{translate("mapLegendAmbulance") || "Ambulance"}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Calm reassurance — single short line, low visual weight. */}
        <View style={styles.calmBanner}>
          <Text style={styles.calmBannerText}>
            {translate("stayCalmTitle")} — {translate("helpOnWay")}
          </Text>
        </View>

        {/* 3. CHAT WITH MEDICAL TEAM — talk to the dispatcher / doctor. */}
        {currentEmergency?.id && user?.uid ? (
          <View style={styles.sectionCard}>
            <SectionHeader
              overline={translate("chatTitle", "Communication")}
              title={translate("chatTitle", "Chat with Medical Team")}
            />
            <Text style={styles.sectionHint}>
              {translate(
                "chatPlaceholder",
                "Message the doctor monitoring your case",
              )}
            </Text>
            <EmergencyChat
              emergencyId={currentEmergency.id}
              currentUserId={user.uid}
              currentUserRole="user"
              isActive={currentEmergency.sessionStatus === "active"}
            />
          </View>
        ) : null}

        {/* 4. SMART FIRST-AID GUIDANCE — adaptive triage / steps. */}
        <View
          onLayout={(e) => {
            firstAidSectionYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <SosSmartFirstAid
            lang={lang}
            translate={translate}
            crewEtaMinutes={crewEtaMinutes}
            ambulanceStatusText={ambulanceStatusLine}
            isAmbulanceArrived={isAmbulanceArrived}
            victimType={victimType}
            onScrollToFirstAidSection={scrollToFirstAidSection}
          />
        </View>

        {/*
          5. AI TRIAGE ASSISTANT — opens a structured triage modal.
          When the OpenAI key is missing or the call fails, the modal itself
          falls back to opening the built-in first-aid library, so the button
          is always offered (no silent dead-end).
        */}
        <ShortcutCard
          icon="🩺"
          title={translate("aiTriageButtonTitle", "AI Triage Assistant")}
          subtitle={
            aiAvailable
              ? translate(
                  "aiTriageButtonSub",
                  "Find the right guide and one next action",
                )
              : translate(
                  "aiTriageButtonSubOffline",
                  "Browse first-aid guides (AI unavailable)",
                )
          }
          onPress={() => setAiCompanionVisible(true)}
        />

        {/* 6. MEDICAL INFO SHARE — only when victim is the user. */}
        {victimType === "me" && (
          <ShortcutCard
            icon="📋"
            title={translate("shareMedicalProfile")}
            subtitle={translate("sendMedicalInfo")}
            onPress={shareMedicalInfo}
          />
        )}
      </ScrollView>

      {/*
        AI Triage Assistant modal — fully isolated from SOS dispatch, Firestore
        lifecycle, GPS, chat and role management. It only reads `context` and
        suggests a first-aid guide / next action.
      */}
      <AiEmergencyCompanion
        visible={aiCompanionVisible}
        onClose={() => setAiCompanionVisible(false)}
        context={aiEmergencyContext}
        lang={lang}
        translate={translate}
        onOpenGuide={(guideId) =>
          router.push(`/(tabs)/firstaid/guide/${guideId}`)
        }
        onOpenLibrary={() => router.push("/(tabs)/firstaid")}
      />

      {/* End emergency — only before crew arrival; sync loading vs lifecycle lock */}
      <View style={styles.footer}>
        {!activeEmergencyHydrated ? (
          <View style={styles.footerSyncRow}>
            <ActivityIndicator color="#DC2626" />
            <Text style={styles.footerSyncText}>
              {translate("loading") || "Loading…"}
            </Text>
          </View>
        ) : emergencyLockedAfterArrival ? (
          <View style={styles.footerLocked}>
            <Text style={styles.footerLockedTitle}>
              {translate("emergencyLockedTitle", "Emergency Locked")}
            </Text>
            <Text style={styles.footerLockedBody}>
              {translate(
                "emergencyLockedAfterArrival",
                "This emergency cannot be cancelled because the ambulance has already arrived or the case is in progress.",
              )}
            </Text>
          </View>
        ) : (
          <Button
            variant="neutralDark"
            size="lg"
            fullWidth
            label={
              ending
                ? translate("loading") || "Ending…"
                : translate("endEmergency")
            }
            loading={ending}
            disabled={ending || !canCallerCancelEmergency}
            onPress={endEmergency}
            accessibilityLabel={translate("endEmergency")}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.danger,
  },
  /* Hero status block — red bar at the very top with the elapsed timer.
     Kept compact so the content card below it dominates the screen. */
  statusBar: {
    backgroundColor: tokens.color.danger,
    paddingTop: 56,
    paddingBottom: tokens.space.lg,
    paddingHorizontal: tokens.space.lg,
  },
  statusTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.space.md,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    marginRight: tokens.space.sm,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: tokens.font.bodyLg,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  statusTimerBlock: {
    alignItems: "flex-end",
  },
  statusTimerLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  statusTimerValue: {
    color: "#FFFFFF",
    fontSize: tokens.font.h1,
    fontWeight: "900",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  statusBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.sm,
    flexWrap: "wrap",
  },
  content: {
    backgroundColor: tokens.color.bgPage,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    paddingTop: tokens.space.lg,
    /* Footer overlays the bottom; reserve enough space so the last card
       (Share Medical) is never trapped under it. */
    paddingBottom: 120,
    paddingHorizontal: tokens.space.lg,
  },
  /* Re-usable section card wrapper for any sub-block needing a header. */
  sectionCard: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.lg,
    padding: tokens.space.lg,
    marginBottom: tokens.space.md,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
  },
  sectionHint: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    fontWeight: "600",
    marginBottom: tokens.space.sm,
    marginTop: -tokens.space.xs,
  },
  /* Location / share card — red left bar marks it as the primary share affordance. */
  infoCard: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.lg,
    padding: tokens.space.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: tokens.space.md,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    borderLeftWidth: 3,
    borderLeftColor: tokens.color.danger,
  },
  infoIcon: {
    fontSize: 24,
    marginRight: tokens.space.md,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: tokens.font.overline,
    fontWeight: "900",
    color: tokens.color.textFaint,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: tokens.space.xs,
  },
  infoValue: {
    fontSize: tokens.font.label,
    fontWeight: "800",
    color: tokens.color.textPrimary,
    lineHeight: 20,
  },
  locationCoords: {
    fontSize: tokens.font.overline,
    color: tokens.color.textMuted,
    fontFamily: "monospace",
    marginTop: tokens.space.xs,
  },
  shareHintRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: tokens.space.sm,
    gap: tokens.space.xs,
  },
  shareIcon: { fontSize: 14 },
  tapToShare: {
    fontSize: tokens.font.caption,
    color: tokens.color.danger,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  /* Compact calm reassurance banner. */
  calmBanner: {
    backgroundColor: tokens.color.successBg,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    marginBottom: tokens.space.md,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.successBorder,
  },
  calmBannerText: {
    fontSize: tokens.font.body,
    fontWeight: "800",
    color: tokens.color.successText,
    textAlign: "center",
  },
  mapCard: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.lg,
    marginBottom: tokens.space.md,
    overflow: "hidden",
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
    borderBottomWidth: tokens.hairline,
    borderBottomColor: tokens.color.border,
  },
  mapTitle: {
    fontSize: tokens.font.label,
    fontWeight: "900",
    color: tokens.color.textPrimary,
  },
  distanceBadge: {
    backgroundColor: tokens.color.infoBg,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.infoBorder,
  },
  distanceText: {
    fontSize: tokens.font.bodyLg,
    fontWeight: "700",
    color: tokens.color.info,
  },
  etaBanner: {
    marginHorizontal: tokens.space.md,
    marginBottom: tokens.space.sm,
    backgroundColor: tokens.color.successBg,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.md,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.successBorder,
  },
  etaBannerText: {
    fontSize: tokens.font.label,
    fontWeight: "900",
    color: tokens.color.successText,
    textAlign: "center",
    lineHeight: 22,
  },
  etaPending: {
    marginHorizontal: tokens.space.md,
    marginBottom: tokens.space.sm,
    fontSize: tokens.font.body,
    fontWeight: "700",
    color: tokens.color.textMuted,
    textAlign: "center",
  },
  etaBannerArrived: {
    marginHorizontal: tokens.space.md,
    marginBottom: tokens.space.sm,
    backgroundColor: "#DCFCE7",
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.md,
    borderWidth: tokens.hairline,
    borderColor: "#86EFAC",
  },
  etaBannerArrivedText: {
    fontSize: tokens.font.label,
    fontWeight: "900",
    color: "#166534",
    textAlign: "center",
    lineHeight: 22,
  },
  /* Reduced map height — important context, but the chat / triage actions
     below it deserve equal weight on the screen. */
  map: {
    width: "100%",
    height: 180,
  },
  mapWaiting: {
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.bgSubtle,
  },
  mapWaitingText: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textMuted,
    fontStyle: "italic",
  },
  mapLegend: {
    flexDirection: "row",
    gap: tokens.space.lg,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderTopWidth: tokens.hairline,
    borderTopColor: tokens.color.border,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: tokens.font.body,
    color: tokens.color.textMuted,
    fontWeight: "600",
  },
  /* Sticky bottom action bar — calm but accessible. */
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.color.bgSurface,
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.md,
    paddingBottom: tokens.space.xl,
    borderTopWidth: tokens.hairline,
    borderTopColor: tokens.color.border,
  },
  footerSyncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: tokens.space.md,
  },
  footerSyncText: {
    marginLeft: tokens.space.md,
    color: tokens.color.textSecondary,
    fontSize: tokens.font.bodyLg,
    fontWeight: "700",
  },
  footerLocked: {
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.xs,
  },
  footerLockedTitle: {
    color: tokens.color.textPrimary,
    fontSize: tokens.font.bodyLg,
    fontWeight: "900",
    marginBottom: tokens.space.xs,
    textAlign: "center",
  },
  footerLockedBody: {
    color: tokens.color.textMuted,
    fontSize: tokens.font.caption,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
});


