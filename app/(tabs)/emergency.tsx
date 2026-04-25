import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useLanguage } from "../../src/context/LanguageContext";

export default function EmergencyScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // SOS countdown overlay state
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [countdownValue, setCountdownValue] = useState(5);
  const [victimType, setVictimType] = useState<'me' | 'other'>('me');

  const [otherPersonName, setOtherPersonName] = useState('');
  const [nameError, setNameError] = useState(false);

  const locationDataRef = useRef<any>(null);
  const victimTypeRef = useRef<'me' | 'other'>('me');
  const otherPersonNameRef = useRef('');
  const bonusGivenRef = useRef(false);

  const sendEmergencyRequest = (type: 'me' | 'other', name: string) => {
    if (type === 'other' && !name.trim()) {
      setNameError(true);
      setCountdownValue(5);
      return;
    }
    setNameError(false);
    setIsCountdownActive(false);
    setCountdownValue(5);
    setVictimType('me');
    victimTypeRef.current = 'me';
    setOtherPersonName('');
    otherPersonNameRef.current = '';
    bonusGivenRef.current = false;
    router.push({
      pathname: "/(tabs)/emergency/active",
      params: {
        ...(locationDataRef.current ? { locationData: JSON.stringify(locationDataRef.current) } : {}),
        victimType: type,
        otherPersonName: name.trim(),
      },
    });
  };

  useEffect(() => {
    if (!isCountdownActive) return;

    if (countdownValue === 1) {
      sendEmergencyRequest(victimTypeRef.current, otherPersonNameRef.current);
      return;
    }

    const timer = setTimeout(() => {
      setCountdownValue((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isCountdownActive, countdownValue]);

  const handleEmergencyPress = async () => {
    if (isCountdownActive) return;
    locationDataRef.current = null;

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
    }

    // Show overlay and start countdown only after location is ready (or failed)
    setIsCountdownActive(true);
  };

  const cancelEmergency = () => {
    setEmergencyActive(false);
    setCountdown(5);
    setIsCountdownActive(false);
    setCountdownValue(5);
    setVictimType('me');
    victimTypeRef.current = 'me';
    setOtherPersonName('');
    otherPersonNameRef.current = '';
    setNameError(false);
    bonusGivenRef.current = false;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* SOS Countdown Overlay */}
      <Modal
        visible={isCountdownActive}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.overlayContainer}>
          <Text style={styles.overlayCountdown}>{countdownValue}</Text>

          <Text style={styles.overlayQuestion}>{t("sosWhoNeedsHelp")}</Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[styles.optionBtn, victimType === 'me' && styles.optionBtnSelected]}
              onPress={() => { setVictimType('me'); victimTypeRef.current = 'me'; }}
            >
              <View style={styles.radioOuter}>
                {victimType === 'me' && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.optionText, victimType === 'me' && styles.optionTextSelected]}>{t("sosForMe")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionBtn, victimType === 'other' && styles.optionBtnSelected]}
              onPress={() => {
                if (!bonusGivenRef.current) {
                  setCountdownValue((prev) => prev + 5);
                  bonusGivenRef.current = true;
                }
                setVictimType('other');
                victimTypeRef.current = 'other';
              }}
            >
              <View style={styles.radioOuter}>
                {victimType === 'other' && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.optionText, victimType === 'other' && styles.optionTextSelected]}>{t("sosForOther")}</Text>
            </TouchableOpacity>
          </View>

          {victimType === 'other' && (
            <View style={styles.nameInputContainer}>
              <TextInput
                style={[styles.nameInput, nameError && styles.nameInputError]}
                placeholder={t("sosEnterName")}
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={otherPersonName}
                onChangeText={(text) => {
                  setOtherPersonName(text);
                  otherPersonNameRef.current = text;
                  if (nameError) setNameError(false);
                }}
                autoCapitalize="words"
              />
              {nameError && (
                <Text style={styles.nameErrorText}>{t("sosNameRequired")}</Text>
              )}
            </View>
          )}

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

      {!emergencyActive ? (
        <>
          {/* Emergency Button */}
          <TouchableOpacity
            style={styles.emergencyBtn}
            onPress={handleEmergencyPress}
          >
            <Text style={styles.emergencyIcon}>🚨</Text>
            <Text style={styles.emergencyText}>{t("emergency")}</Text>
            <Text style={styles.emergencySubtext}>{t("tapForHelp")}</Text>
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
      ) : (
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownText}>{countdown}</Text>
          <Text style={styles.countdownLabel}>{t("callingEmergency")}</Text>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={cancelEmergency}
          >
            <Text style={styles.cancelText}>{t("cancel")}</Text>
          </TouchableOpacity>
        </View>
      )}
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
  countdownContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  countdownText: {
    fontSize: 120,
    fontWeight: "900",
    color: "#DC2626",
    marginBottom: 20,
  },
  countdownLabel: {
    fontSize: 20,
    color: "#6C757D",
    marginBottom: 40,
  },
  cancelBtn: {
    backgroundColor: "#6C757D",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  cancelText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  overlayCountdown: {
    fontSize: 140,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 24,
    lineHeight: 150,
  },
  overlayQuestion: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 32,
    textAlign: "center",
    writingDirection: "rtl",
  },
  optionsContainer: {
    width: "100%",
    marginBottom: 40,
    gap: 16,
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    padding: 18,
    borderWidth: 2,
    borderColor: "transparent",
    gap: 14,
  },
  optionBtnSelected: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderColor: "#FFFFFF",
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },
  optionText: {
    fontSize: 20,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    writingDirection: "rtl",
  },
  optionTextSelected: {
    color: "#FFFFFF",
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
    writingDirection: "rtl",
  },
  nameInputContainer: {
    width: "100%",
    marginBottom: 24,
  },
  nameInput: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  nameInputError: {
    borderColor: "#FFEB3B",
  },
  nameErrorText: {
    color: "#FFEB3B",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
});


