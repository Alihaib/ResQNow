import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useEmergency } from "../../src/context/EmergencyContext";
import { useLanguage } from "../../src/context/LanguageContext";

export default function EmergencyScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const { isEmergencyActive, startingEmergency, startEmergency, navigateToActiveEmergency } =
    useEmergency();
  const [sosBusy, setSosBusy] = useState(false);

  // SOS victim selection overlay state
  const [isVictimSelectOpen, setIsVictimSelectOpen] = useState(false);

  const locationDataRef = useRef<any>(null);

  const proceedToActiveEmergency = async (type: "me" | "other") => {
    setIsVictimSelectOpen(false);
    if (isEmergencyActive) {
      navigateToActiveEmergency();
      return;
    }

    const loc = locationDataRef.current;
    if (!loc?.latitude || !loc?.longitude) {
      Alert.alert(t("error") || "Error", t("locationNotAvailable") || "Location not available");
      return;
    }

    try {
      await startEmergency({
        victimType: type,
        location: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: loc.address ?? null,
        },
        timestamp: loc.timestamp,
      });
      navigateToActiveEmergency();
    } catch {
      Alert.alert(t("error") || "Error", "Failed to start emergency. Please try again.");
    }
  };

  const handleEmergencyPress = async () => {
    // Global guard: prevent multiple SOS triggers
    if (isEmergencyActive) {
      navigateToActiveEmergency();
      return;
    }
    if (isVictimSelectOpen || sosBusy || startingEmergency) return;
    locationDataRef.current = null;
    setSosBusy(true);

    // Fetch location first — countdown starts only after location is ready
    // (mirrors original behaviour so location is always available on navigate)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t("error") || "Permission Denied",
          t("locationPermissionDenied") || "Location permission is required for emergency services."
        );
      } else {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        try {
          const [address] = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });

          locationDataRef.current = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            address: address
              ? `${address.street || ""} ${address.streetNumber || ""}, ${address.city || ""}, ${address.country || ""}`.trim()
              : null,
            timestamp: new Date().toISOString(),
          };
        } catch (geocodeError) {
          locationDataRef.current = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            address: null,
            timestamp: new Date().toISOString(),
          };
        }
      }
    } catch (error) {
      console.error("Error getting location:", error);
    } finally {
      setSosBusy(false);
    }

    // Show victim selection overlay only after location is ready (or failed)
    setIsVictimSelectOpen(true);
  };

  const cancelEmergency = () => {
    setIsVictimSelectOpen(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* SOS Victim Selection Overlay */}
      <Modal
        visible={isVictimSelectOpen}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.overlayContainer}>
          <Text style={styles.overlayQuestion}>Who needs help?</Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.overlayPrimaryBtn}
              onPress={() => proceedToActiveEmergency("me")}
            >
              <Text style={styles.overlayPrimaryText}>👤 Me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.overlaySecondaryBtn}
              onPress={() => proceedToActiveEmergency("other")}
            >
              <Text style={styles.overlaySecondaryText}>🆘 Someone else</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelOverlayBtn} onPress={cancelEmergency}>
            <Text style={styles.cancelOverlayText}>{t("cancel")}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <View style={styles.header}>
        <Text style={styles.logo}>🚨</Text>
        <Text style={styles.title}>{t("emergencyTitle")}</Text>
        <Text style={styles.subtitle}>{t("emergencySubtitle")}</Text>
      </View>

      <>
        {/* Emergency Button */}
        <TouchableOpacity
          style={[
            styles.emergencyBtn,
            isEmergencyActive && styles.emergencyBtnActive,
            (sosBusy || startingEmergency) && styles.emergencyBtnDisabled,
          ]}
          onPress={handleEmergencyPress}
          disabled={sosBusy || startingEmergency}
        >
          <Text style={styles.emergencyIcon}>🚨</Text>
          <Text style={styles.emergencyText}>
            {isEmergencyActive ? "Emergency Active" : "🚨 SOS"}
          </Text>
          <Text style={styles.emergencySubtext}>
            {isEmergencyActive
              ? "Tap to view active emergency"
              : sosBusy || startingEmergency
                ? (t("loading") || "Please wait…")
                : t("tapForHelp")}
          </Text>
        </TouchableOpacity>

          {/* Emergency Instructions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("beforeEmergency")}</Text>
            <View style={styles.instructionCard}>
              <Text style={styles.instructionText}>✓ {t("stayCalm")}</Text>
              <Text style={styles.instructionText}>✓ {t("checkLocation")}</Text>
              <Text style={styles.instructionText}>✓ {t("ensureSafety")}</Text>
              <Text style={styles.instructionText}>✓ {t("haveMedicalInfo")}</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("quickActions")}</Text>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/(tabs)/firstaid")}
            >
              <Text style={styles.actionIcon}>⛑</Text>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{t("medical_guides")}</Text>
                <Text style={styles.actionSubtitle}>{t("medical_guides_desc")}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Text style={styles.actionIcon}>📋</Text>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{t("medicalProfile")}</Text>
                <Text style={styles.actionSubtitle}>{t("personal_info")}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
      </>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  content: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    fontSize: 60,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#003049",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6C757D",
    textAlign: "center",
  },
  emergencyBtn: {
    backgroundColor: "#DC2626",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    marginBottom: 30,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emergencyBtnActive: {
    backgroundColor: "#991B1B",
  },
  emergencyBtnDisabled: {
    opacity: 0.7,
  },
  emergencyIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  emergencyText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 8,
  },
  emergencySubtext: {
    color: "#FFFFFF",
    fontSize: 16,
    opacity: 0.9,
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
  instructionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionText: {
    fontSize: 16,
    color: "#212529",
    marginBottom: 12,
    lineHeight: 24,
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
  overlayContainer: {
    flex: 1,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  overlayQuestion: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 32,
    textAlign: "center",
  },
  buttonsContainer: {
    width: "100%",
    marginBottom: 40,
    gap: 16,
  },
  overlayPrimaryBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  overlayPrimaryText: {
    color: "#DC2626",
    fontSize: 20,
    fontWeight: "900",
  },
  overlaySecondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  overlaySecondaryText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  cancelOverlayBtn: {
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  cancelOverlayText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});


