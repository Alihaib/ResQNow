import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { useEmergency } from "../../src/context/EmergencyContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { theme } from "../../src/ui/theme";

export default function HomeTab() {
  const { user, role, approved } = useAuth();
  const { isEmergencyActive, navigateToActiveEmergency } = useEmergency();
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

      {/* Global emergency state indicator (home) */}
      {isEmergencyActive && (
        <View style={styles.emergencyStatusCard}>
          <Text style={styles.emergencyStatusTitle}>{t("emergencyActiveTitle")}</Text>
          <Text style={styles.emergencyStatusSubtitle}>
            {t("continueActiveEmergencyHint")}
          </Text>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("quickActions")}</Text>
        
        {/* Emergency Button */}
        <TouchableOpacity
          style={[styles.emergencyBtn, isEmergencyActive && styles.emergencyBtnActive]}
          onPress={() =>
            isEmergencyActive
              ? navigateToActiveEmergency()
              : router.push("/(tabs)/emergency")
          }
        >
          <Text style={styles.emergencyIcon}>🚨</Text>
          <Text style={styles.emergencyText}>
            {isEmergencyActive ? t("emergencyActiveShort") : `🚨 ${t("sos")}`}
          </Text>
          <Text style={styles.emergencySubtext}>
            {isEmergencyActive ? t("tapToViewActiveEmergency") : t("tapForHelp")}
          </Text>
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
    backgroundColor: theme.colors.bg,
  },
  content: {
    paddingTop: 60,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
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
  emergencyStatusCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: "#FFF5F5",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.danger,
  },
  emergencyStatusTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.danger,
    marginBottom: 4,
  },
  emergencyStatusSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  emergencyBtn: {
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: "center",
    marginBottom: theme.spacing.lg,
    ...theme.shadow.primary,
  },
  emergencyBtnActive: {
    backgroundColor: theme.colors.dangerDark,
  },
  emergencyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.sm,
  },
  emergencyText: {
    color: theme.colors.surface,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  emergencySubtext: {
    color: theme.colors.surface,
    fontSize: 14,
    opacity: 0.9,
  },
  quickAccessRow: {
    flexDirection: "row",
    gap: 12,
  },
  quickCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    alignItems: "center",
    ...theme.shadow.card,
  },
  quickIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
  },
  roleCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    ...theme.shadow.card,
  },
  roleIcon: {
    fontSize: 32,
    marginRight: theme.spacing.lg,
  },
  roleContent: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  chevron: {
    fontSize: 24,
    color: theme.colors.textMuted,
  },
  activityCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    alignItems: "center",
    ...theme.shadow.card,
  },
  activityText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  activitySubtext: {
    fontSize: 14,
    color: theme.colors.textFaint,
  },
});


