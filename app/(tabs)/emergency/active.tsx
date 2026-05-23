import { useLocalSearchParams, useRouter } from "expo-router";
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AiEmergencyActionsGrid,
  AiFloatingHeader,
  AiHeroSection,
  AiVoiceDock,
  AmbientMapBackground,
  GlassSurface,
  type EmergencyAction,
  type HeroChip,
} from "../../../components/ai-emergency";
import { AI_RADIUS } from "../../../components/ai-emergency/theme";
import EmergencyChat from "../../../components/EmergencyChat";
import AiEmergencyCompanion from "../../../components/AiEmergencyCompanion";
import Button from "../../../components/ui/Button";
import CollapsibleSection from "../../../components/ui/CollapsibleSection";
import MapPanel from "../../../components/ui/MapPanel";
import ShortcutCard from "../../../components/ui/ShortcutCard";
import {
  ActivityIndicator,
  Alert,
  Linking, Platform, ScrollView,
  Share,
  StyleSheet,
  Text,
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
import { isOpenAiConfigured } from "../../../src/services/openaiEmergency";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUiDirection } from "../../../components/ui/layout";

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
  const { row } = useUiDirection();
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
  const chatSectionYRef = useRef(0);
  const firstAidSectionYRef = useRef(0);
  const insets = useSafeAreaInsets();
  const [moreHelpOpen, setMoreHelpOpen] = useState(false);

  const scrollToFirstAidSection = useCallback(() => {
    setMoreHelpOpen(true);
    setTimeout(() => {
      mainScrollRef.current?.scrollTo({
        y: Math.max(0, firstAidSectionYRef.current - 8),
        animated: true,
      });
    }, 120);
  }, []);

  const scrollToChatSection = useCallback(() => {
    setTimeout(() => {
      mainScrollRef.current?.scrollTo({
        y: Math.max(0, chatSectionYRef.current - 8),
        animated: true,
      });
    }, 120);
  }, []);

  const lifecycleLabel = useMemo(() => {
    if (!lifecycleStatus) return translate("helpOnTheWay");
    const key = `activityEvent_${lifecycleStatus}`;
    const label = translate(key);
    return label !== key ? label : translate("helpOnTheWay");
  }, [lifecycleStatus, translate]);

  const statusChipVariant = useMemo(() => {
    if (isAmbulanceArrived) return "success" as const;
    if (lifecycleStatus === "cancelled") return "danger" as const;
    if (ambulanceAssigned) return "info" as const;
    return "warning" as const;
  }, [isAmbulanceArrived, lifecycleStatus, ambulanceAssigned]);

  const openPrimaryContacts = useCallback(() => {
    if (victimType !== "me" || emergencyContacts.length === 0) {
      scrollToChatSection();
      return;
    }
    const first = emergencyContacts.find((c) => c.phone?.trim());
    if (!first) {
      scrollToChatSection();
      return;
    }
    let phoneNumber = first.phone.replace(/\D/g, "");
    if (phoneNumber.startsWith("0")) {
      phoneNumber = `+972${phoneNumber.substring(1)}`;
    } else if (!phoneNumber.startsWith("+")) {
      phoneNumber = `+${phoneNumber}`;
    }
    Linking.openURL(`tel:${phoneNumber}`).catch(() => scrollToChatSection());
  }, [victimType, emergencyContacts, scrollToChatSection]);

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
    mapPatientAnchor?.latitude,
    mapPatientAnchor?.longitude,
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
        ? `${translate("shareLocation")}: ${location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`}\n`
        : "";

      const medicalInfo = `
${translate("appName")} — ${translate("shareMedicalProfile")}

${locationInfo}
${translate("personalInformation")}:
${data.name ? `${translate("name")}: ${data.name}` : ""}
${data.age ? `${translate("age")}: ${data.age}` : ""}
${data.bloodType ? `${translate("blood_type")}: ${data.bloodType}` : ""}
${data.weight ? `${translate("weight")}: ${data.weight} kg` : ""}
${data.height ? `${translate("height")}: ${data.height} cm` : ""}

${translate("medicalHistory")}:
${data.diseases ? `${translate("diseases")}: ${data.diseases}` : ""}
${data.medications ? `${translate("medications")}: ${data.medications}` : ""}
${data.allergies ? `${translate("allergies")}: ${data.allergies}` : ""}
${data.sensitiveNotes ? `${translate("sensitive_notes")}: ${data.sensitiveNotes}` : ""}

${translate("emergencyContacts")}:
${data.emergencyContacts && data.emergencyContacts.length > 0
  ? data.emergencyContacts.map((c: any) => `${c.name}: ${c.phone}`).join("\n")
  : translate("noEmergencyContacts")}

---
${translate("appName")}
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
${translate("emergencyAlertTitle")}
${translate("emergencyAlertSomeoneNeedsHelpAt")}
${googleMapsLink}

${translate("timeLabel")}: ${timestampText}
          `.trim()
          : `
${translate("emergencyAlertTitle")}

${translate("shareLocation")}:
${addressText}

