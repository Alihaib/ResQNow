import { Ionicons } from "@expo/vector-icons";
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
import AppPageHeader from "../../components/ui/AppPageHeader";
import Card from "../../components/ui/Card";
import ShortcutCard from "../../components/ui/ShortcutCard";
import SosHeroButton from "../../components/ui/SosHeroButton";
import { useEmergency } from "../../src/context/EmergencyContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { useUiDirection } from "../../components/ui/layout";
import { pageStyles, tokens } from "../../src/ui/tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function EmergencyScreen() {
  const { t } = useLanguage();
  const { row, marginHorizontal } = useUiDirection();
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
      if (result.reason === "firestore_index") {
        Alert.alert(
          t("error"),
          t(
            "firestoreIndexError",
            "Emergency data could not be loaded. Please try again in a moment.",
          ),
        );
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
    permissionStatusRef.current = null;
    setSosBusy(true);

    let locationReady = false;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log("[SOS][UI] location permission status:", status);
      permissionStatusRef.current = status;
      if (status !== "granted") {
        Alert.alert(t("error"), t("locationPermissionDenied"));
        return;
      }

      let position: Location.LocationObject;
      try {
        position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } catch (gpsError) {
        console.error("[SOS][UI] getCurrentPosition failed:", gpsError);
        Alert.alert(t("error"), t("locationNotAvailable"));
        return;
      }

      console.log("[SOS][UI] location fix:", {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        Alert.alert(t("error"), t("locationNotAvailable"));
        return;
      }

      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });

        locationDataRef.current = {
          latitude: lat,
          longitude: lng,
          accuracy: position.coords.accuracy,
          address: address
            ? `${address.street || ""} ${address.streetNumber || ""}, ${address.city || ""}, ${address.country || ""}`.trim()
            : null,
          timestamp: new Date().toISOString(),
        };
      } catch (geocodeError) {
        console.warn("[SOS][UI] reverseGeocode failed:", geocodeError);
        locationDataRef.current = {
          latitude: lat,
          longitude: lng,
          accuracy: position.coords.accuracy,
          address: null,
          timestamp: new Date().toISOString(),
        };
      }
      locationReady = true;
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert(t("error"), t("locationNotAvailable"));
      return;
    } finally {
      setSosBusy(false);
    }

    if (!locationReady || !locationDataRef.current?.latitude || !locationDataRef.current?.longitude) {
      Alert.alert(t("error"), t("locationNotAvailable"));
      return;
    }

    setIsVictimSelectOpen(true);
  };

  const cancelEmergency = () => {
    setIsVictimSelectOpen(false);
  };

  const insets = useSafeAreaInsets();
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
    <ScrollView
      style={pageStyles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 96 },
      ]}
    >
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
              accessibilityRole="button"
              accessibilityLabel={t("sosMe")}
            >
              <Text style={styles.overlayPrimaryText}>{t("sosMe")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.overlaySecondaryBtn}
              onPress={() => proceedToActiveEmergency("other")}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={t("sosSomeoneElse")}
            >
              <Text style={styles.overlaySecondaryText}>
                {t("sosSomeoneElse")}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.cancelOverlayBtn}
            onPress={cancelEmergency}
            accessibilityRole="button"
            accessibilityLabel={t("cancel")}
          >
            <Text style={styles.cancelOverlayText}>{t("cancel")}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <AppPageHeader
        title={t("emergencyTitle")}
        subtitle={t("emergencySubtitle")}
        eyebrow={t("tab_emergency")}
        showBrandIcon={false}
      />

      <View style={styles.hero}>
        <SosHeroButton
          label={String(sosLabel)}
          sublabel={sosSubLabel}
          onPress={handleEmergencyPress}
          disabled={busy}
          busy={busy}
          activeEmergency={isEmergencyActive}
          size="hero"
        />
      </View>

      <Card style={styles.calmCard}>
        <Text style={styles.calmTitle}>{t("beforeEmergency")}</Text>
        {(["stayCalm", "checkLocation", "ensureSafety", "haveMedicalInfo"] as const).map(
          (key) => (
            <View key={key} style={[styles.calmRow, row]}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={tokens.color.success}
                style={styles.calmIcon}
              />
              <Text style={styles.calmText}>{t(key)}</Text>
            </View>
          ),
        )}
      </Card>

      <Text style={[styles.sectionLabel, marginHorizontal(tokens.space.xs, 0)]}>
        {t("quickActions")}
      </Text>
      <ShortcutCard
        ionIcon="medkit-outline"
        title={t("medical_guides")}
        subtitle={t("medical_guides_desc")}
        onPress={() => router.push("/(tabs)/firstaid")}
      />
      <ShortcutCard
        ionIcon="document-text-outline"
        title={t("medicalProfile")}
        subtitle={t("personal_info")}
        onPress={() => router.push("/(tabs)/profile")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: tokens.space.lg,
  },
  hero: {
    alignItems: "center",
    marginBottom: tokens.space.xl,
  },
  calmCard: {
    marginBottom: tokens.space.xl,
  },
  calmTitle: {
    fontSize: tokens.font.overline,
    fontWeight: "900",
    color: tokens.color.textFaint,
    letterSpacing: 0.9,
    marginBottom: tokens.space.md,
    textTransform: "uppercase",
  },
  calmRow: {
    alignItems: "center",
    marginBottom: tokens.space.sm,
    gap: tokens.space.sm,
  },
  calmIcon: {
    width: 18,
  },
  calmText: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textSecondary,
    fontWeight: "600",
    flex: 1,
  },
  sectionLabel: {
    fontSize: tokens.font.overline,
    fontWeight: "900",
    color: tokens.color.textFaint,
    letterSpacing: 0.9,
    marginBottom: tokens.space.sm,
    textTransform: "uppercase",
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: tokens.color.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space.xl,
  },
  overlayBadge: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.xs,
    borderRadius: tokens.radius.pill,
    marginBottom: tokens.space.lg,
    borderWidth: tokens.hairline,
    borderColor: "rgba(255,255,255,0.32)",
  },
  overlayBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: tokens.font.bodyLg,
    letterSpacing: 2,
  },
  overlayQuestion: {
    fontSize: tokens.font.h1,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: tokens.space.sm,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  overlayHint: {
    fontSize: tokens.font.bodyLg,
    color: "rgba(255,255,255,0.85)",
    marginBottom: tokens.space.xxl,
    textAlign: "center",
  },
  buttonsContainer: {
    width: "100%",
    marginBottom: tokens.space.xxl,
    gap: tokens.space.md,
  },
  overlayPrimaryBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: tokens.radius.lg,
    paddingVertical: tokens.space.lg,
    paddingHorizontal: tokens.space.lg,
    alignItems: "center",
    minHeight: 56,
    justifyContent: "center",
  },
  overlayPrimaryText: {
    color: tokens.color.danger,
    fontSize: tokens.font.h2,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  overlaySecondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: tokens.radius.lg,
    paddingVertical: tokens.space.lg,
    paddingHorizontal: tokens.space.lg,
    alignItems: "center",
    borderWidth: tokens.hairline,
    borderColor: "rgba(255,255,255,0.4)",
    minHeight: 56,
    justifyContent: "center",
  },
  overlaySecondaryText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  cancelOverlayBtn: {
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.xxl,
    borderRadius: tokens.radius.md,
    minHeight: tokens.hitSlop,
    justifyContent: "center",
  },
  cancelOverlayText: {
    color: "#FFFFFF",
    fontSize: tokens.font.title,
    fontWeight: "800",
  },
});
