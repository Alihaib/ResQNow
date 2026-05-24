import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AppPageHeader from "../../components/ui/AppPageHeader";
import Card from "../../components/ui/Card";
import FadeInView from "../../components/ui/FadeInView";
import ShortcutCard from "../../components/ui/ShortcutCard";
import SosHeroButton from "../../components/ui/SosHeroButton";
import { useEmergency } from "../../src/context/EmergencyContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { useUiDirection } from "../../components/ui/layout";
import { isValidLatLng } from "../../src/utils/emergencyGuards";
import {
  getCurrentPositionWithTimeout,
  isLocationTimeoutError,
} from "../../src/utils/locationWithTimeout";
import { messageForStartEmergencyReason } from "../../src/utils/firestoreErrors";
import { hapticLight, hapticSosPress } from "../../src/utils/haptics";
import { pageStyles, tokens } from "../../src/ui/tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SosBusyPhase = "locating" | "starting" | null;

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

  const [isVictimSelectOpen, setIsVictimSelectOpen] = useState(false);
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.94)).current;

  const locationDataRef = useRef<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    address: string | null;
    timestamp: string;
  } | null>(null);
  const permissionStatusRef = useRef<string | null>(null);
  const sosInFlightRef = useRef(false);
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    if (!isVictimSelectOpen) {
      modalOpacity.setValue(0);
      modalScale.setValue(0.94);
      return;
    }
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: tokens.motion.normal,
        useNativeDriver: true,
      }),
      Animated.spring(modalScale, {
        toValue: 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isVictimSelectOpen, modalOpacity, modalScale]);

  const showStartEmergencyError = (reason: string, message?: string) => {
    Alert.alert(
      t("error"),
      messageForStartEmergencyReason(
        reason,
        message || t("failedToStartEmergency"),
      ),
    );
  };

  const proceedToActiveEmergency = async (type: "me" | "other") => {
    hapticLight();
    if (startingEmergency || submitInFlightRef.current) return;

    if (isEmergencyActive) {
      setIsVictimSelectOpen(false);
      navigateToActiveEmergency();
      return;
    }

    const loc = locationDataRef.current;
    if (!loc || !isValidLatLng(loc.latitude, loc.longitude)) {
      Alert.alert(t("error"), t("locationNotAvailable"));
      return;
    }

    if (permissionStatusRef.current !== "granted") {
      Alert.alert(t("error"), t("locationPermissionDenied"));
      return;
    }

    submitInFlightRef.current = true;
    try {
      const result = await startEmergency({
        victimType: type,
        location: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: loc.address ?? null,
        },
        timestamp: loc.timestamp,
        locationPermissionStatus: "granted",
      });
      if (result.ok) {
        setIsVictimSelectOpen(false);
        navigateToActiveEmergency();
        return;
      }
      if (result.reason === "already_active") {
        setIsVictimSelectOpen(false);
        navigateToActiveEmergency();
        return;
      }
      showStartEmergencyError(result.reason, result.message);
    } catch {
      Alert.alert(t("error"), t("failedToStartEmergency"));
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const handleEmergencyPress = async () => {
    if (isEmergencyActive) {
      hapticLight();
      navigateToActiveEmergency();
      return;
    }
    if (isVictimSelectOpen || sosBusy || startingEmergency || sosInFlightRef.current) return;

    hapticSosPress();
    sosInFlightRef.current = true;
    locationDataRef.current = null;
    permissionStatusRef.current = null;
    setSosBusy(true);

    let locationReady = false;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      permissionStatusRef.current = status;
      if (status !== "granted") {
        Alert.alert(t("error"), t("locationPermissionDenied"));
        return;
      }

      let position: Location.LocationObject;
      try {
        position = await getCurrentPositionWithTimeout({
          accuracy: Location.Accuracy.High,
        });
      } catch (gpsError) {
        console.error("[SOS][UI] getCurrentPosition failed:", gpsError);
        if (isLocationTimeoutError(gpsError)) {
          Alert.alert(
            t("error"),
            t(
              "locationTimeout",
              "Could not get your location in time. Please check GPS and try again.",
            ),
          );
        } else {
          Alert.alert(t("error"), t("locationNotAvailable"));
        }
        return;
      }

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
      sosInFlightRef.current = false;
    }

    const captured = locationDataRef.current;
    if (
      !locationReady ||
      !captured ||
      !isValidLatLng(captured.latitude, captured.longitude)
    ) {
      Alert.alert(t("error"), t("locationNotAvailable"));
      return;
    }

    permissionStatusRef.current = "granted";
    setIsVictimSelectOpen(true);
  };

  const cancelEmergency = () => {
    hapticLight();
    setIsVictimSelectOpen(false);
  };

  const insets = useSafeAreaInsets();
  const busyPhase: SosBusyPhase = startingEmergency
    ? "starting"
    : sosBusy
      ? "locating"
      : null;
  const busy = busyPhase !== null;

  const sosLabel = isEmergencyActive
    ? t("emergencyActiveShort")
    : busyPhase === "starting"
      ? t("preparingEmergencyRequest", "Preparing emergency request…")
      : busyPhase === "locating"
        ? t("gettingLocation", "Getting your location…")
        : t("sos");

  const sosSubLabel = isEmergencyActive
    ? t("tapToViewActiveEmergency")
    : busyPhase === "starting"
      ? t("sosSendingHelp", "Sending your SOS to responders…")
      : busyPhase === "locating"
        ? t("sosLocatingHint", "Please wait — we need your location to dispatch help.")
        : t("tapForHelp");

  return (
    <ScrollView
      style={pageStyles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 96 },
      ]}
    >
      <Modal
        visible={isVictimSelectOpen}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={cancelEmergency}
      >
        <Animated.View
          style={[
            styles.overlayContainer,
            { opacity: modalOpacity, transform: [{ scale: modalScale }] },
          ]}
        >
          <View style={styles.overlayBadge}>
            <Text style={styles.overlayBadgeText}>SOS</Text>
          </View>
          <Text style={styles.overlayQuestion}>{t("sosWhoNeedsHelp")}</Text>
          <Text style={styles.overlayHint}>
            {t("sosVictimHint", "Tap an option to send your SOS.")}
          </Text>

          {startingEmergency ? (
            <View style={styles.overlayLoading}>
              <ActivityIndicator color="#FFFFFF" size="large" />
              <Text style={styles.overlayLoadingText}>
                {t("preparingEmergencyRequest", "Preparing emergency request…")}
              </Text>
            </View>
          ) : (
            <View style={styles.buttonsContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.overlayPrimaryBtn,
                  pressed && styles.overlayBtnPressed,
                ]}
                onPress={() => proceedToActiveEmergency("me")}
                accessibilityRole="button"
                accessibilityLabel={t("sosMe")}
              >
                <Text style={styles.overlayPrimaryText}>{t("sosMe")}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.overlaySecondaryBtn,
                  pressed && styles.overlayBtnPressed,
                ]}
                onPress={() => proceedToActiveEmergency("other")}
                accessibilityRole="button"
                accessibilityLabel={t("sosSomeoneElse")}
              >
                <Text style={styles.overlaySecondaryText}>
                  {t("sosSomeoneElse")}
                </Text>
              </Pressable>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.cancelOverlayBtn,
              pressed && styles.overlayBtnPressed,
            ]}
            onPress={cancelEmergency}
            disabled={startingEmergency}
            accessibilityRole="button"
            accessibilityLabel={t("cancel")}
          >
            <Text style={styles.cancelOverlayText}>{t("cancel")}</Text>
          </Pressable>
        </Animated.View>
      </Modal>

      <FadeInView>
        <AppPageHeader
          title={t("emergencyTitle")}
          subtitle={t("emergencySubtitle")}
          eyebrow={t("tab_emergency")}
          showBrandIcon={false}
        />
      </FadeInView>

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

      <FadeInView delay={40}>
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
      </FadeInView>

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

