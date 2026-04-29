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
  View,
} from "react-native";
import { useEmergency } from "../../src/context/EmergencyContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { theme } from "../../src/ui/theme";

export default function EmergencyScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const {
    isEmergencyActive,
    startingEmergency,
    startEmergency,
    navigateToActiveEmergency,
  } = useEmergency();
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
      Alert.alert(t("error"), t("locationNotAvailable"));
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
      Alert.alert(t("error"), t("failedToStartEmergency"));
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
      if (status !== "granted") {
        Alert.alert(t("error"), t("locationPermissionDenied"));
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
          <Text style={styles.overlayQuestion}>{t("sosWhoNeedsHelp")}</Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.overlayPrimaryBtn}
              onPress={() => proceedToActiveEmergency("me")}
            >
              <Text style={styles.overlayPrimaryText}>{t("sosMe")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.overlaySecondaryBtn}
              onPress={() => proceedToActiveEmergency("other")}
            >
              <Text style={styles.overlaySecondaryText}>
                {t("sosSomeoneElse")}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.cancelOverlayBtn}
            onPress={cancelEmergency}
          >
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
            {isEmergencyActive ? t("emergencyActiveShort") : `🚨 ${t("sos")}`}
          </Text>
          <Text style={styles.emergencySubtext}>
            {isEmergencyActive
              ? t("tapToViewActiveEmergency")
              : sosBusy || startingEmergency
                ? t("loading") || t("pleaseWait")
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
              <Text style={styles.actionSubtitle}>
                {t("medical_guides_desc")}
              </Text>
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
    backgroundColor: theme.colors.bg,
  },
  content: {
    paddingTop: 60,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: theme.spacing.xxl,
  },
  logo: {
    fontSize: 60,
    marginBottom: theme.spacing.sm,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  emergencyBtn: {
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.lg,
    padding: 32,
    alignItems: "center",
    marginBottom: theme.spacing.xxl,
    ...theme.shadow.primary,
  },
  emergencyBtnActive: {
    backgroundColor: theme.colors.dangerDark,
  },
  emergencyBtnDisabled: {
    opacity: 0.7,
  },
  emergencyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emergencyText: {
    color: theme.colors.surface,
    fontSize: 28,
    fontWeight: "900",
    marginBottom: theme.spacing.sm,
  },
  emergencySubtext: {
    color: theme.colors.surface,
    fontSize: 16,
    opacity: 0.9,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  instructionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  instructionText: {
    fontSize: 16,
    color: "#212529",
    marginBottom: theme.spacing.md,
    lineHeight: 24,
  },
  actionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  actionIcon: {
    fontSize: 32,
    marginRight: theme.spacing.lg,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  chevron: {
    fontSize: 24,
    color: theme.colors.textMuted,
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: theme.colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xxl,
  },
  overlayQuestion: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.colors.surface,
    marginBottom: theme.spacing.xxl,
    textAlign: "center",
  },
  buttonsContainer: {
    width: "100%",
    marginBottom: 40,
    gap: 16,
  },
  overlayPrimaryBtn: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  overlayPrimaryText: {
    color: theme.colors.danger,
    fontSize: 20,
    fontWeight: "900",
  },
  overlaySecondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  overlaySecondaryText: {
    color: theme.colors.surface,
    fontSize: 20,
    fontWeight: "900",
  },
  cancelOverlayBtn: {
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: theme.radius.sm,
  },
  cancelOverlayText: {
    color: theme.colors.surface,
    fontSize: 18,
    fontWeight: "700",
  },
});
