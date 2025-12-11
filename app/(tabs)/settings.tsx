import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";

export default function SettingsScreen() {
  const { logout } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>⚙️</Text>
        <Text style={styles.title}>{t("settingsTitle")}</Text>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("account")}</Text>
        
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push("/(tabs)/profile")}
        >
          <Text style={styles.menuIcon}>👤</Text>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{t("profile")}</Text>
            <Text style={styles.menuSubtitle}>{t("manageAccount")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push("/(tabs)/settings/privacy")}
        >
          <Text style={styles.menuIcon}>🔒</Text>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{t("privacySecurity")}</Text>
            <Text style={styles.menuSubtitle}>{t("dataPrivacySettings")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("preferences")}</Text>
        
        <View style={styles.menuCard}>
          <Text style={styles.menuIcon}>🌍</Text>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{t("language")}</Text>
            <Text style={styles.menuSubtitle}>{lang === "he" ? "עברית" : "English"}</Text>
          </View>
          <TouchableOpacity onPress={toggleLanguage} style={styles.toggleBtn}>
            <Text style={styles.toggleText}>{lang === "he" ? "EN" : "HE"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuCard}>
          <Text style={styles.menuIcon}>🔔</Text>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{t("notifications")}</Text>
            <Text style={styles.menuSubtitle}>{t("emergencyAlertsUpdates")}</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: "#E9ECEF", true: "#D62828" }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.menuCard}>
          <Text style={styles.menuIcon}>📍</Text>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{t("locationServices")}</Text>
            <Text style={styles.menuSubtitle}>{t("shareLocationEmergencies")}</Text>
          </View>
          <Switch
            value={locationEnabled}
            onValueChange={setLocationEnabled}
            trackColor={{ false: "#E9ECEF", true: "#D62828" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("support")}</Text>
        
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push("/(tabs)/settings/help")}
        >
          <Text style={styles.menuIcon}>❓</Text>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{t("helpFAQ")}</Text>
            <Text style={styles.menuSubtitle}>{t("getHelpAnswers")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push("/(tabs)/settings/about")}
        >
          <Text style={styles.menuIcon}>ℹ️</Text>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{t("about")}</Text>
            <Text style={styles.menuSubtitle}>{t("appVersionInfo")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>{t("logout")}</Text>
      </TouchableOpacity>
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
  menuCard: {
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
  menuIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 14,
    color: "#6C757D",
  },
  chevron: {
    fontSize: 24,
    color: "#6C757D",
  },
  toggleBtn: {
    backgroundColor: "#003049",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  toggleText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  logoutBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
});





