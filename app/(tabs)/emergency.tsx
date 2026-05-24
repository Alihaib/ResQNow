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
import { AppScreen } from "../../components/ui/AiBackground";
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
import { elevatedShadow, pageStyles, tokens } from "../../src/ui/tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SosBusyPhase = "locating" | "starting" | null;

type VictimChoiceCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  onPress: () => void;
  disabled?: boolean;
  rowStyle: { flexDirection: "row" | "row-reverse" };
  textAlign: "left" | "right" | "center" | "auto";
  chevronName: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
};

function VictimChoiceCard({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  onPress,
  disabled,
  rowStyle,
  textAlign,
  chevronName,
  accessibilityLabel,
}: VictimChoiceCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        victimCardStyles.card,
        pressed && !disabled && victimCardStyles.cardPressed,
        disabled && victimCardStyles.cardDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={description}
    >
      <View style={[victimCardStyles.cardInner, rowStyle]}>
        <View style={[victimCardStyles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={28} color={iconColor} />
        </View>
        <View style={victimCardStyles.cardCopy}>
          <Text style={[victimCardStyles.cardTitle, { textAlign }]}>{title}</Text>
          <Text style={[victimCardStyles.cardDesc, { textAlign }]}>{description}</Text>
        </View>
        <Ionicons name={chevronName} size={22} color={tokens.color.textFaint} />
      </View>
    </Pressable>
  );
}

const VICTIM_CARD_MIN_HEIGHT = 96;

export default function EmergencyScreen() {
  const { t } = useLanguage();
  const { row, marginHorizontal, textAlign, chevronForward } = useUiDirection();
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
    <View style={pageStyles.screen}>
    <ScrollView
      style={pageStyles.screen}
      contentContainerStyle={[
        pageStyles.scrollContent,
        styles.content,
        { paddingBottom: insets.bottom + 96 },
      ]}
    >
      <Modal
        visible={isVictimSelectOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={cancelEmergency}
      >
        <AppScreen overlay>
          <View
            style={styles.victimScrim}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <View
            style={[
              styles.victimModalFrame,
              {
                paddingTop: insets.top + tokens.space.lg,
                paddingBottom: insets.bottom + tokens.space.lg,
              },
            ]}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[
                styles.victimCard,
                {
                  opacity: modalOpacity,
                  transform: [{ scale: modalScale }],
                },
              ]}
              accessibilityViewIsModal
            >
              <View style={[styles.victimBadgeRow, row]}>
                <View style={[styles.victimSosBadge, row]}>
                  <Ionicons name="alert-circle" size={16} color={tokens.color.danger} />
                  <Text style={styles.victimSosBadgeText}>SOS</Text>
                </View>
              </View>

              <Text style={[styles.victimTitle, { textAlign }]}>
                {t("sosWhoNeedsHelp")}
              </Text>
              <Text style={[styles.victimSubtitle, { textAlign }]}>
                {t(
                  "sosVictimSelectSub",
                  "Choose one option. Emergency services will be sent to your current location.",
                )}
              </Text>

              {startingEmergency ? (
                <View style={styles.victimLoading}>
                  <ActivityIndicator color={tokens.color.primary} size="large" />
                  <Text style={[styles.victimLoadingText, { textAlign }]}>
                    {t("preparingEmergencyRequest", "Preparing emergency request…")}
                  </Text>
                </View>
              ) : (
                <View style={styles.victimCards}>
                  <VictimChoiceCard
                    icon="person"
                    iconBg={tokens.color.primaryBg}
                    iconColor={tokens.color.primary}
                    title={t("sosMe")}
                    description={t("sosMeDescription", "I need immediate help")}
                    onPress={() => proceedToActiveEmergency("me")}
                    rowStyle={row}
                    textAlign={textAlign}
                    chevronName={chevronForward}
                    accessibilityLabel={t("sosMe")}
                  />
                  <VictimChoiceCard
                    icon="people"
                    iconBg={tokens.color.infoBg}
                    iconColor={tokens.color.primaryDark}
                    title={t("sosSomeoneElse")}
                    description={t("sosOtherDescription", "Someone else is in danger")}
                    onPress={() => proceedToActiveEmergency("other")}
                    rowStyle={row}
                    textAlign={textAlign}
                    chevronName={chevronForward}
                    accessibilityLabel={t("sosSomeoneElse")}
                  />
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.victimCancelBtn,
                  pressed && styles.victimCancelPressed,
                ]}
                onPress={cancelEmergency}
                disabled={startingEmergency}
                accessibilityRole="button"
                accessibilityLabel={t("cancel")}
                hitSlop={12}
              >
                <Text style={styles.victimCancelText}>{t("cancel")}</Text>
              </Pressable>
            </Animated.View>
          </View>
        </AppScreen>
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
    </View>
  );
}

