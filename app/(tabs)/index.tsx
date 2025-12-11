import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";

export default function HomeTab() {
  const { user, role, approved } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>⛑</Text>
        <Text style={styles.title}>ResQNow</Text>
        <Text style={styles.subtitle}>{t("home_subtitle")}</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("quickActions")}</Text>
        
        {/* Emergency Button */}
        <TouchableOpacity
          style={styles.emergencyBtn}
          onPress={() => router.push("/(tabs)/emergency")}
        >
          <Text style={styles.emergencyIcon}>🚨</Text>
          <Text style={styles.emergencyText}>{t("emergency")}</Text>
          <Text style={styles.emergencySubtext}>{t("tapForHelp")}</Text>
        </TouchableOpacity>

        {/* Quick Access Cards */}
        <View style={styles.quickAccessRow}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/(tabs)/firstaid")}
          >
            <Text style={styles.quickIcon}>⛑</Text>
            <Text style={styles.quickText}>{t("firstAid")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Text style={styles.quickIcon}>📋</Text>
            <Text style={styles.quickText}>{t("medicalProfile")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Role-Specific Sections */}
      {role === "doctor" && approved && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.roleCard}
            onPress={() => router.push("/doctor/dashboard")}
          >
            <Text style={styles.roleIcon}>👨‍⚕️</Text>
            <View style={styles.roleContent}>
              <Text style={styles.roleTitle}>{t("doctor_dashboard")}</Text>
              <Text style={styles.roleSubtitle}>{t("manageCases")}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {role === "ambulance" && approved && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.roleCard}
            onPress={() => router.push("/ambulance/dashboard")}
          >
            <Text style={styles.roleIcon}>🚑</Text>
            <View style={styles.roleContent}>
              <Text style={styles.roleTitle}>{t("ambulance_dashboard")}</Text>
              <Text style={styles.roleSubtitle}>{t("viewLiveCalls")}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {role === "admin" && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.roleCard}
            onPress={() => router.push("/admin/panel")}
          >
            <Text style={styles.roleIcon}>🔧</Text>
            <View style={styles.roleContent}>
              <Text style={styles.roleTitle}>{t("admin_panel")}</Text>
              <Text style={styles.roleSubtitle}>{t("manageUsers")}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Activity Placeholder */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("recentActivity")}</Text>
        <View style={styles.activityCard}>
          <Text style={styles.activityText}>{t("noRecentActivity")}</Text>
          <Text style={styles.activitySubtext}>{t("activitySubtext")}</Text>
        </View>
      </View>
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
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 20,
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
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 16,
  },
  emergencyBtn: {
    backgroundColor: "#DC2626",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emergencyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emergencyText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  emergencySubtext: {
    color: "#FFFFFF",
    fontSize: 14,
    opacity: 0.9,
  },
  quickAccessRow: {
    flexDirection: "row",
    gap: 12,
  },
  quickCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#003049",
  },
  roleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roleIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  roleContent: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: 14,
    color: "#6C757D",
  },
  chevron: {
    fontSize: 24,
    color: "#6C757D",
  },
  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityText: {
    fontSize: 16,
    color: "#6C757D",
    marginBottom: 4,
  },
  activitySubtext: {
    fontSize: 14,
    color: "#ADB5BD",
  },
});


