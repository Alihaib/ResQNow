import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useLanguage } from "../../src/context/LanguageContext";

export default function EmergencyScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const handleEmergencyPress = () => {
    if (!emergencyActive) {
      setEmergencyActive(true);
      // Simulate countdown
      let timer = 5;
      const interval = setInterval(() => {
        timer--;
        setCountdown(timer);
        if (timer === 0) {
          clearInterval(interval);
          router.push("/(tabs)/emergency/active");
        }
      }, 1000);
    }
  };

  const cancelEmergency = () => {
    setEmergencyActive(false);
    setCountdown(5);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
});