const victimCardStyles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.xl,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    minHeight: VICTIM_CARD_MIN_HEIGHT,
    ...elevatedShadow,
  },
  cardPressed: {
    borderColor: tokens.color.primaryBorder,
    backgroundColor: tokens.color.primarySurface,
    transform: [{ scale: 0.985 }],
  },
  cardDisabled: {
    opacity: 0.55,
  },
  cardInner: {
    alignItems: "center",
    paddingVertical: tokens.space.lg,
    paddingHorizontal: tokens.space.lg,
    gap: tokens.space.md,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: tokens.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: {
    flex: 1,
    gap: tokens.space.xs,
  },
  cardTitle: {
    fontSize: tokens.font.h2,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    letterSpacing: -0.2,
  },
  cardDesc: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textSecondary,
    lineHeight: 20,
  },
});

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
  victimScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.38)",
  },
  victimModalFrame: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: tokens.space.lg,
  },
  victimCard: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.97)",
    borderRadius: tokens.radius.xxl,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.xxl,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.primaryBorder,
    ...elevatedShadow,
    shadowOpacity: 0.14,
    shadowRadius: 24,
  },
  victimBadgeRow: {
    marginBottom: tokens.space.lg,
    justifyContent: "center",
  },
  victimSosBadge: {
    alignItems: "center",
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.dangerBg,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.dangerBorder,
  },
  victimSosBadgeText: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.danger,
    letterSpacing: 1.6,
  },
  victimTitle: {
    fontSize: tokens.font.display,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    letterSpacing: -0.4,
    marginBottom: tokens.space.sm,
    lineHeight: 34,
  },
  victimSubtitle: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textSecondary,
    lineHeight: 22,
    marginBottom: tokens.space.xxl,
  },
  victimCards: {
    width: "100%",
    gap: tokens.space.lg,
    marginBottom: tokens.space.xxl,
  },
  victimLoading: {
    alignItems: "center",
    gap: tokens.space.md,
    marginBottom: tokens.space.xxl,
    minHeight: VICTIM_CARD_MIN_HEIGHT * 2 + tokens.space.lg,
    justifyContent: "center",
    paddingVertical: tokens.space.xl,
    backgroundColor: tokens.color.primarySurface,
    borderRadius: tokens.radius.xl,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.primaryBorder,
  },
  victimLoadingText: {
    color: tokens.color.textPrimary,
    fontSize: tokens.font.title,
    fontWeight: tokens.fontWeight.semibold,
    paddingHorizontal: tokens.space.lg,
  },
  victimCancelBtn: {
    alignSelf: "center",
    minHeight: tokens.hitSlop,
    minWidth: 120,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.xl,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.bgSubtle,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    justifyContent: "center",
    alignItems: "center",
  },
  victimCancelPressed: {
    opacity: 0.88,
    backgroundColor: tokens.color.bgSubtle,
  },
  victimCancelText: {
    color: tokens.color.textSecondary,
    fontSize: tokens.font.title,
    fontWeight: tokens.fontWeight.bold,
  },
});