const OVERLAY_BTN_MIN_HEIGHT = 56;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: tokens.space.lg,
  },
  hero: {
    alignItems: "center",
    marginBottom: tokens.space.lg,
  },
  calmCard: {
    marginBottom: tokens.space.lg,
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
    color: "rgba(255,255,255,0.88)",
    marginBottom: tokens.space.xl,
    textAlign: "center",
    lineHeight: 22,
  },
  overlayLoading: {
    alignItems: "center",
    gap: tokens.space.md,
    marginBottom: tokens.space.xxl,
    minHeight: OVERLAY_BTN_MIN_HEIGHT * 2 + tokens.space.md,
    justifyContent: "center",
  },
  overlayLoadingText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    textAlign: "center",
  },
  buttonsContainer: {
    width: "100%",
    marginBottom: tokens.space.xl,
    gap: tokens.space.md,
  },
  overlayPrimaryBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: tokens.radius.lg,
    paddingVertical: tokens.space.lg,
    paddingHorizontal: tokens.space.lg,
    alignItems: "center",
    minHeight: OVERLAY_BTN_MIN_HEIGHT,
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
    minHeight: OVERLAY_BTN_MIN_HEIGHT,
    justifyContent: "center",
  },
  overlaySecondaryText: {
    color: "#FFFFFF",
    fontSize: tokens.font.h2,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  overlayBtnPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
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
