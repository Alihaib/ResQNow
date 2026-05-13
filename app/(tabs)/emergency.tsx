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
import ShortcutCard from "../../components/ui/ShortcutCard";
import { useEmergency } from "../../src/context/EmergencyContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { elevatedShadow, tokens } from "../../src/ui/tokens";

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

      {/* Hero / Title — calm, low visual weight so the SOS button dominates. */}
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>
            {t("tab_emergency", "EMERGENCY")}
          </Text>
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
        accessibilityState={{ disabled: !!busy, busy: !!busy }}
        accessibilityLabel={String(sosLabel)}
      >
        <View style={styles.sosRing}>
          <Text style={styles.sosIcon}>🚨</Text>
        </View>
        <Text style={styles.sosLabel}>{sosLabel}</Text>
        <Text style={styles.sosSubLabel}>{sosSubLabel}</Text>
      </TouchableOpacity>

      {/* Reassurance / Checklist — quieter card, intentionally low contrast. */}
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
      <ShortcutCard
        icon="⛑"
        title={t("medical_guides")}
        subtitle={t("medical_guides_desc")}
        onPress={() => router.push("/(tabs)/firstaid")}
      />
      <ShortcutCard
        icon="📋"
        title={t("medicalProfile")}
        subtitle={t("personal_info")}
        onPress={() => router.push("/(tabs)/profile")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.bgPage,
  },
  content: {
    paddingTop: 64,
    paddingBottom: tokens.space.xxl + tokens.space.sm,
    paddingHorizontal: tokens.space.xl,
  },
  hero: {
    alignItems: "center",
    marginBottom: tokens.space.xl,
  },
  heroBadge: {
    backgroundColor: tokens.color.dangerBg,
    paddingHorizontal: tokens.space.md + 2,
    paddingVertical: tokens.space.xs + 2,
    borderRadius: tokens.radius.pill,
    marginBottom: tokens.space.md,
  },
  heroBadgeText: {
    color: tokens.color.dangerDark,
    fontWeight: "900",
    fontSize: tokens.font.caption,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: tokens.font.display,
    fontWeight: "900",
    color: tokens.color.textPrimary,
    letterSpacing: -0.5,
    marginBottom: tokens.space.xs + 2,
    textAlign: "center",
  },
  subtitle: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textMuted,
    textAlign: "center",
    paddingHorizontal: tokens.space.lg,
    lineHeight: 20,
  },
  sosBtn: {
    backgroundColor: tokens.color.danger,
    borderRadius: tokens.radius.xl + 4,
    paddingVertical: 36,
    paddingHorizontal: tokens.space.xl,
    alignItems: "center",
    marginBottom: tokens.space.xl,
    ...elevatedShadow,
    shadowColor: tokens.color.danger,
    shadowOpacity: 0.35,
  },
  sosBtnActive: { backgroundColor: tokens.color.dangerDark },
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
    marginBottom: tokens.space.lg,
  },
  sosIcon: { fontSize: 56 },
  sosLabel: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: tokens.space.xs + 2,
  },
  sosSubLabel: {
    color: "rgba(255,255,255,0.92)",
    fontSize: tokens.font.bodyLg,
    fontWeight: "700",
    textAlign: "center",
  },
  calmCard: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.lg,
    padding: tokens.space.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    marginBottom: tokens.space.xl,
  },
  calmTitle: {
    fontSize: tokens.font.body,
    fontWeight: "900",
    color: tokens.color.textPrimary,
    letterSpacing: 0.4,
    marginBottom: tokens.space.md,
    textTransform: "uppercase",
  },
  calmRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: tokens.space.sm,
    gap: tokens.space.sm,
  },
  calmIcon: {
    color: tokens.color.success,
    fontSize: tokens.font.title,
    fontWeight: "900",
    width: 18,
  },
  calmText: {
    fontSize: tokens.font.bodyLg,
    color: "#334155",
    fontWeight: "600",
    flex: 1,
  },
  sectionLabel: {
    fontSize: tokens.font.overline,
    fontWeight: "900",
    color: tokens.color.textFaint,
    letterSpacing: 0.8,
    marginBottom: tokens.space.sm + 2,
    marginLeft: tokens.space.xs,
    textTransform: "uppercase",
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: tokens.color.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space.xxl - 4,
  },
  overlayBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.xs + 2,
    borderRadius: tokens.radius.pill,
    marginBottom: tokens.space.lg + 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
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
    marginBottom: tokens.space.sm + 2,
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
    marginBottom: 40,
    gap: tokens.space.md + 2,
  },
  overlayPrimaryBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: tokens.radius.lg + 2,
    paddingVertical: tokens.space.xl - 2,
    paddingHorizontal: tokens.space.xl - 4,
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
    borderRadius: tokens.radius.lg + 2,
    paddingVertical: tokens.space.xl - 2,
    paddingHorizontal: tokens.space.xl - 4,
    alignItems: "center",
    borderWidth: 2,
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
    paddingVertical: tokens.space.md + 2,
    paddingHorizontal: tokens.space.xxl + tokens.space.lg,
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