${translate("coordinates")}:
${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}

${translate("openInMaps")}:
${googleMapsLink}

${translate("timeLabel")}: ${timestampText}

---
${translate("appName")}
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

  const primaryIsCall =
    victimType === "me" && emergencyContacts.some((c) => c.phone?.trim());

  const aiHeroStatusLine = useMemo(() => {
    if (isAmbulanceArrived) {
      return translate("ambulanceArrivedBanner", "Ambulance has arrived");
    }
    if (lifecycleStatus === "enRoute" || lifecycleStatus === "dispatched") {
      return translate("aiStatusDispatched", "Ambulance dispatched — stay calm");
    }
    if (ambulanceAssigned) {
      return translate("aiStatusMonitoring", "Monitoring your emergency in real time");
    }
    return translate("aiStatusGuidance", "Guiding you until help arrives");
  }, [isAmbulanceArrived, lifecycleStatus, ambulanceAssigned, translate]);

  const statusSubtitle = useMemo(() => {
    const parts: string[] = [];
    if (ambulanceStatusLine) {
      parts.push(`${translate("responderStatus")}: ${ambulanceStatusLine}`);
    } else if (ambulanceAssigned) {
      parts.push(translate("ambulanceOnWay"));
    } else {
      parts.push(translate("ambulanceLocating"));
    }
    if (distanceText) {
      parts.push(`${translate("distanceToScene")}: ${distanceText}`);
    }
    parts.push(`${translate("timeElapsed")}: ${formatTime(timeElapsed)}`);
    return parts.join(" · ");
  }, [
    ambulanceStatusLine,
    ambulanceAssigned,
    distanceText,
    timeElapsed,
    translate,
  ]);

  const heroChips: HeroChip[] = useMemo(
    () => [
      {
        id: "vitals",
        label: translate("aiChipVitals", "Check Vitals"),
        icon: "pulse-outline",
        onPress: scrollToFirstAidSection,
      },
      {
        id: "eta",
        label: translate("aiChipEta", "Ambulance ETA"),
        icon: "time-outline",
        onPress: () => {
          mainScrollRef.current?.scrollTo({ y: 0, animated: true });
        },
      },
      {
        id: "location",
        label: translate("shareLocation"),
        icon: "location-outline",
        onPress: shareLocation,
      },
      {
        id: "dispatcher",
        label: translate("aiChipDispatcher", "Call Dispatcher"),
        icon: "call-outline",
        onPress: primaryIsCall ? openPrimaryContacts : scrollToChatSection,
      },
    ],
    [
      translate,
      scrollToFirstAidSection,
      shareLocation,
      primaryIsCall,
      openPrimaryContacts,
      scrollToChatSection,
    ],
  );

  const quickActions: EmergencyAction[] = useMemo(
    () => [
      {
        id: "cpr",
        title: translate("aiActionCpr", "CPR Guide"),
        icon: "heart-circle-outline",
        accent: tokens.color.danger,
        onPress: () => router.push("/(tabs)/firstaid/guide/breathing_cpr_overview"),
      },
      {
        id: "breathing",
        title: translate("aiActionBreathing", "Breathing Help"),
        icon: "fitness-outline",
        accent: tokens.color.aiBlue,
        onPress: () => router.push("/(tabs)/firstaid/category/breathing"),
      },
      {
        id: "bleeding",
        title: translate("aiActionBleeding", "Bleeding Control"),
        icon: "water-outline",
        accent: tokens.color.danger,
        onPress: () => router.push("/(tabs)/firstaid/guide/bleeding_basic"),
      },
      {
        id: "heart",
        title: translate("aiActionHeart", "Heart Symptoms"),
        icon: "medical-outline",
        accent: "#BE123C",
        onPress: () => router.push("/(tabs)/firstaid/category/cardiac"),
      },
      {
        id: "medical-id",
        title: translate("shareMedicalProfile"),
        icon: "id-card-outline",
        accent: tokens.color.primary,
        onPress: shareMedicalInfo,
      },
      {
        id: "ambulance",
        title: translate("aiActionAmbulance", "Call Ambulance"),
        subtitle: translate("aiActionAmbulanceSub", "Response team & contacts"),
        icon: "call-outline",
        accent: tokens.color.primary,
        onPress: primaryIsCall ? openPrimaryContacts : scrollToChatSection,
        wide: true,
      },
    ],
    [
      translate,
      router,
      shareMedicalInfo,
      primaryIsCall,
      openPrimaryContacts,
      scrollToChatSection,
    ],
  );

  const responderHeroLine = useMemo(() => {
    if (ambulanceStatusLine) {
      return `${translate("responderStatus")}: ${ambulanceStatusLine}`;
    }
    if (isAmbulanceArrived) return translate("ambulanceArrivedShort", "Ambulance arrived");
    if (ambulanceAssigned) return translate("ambulanceOnWay");
    return translate("ambulanceLocating");
  }, [ambulanceStatusLine, isAmbulanceArrived, ambulanceAssigned, translate]);

  const filteredQuickActions = useMemo(
    () =>
      quickActions.filter((a) => a.id !== "medical-id" || victimType === "me"),
    [quickActions, victimType],
  );

  return (
    <View style={styles.container}>
      <AmbientMapBackground patientAnchor={mapPatientAnchor} />

      <ScrollView
        ref={mainScrollRef}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + tokens.space.md,
            paddingBottom: 200 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AiFloatingHeader
          statusLabel={lifecycleLabel}
          chipVariant={statusChipVariant}
          aiActive={aiCompanionVisible || aiAvailable}
          subtitle={statusSubtitle}
        />

        <AiHeroSection
          statusLine={aiHeroStatusLine}
          subtitle={translate("helpOnTheWay")}
          etaMinutes={!isAmbulanceArrived ? crewEtaMinutes : null}
          etaLabel={translate("etaLabel")}
          etaUnit={translate("etaMinutesUnit")}
          responderLine={responderHeroLine}
          chips={heroChips}
          aiListening={aiCompanionVisible}
        />

        {mapPatientAnchor ? (
          <GlassSurface radius={AI_RADIUS.card} style={styles.mapGlass}>
            <MapPanel height={168} style={styles.mapPanel}>
              <MapView
                ref={mapRef}
                style={styles.mapFill}
                initialRegion={{
                  latitude: mapPatientAnchor.latitude,
                  longitude: mapPatientAnchor.longitude,
                  latitudeDelta: 0.014,
                  longitudeDelta: 0.014,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                {ambulanceCoordsLive ? (
                  <Polyline
                    coordinates={[ambulanceCoordsLive, mapPatientAnchor]}
                    strokeColor={tokens.color.aiBlue}
                    strokeWidth={3}
                    lineCap="round"
                  />
                ) : null}
                <Marker coordinate={mapPatientAnchor} pinColor={tokens.color.danger} />
                {ambulanceCoordsLive ? (
                  <Marker coordinate={ambulanceCoordsLive} pinColor={tokens.color.aiBlue} />
                ) : null}
              </MapView>
            </MapPanel>
          </GlassSurface>
        ) : null}

        <AiEmergencyActionsGrid
          title={translate("aiQuickActions", "Quick emergency actions")}
          actions={filteredQuickActions}
        />

        <CollapsibleSection
          title={translate("moreHelp")}
          subtitle={translate("getGuidance")}
          expanded={moreHelpOpen}
          onExpandedChange={setMoreHelpOpen}
        >
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

          <ShortcutCard
            ionIcon="medkit-outline"
            title={translate("aiTriageButtonTitle")}
            subtitle={
              aiAvailable
                ? translate("aiTriageButtonSub")
                : translate("aiTriageButtonSubOffline")
            }
            onPress={() => setAiCompanionVisible(true)}
          />
        </CollapsibleSection>

        {currentEmergency?.id && user?.uid ? (
          <View
            onLayout={(e) => {
              chatSectionYRef.current = e.nativeEvent.layout.y;
            }}
            style={styles.chatSection}
          >
            <EmergencyChat
              emergencyId={currentEmergency.id}
              currentUserId={user.uid}
              currentUserRole="user"
              isActive={currentEmergency.sessionStatus === "active"}
              variant="premium"
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.dockLayer} pointerEvents="box-none">
        <AiVoiceDock
          onMicPress={() => setAiCompanionVisible(true)}
          onOpenAi={() => setAiCompanionVisible(true)}
          listening={aiCompanionVisible}
          hint={translate("aiVoiceHint", "Tap to speak with AI triage assistant")}
          micLabel={translate("aiTriageButtonTitle")}
        />
      </View>

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
          <View style={[styles.footerSyncRow, row]}>
            <ActivityIndicator color={tokens.color.primary} />
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
            variant="ghost"
            size="md"
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
    backgroundColor: tokens.color.aiBgSoft,
  },
  content: {
    paddingHorizontal: tokens.space.lg,
    gap: tokens.space.sm,
  },
  mapGlass: {
    marginBottom: tokens.space.lg,
    overflow: "hidden",
  },
  mapPanel: {
    marginBottom: 0,
    height: 168,
    borderRadius: AI_RADIUS.card - 4,
    overflow: "hidden",
  },
  mapFill: {
    width: "100%",
    height: "100%",
  },
  chatSection: {
    marginBottom: tokens.space.lg,
  },
  dockLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 88,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.md,
    paddingBottom: tokens.space.xl,
    borderTopWidth: tokens.hairline,
    borderTopColor: tokens.color.border,
  },
  footerSyncRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: tokens.space.md,
    gap: tokens.space.md,
  },
  footerSyncText: {
    color: tokens.color.textSecondary,
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
  },
  footerLocked: {
    paddingVertical: tokens.space.sm,
  },
  footerLockedTitle: {
    color: tokens.color.textPrimary,
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    marginBottom: tokens.space.xs,
    textAlign: "center",
  },
  footerLockedBody: {
    color: tokens.color.textMuted,
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.medium,
    textAlign: "center",
    lineHeight: 18,
  },
});


