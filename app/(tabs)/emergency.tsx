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
  const permissionStatusRef = useRef<string | null>(null);

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
      const result = await startEmergency({
        victimType: type,
        location: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: loc.address ?? null,
        },
        timestamp: loc.timestamp,
        locationPermissionStatus: permissionStatusRef.current ?? "unknown",
      });
      if (result.ok) {
        navigateToActiveEmergency();
        return;
      }
      if (result.reason === "already_active") {
        navigateToActiveEmergency();
        return;
      }
      Alert.alert(t("error"), result.message || t("failedToStartEmergency"));
    } catch {
      Alert.alert(t("error"), t("failedToStartEmergency"));
    }
  };

  const handleEmergencyPress = async () => {
    if (isEmergencyActive) {
      navigateToActiveEmergency();
      return;
    }
    if (isVictimSelectOpen || sosBusy || startingEmergency) return;
    locationDataRef.current = null;
    setSosBusy(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log("[SOS][UI] location permission status:", status);
      permissionStatusRef.current = status;
      if (status !== "granted") {
        Alert.alert(t("error"), t("locationPermissionDenied"));
      } else {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        console.log("[SOS][UI] location fix:", {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
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
          console.warn("[SOS][UI] reverseGeocode failed:", geocodeError);
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

    setIsVictimSelectOpen(true);
  };

  const cancelEmergency = () => {
    setIsVictimSelectOpen(false);
  };

  const busy = sosBusy || startingEmergency;
  const sosLabel = isEmergencyActive
    ? t("emergencyActiveShort")
    : busy
      ? t("loading", "Preparing…")
      : t("sos");
  const sosSubLabel = isEmergencyActive
    ? t("tapToViewActiveEmergency")
    : busy
      ? t("gettingLocation", "Getting your location…")
      : t("tapForHelp");

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
          <View style={styles.overlayBadge}>
            <Text style={styles.overlayBadgeText}>SOS</Text>
          </View>
          <Text style={styles.overlayQuestion}>{t("sosWhoNeedsHelp")}</Text>
          <Text style={styles.overlayHint}>
            {t("tapForHelp", "Tap an option to send your SOS.")}
          </Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.overlayPrimaryBtn}
              onPress={() => proceedToActiveEmergency("me")}
              activeOpacity={0.9}
            >
              <Text style={styles.overlayPrimaryText}>{t("sosMe")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.overlaySecondaryBtn}
              onPress={() => proceedToActiveEmergency("other")}
              activeOpacity={0.9}
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

      {/* Hero / Title */}
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>{t("tab_emergency", "EMERGENCY")}</Text>
        </View>
        <Text style={styles.title}>{t("emergencyTitle")}</Text>
        <Text style={styles.subtitle}>{t("emergencySubtitle")}</Text>
      </View>

      {/* PRIMARY: huge red SOS button — the single most important action. */}
      <TouchableOpacity
        style={[
          styles.sosBtn,
          isEmergencyActive && styles.sosBtnActive,
          busy && styles.sosBtnDisabled,
        ]}
        onPress={handleEmergencyPress}
        disabled={busy}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={String(sosLabel)}
      >
        <View style={styles.sosRing}>
          <Text style={styles.sosIcon}>🚨</Text>
        </View>
        <Text style={styles.sosLabel}>{sosLabel}</Text>
        <Text style={styles.sosSubLabel}>{sosSubLabel}</Text>
      </TouchableOpacity>

      {/* Reassurance / Checklist — quieter card */}
      <View style={styles.calmCard}>
        <Text style={styles.calmTitle}>{t("beforeEmergency")}</Text>
        <View style={styles.calmRow}>
          <Text style={styles.calmIcon}>✓</Text>
          <Text style={styles.calmText}>{t("stayCalm")}</Text>
        </View>
        <View style={styles.calmRow}>
          <Text style={styles.calmIcon}>✓</Text>
          <Text style={styles.calmText}>{t("checkLocation")}</Text>
        </View>
        <View style={styles.calmRow}>
          <Text style={styles.calmIcon}>✓</Text>
          <Text style={styles.calmText}>{t("ensureSafety")}</Text>
        </View>
        <View style={styles.calmRow}>
          <Text style={styles.calmIcon}>✓</Text>
          <Text style={styles.calmText}>{t("haveMedicalInfo")}</Text>
        </View>
      </View>

      {/* Secondary actions — smaller, lower visual weight than SOS button. */}
      <Text style={styles.sectionLabel}>{t("quickActions")}</Text>
      <TouchableOpacity
        style={styles.shortcutCard}
        onPress={() => router.push("/(tabs)/firstaid")}
        activeOpacity={0.85}
      >
        <Text style={styles.shortcutIcon}>⛑</Text>
        <View style={styles.shortcutContent}>
          <Text style={styles.shortcutTitle}>{t("medical_guides")}</Text>
          <Text style={styles.shortcutSub} numberOfLines={1}>
            {t("medical_guides_desc")}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.shortcutCard}
        onPress={() => router.push("/(tabs)/profile")}
        activeOpacity={0.85}
      >
        <Text style={styles.shortcutIcon}>📋</Text>
        <View style={styles.shortcutContent}>
          <Text style={styles.shortcutTitle}>{t("medicalProfile")}</Text>
          <Text style={styles.shortcutSub} numberOfLines={1}>
            {t("personal_info")}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  content: {
    paddingTop: 64,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  hero: {
    alignItems: "center",
    marginBottom: 24,
  },
  heroBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: "#B91C1C",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  sosBtn: {
    backgroundColor: "#DC2626",
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  sosBtnActive: { backgroundColor: "#991B1B" },
  sosBtnDisabled: { opacity: 0.75 },
  sosRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.32)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  sosIcon: { fontSize: 56 },
  sosLabel: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 6,
  },
  sosSubLabel: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  calmCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 24,
  },
  calmTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.4,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  calmRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  calmIcon: {
    color: "#16A34A",
    fontSize: 16,
    fontWeight: "900",
    width: 18,
  },
  calmText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "600",
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: "uppercase",
  },
  shortcutCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  shortcutIcon: { fontSize: 24 },
  shortcutContent: { flex: 1 },
  shortcutTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  shortcutSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  chevron: { fontSize: 22, color: "#94A3B8", fontWeight: "700" },
  overlayContainer: {
    flex: 1,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  overlayBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  overlayBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 2,
  },
  overlayQuestion: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  overlayHint: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 32,
    textAlign: "center",
  },
  buttonsContainer: {
    width: "100%",
    marginBottom: 40,
    gap: 14,
  },
  overlayPrimaryBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  overlayPrimaryText: {
    color: "#DC2626",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  overlaySecondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  overlaySecondaryText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  cancelOverlayBtn: {
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  cancelOverlayText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
