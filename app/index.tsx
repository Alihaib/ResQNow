import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { useLanguage } from "../src/context/LanguageContext";

export default function HomePage() {
  const { user, role, approved, loading } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const toggleLanguage = () => setLang(lang === "he" ? "en" : "he");
  const router = useRouter();
  const segments = useSegments();

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
      <View style={styles.center}>
        <Text style={styles.loading}>{t("loading")}</Text>
      </View>
    );

  // -------------------------
  // USER NOT LOGGED IN
  // -------------------------
  if (!user) {
    return (
      <View style={styles.container}>
        {/* 🌍 Language Switch */}
        <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
          <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
        </TouchableOpacity>

        <Text style={styles.logo}>⛑</Text>
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
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingTop: 70,
    paddingHorizontal: 20,
  },

  // language button
  languageBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "#003049",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    zIndex: 10,
  },
  languageText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },

  // Logo + Titles
  logo: {
    fontSize: 50,
    textAlign: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 40,
    fontWeight: "900",
    color: "#003049",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    marginBottom: 25,
  },

  // role text
  role: {
    fontSize: 18,
    textAlign: "center",
    fontWeight: "700",
    color: "#003049",
    marginBottom: 10,
  },
  pending: {
    color: "#D62828",
    fontWeight: "700",
  },

  // card container
  card: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 20,
    elevation: 6,
    marginTop: 10,
  },

  // buttons
  primaryBtn: {
    backgroundColor: "#D62828",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },

  secondaryBtn: {
    borderWidth: 2,
    borderColor: "#D62828",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryText: {
    color: "#D62828",
    fontSize: 16,
    fontWeight: "700",
  },

  // emergency
  emergencyBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 18,
  },
  emergencyText: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
  },

  // panel buttons
  panelBtn: {
    borderWidth: 2,
    borderColor: "#003049",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  panelText: {
    color: "#003049",
    fontWeight: "700",
    fontSize: 16,
  },

  // logout
  logoutBtn: {
    marginTop: 25,
    alignSelf: "center",
  },
  logoutText: {
    color: "#D62828",
    fontSize: 16,
    fontWeight: "700",
  },

  // loading
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loading: {
    fontSize: 18,
    color: "#6C757D",
  },
});
