import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/context/AuthContext";
import { useLanguage } from "../src/context/LanguageContext";
import { pageStyles, tokens } from "../src/ui/tokens";

export default function HomePage() {
  const { user, role, approved, loading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  // Handle navigation redirects
  useEffect(() => {
    if (loading) return;

    if (!user) {
      // User not logged in - stay on index
      if (segments.length > 0 && segments[0] !== "auth") {
        // Already on auth, do nothing
      }
      return;
    }

    // User is logged in - redirect based on role
    const inAuthGroup = segments[0] === "auth";
    const inTabsGroup = segments[0] === "(tabs)";
    const inAdminGroup = segments[0] === "admin";
    const inDoctorGroup = segments[0] === "doctor";
    const inAmbulanceGroup = segments[0] === "ambulance";

    if (role === "admin" && !inAdminGroup) {
      router.replace("/admin/panel");
      return;
    }

    if ((role === "doctor" || role === "ambulance") && approved === false) {
      if (role === "doctor" && !inDoctorGroup) {
        router.replace("/doctor/pending");
        return;
      }
      if (role === "ambulance" && !inAmbulanceGroup) {
        router.replace("/ambulance/pending");
        return;
      }
      return;
    }

    // Regular users and approved doctors/ambulance go to tabs
    if (!inTabsGroup && !inAdminGroup && !inDoctorGroup && !inAmbulanceGroup) {
      router.replace("/(tabs)");
    }
  }, [user, role, approved, loading, segments]);

  // ⏳ Loading state
  if (loading)
    return (
      <View style={[pageStyles.screen, styles.center]}>
        <Text style={styles.loading}>{t("loading")}</Text>
      </View>
    );

  // -------------------------
  // USER NOT LOGGED IN
  // -------------------------
  if (!user) {
    return (
      <View style={[pageStyles.screen, styles.container, { paddingTop: insets.top + 24 }]}>
        <View style={styles.brandBadge}>
          <Ionicons name="medkit" size={36} color={tokens.color.primary} />
        </View>
        <Text style={styles.title}>ResQNow</Text>
        <Text style={styles.subtitle}>{t("home_subtitle")}</Text>

        <View style={styles.card}>
          {/* LOGIN */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/auth/login")}
          >
            <Text style={styles.primaryText}>{t("login")}</Text>
          </TouchableOpacity>

          {/* SIGNUP */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/auth/signup")}
          >
            <Text style={styles.secondaryText}>{t("create_account")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show loading while redirecting
  return (
    <View style={styles.center}>
      <Text style={styles.loading}>{t("loading")}</Text>
    </View>
  );
}

// ----------------------------
// 🎨 STYLES
// ----------------------------
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.xxl,
  },
  brandBadge: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: tokens.radius.xxl,
    backgroundColor: tokens.color.primaryBg,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.space.md,
  },
  title: {
    fontSize: tokens.font.display,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textMuted,
    textAlign: "center",
    marginBottom: tokens.space.xl,
    marginTop: tokens.space.sm,
  },
  role: {
    fontSize: tokens.font.h3,
    textAlign: "center",
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.sm,
  },
  pending: {
    color: tokens.color.danger,
    fontWeight: tokens.fontWeight.semibold,
  },
  card: {
    backgroundColor: tokens.color.bgSurface,
    padding: tokens.space.xl,
    borderRadius: tokens.radius.xxl,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    marginTop: tokens.space.md,
  },
  primaryBtn: {
    backgroundColor: tokens.color.primary,
    paddingVertical: tokens.space.lg,
    borderRadius: tokens.radius.xl,
    alignItems: "center",
    marginBottom: tokens.space.md,
  },
  primaryText: {
    color: tokens.color.textOnPrimary,
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.heavy,
  },
  secondaryBtn: {
    borderWidth: tokens.hairline,
    borderColor: tokens.color.primary,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.xl,
    alignItems: "center",
    marginBottom: tokens.space.md,
  },
  secondaryText: {
    color: tokens.color.primary,
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
  },
  emergencyBtn: {
    backgroundColor: tokens.color.danger,
    paddingVertical: tokens.space.lg,
    borderRadius: tokens.radius.xl,
    alignItems: "center",
    marginBottom: tokens.space.lg,
  },
  emergencyText: {
    color: tokens.color.textOnDanger,
    fontSize: tokens.font.h2,
    fontWeight: tokens.fontWeight.heavy,
  },
  panelBtn: {
    borderWidth: tokens.hairline,
    borderColor: tokens.color.borderStrong,
    paddingVertical: tokens.space.lg,
    borderRadius: tokens.radius.xl,
    alignItems: "center",
    marginBottom: tokens.space.md,
    backgroundColor: tokens.color.bgSurface,
  },
  panelText: {
    color: tokens.color.textPrimary,
    fontWeight: tokens.fontWeight.semibold,
    fontSize: tokens.font.label,
  },
  logoutBtn: {
    marginTop: tokens.space.xl,
    alignSelf: "center",
  },
  logoutText: {
    color: tokens.color.danger,
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  loading: {
    fontSize: tokens.font.h3,
    color: tokens.color.textMuted,
  },
});
