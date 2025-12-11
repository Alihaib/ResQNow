import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";

export default function DoctorPending() {
  const router = useRouter();
  const { logout } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      {/* 🌍 Language Button */}
      <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
        <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      <Text style={styles.logo}>⛑</Text>

      <Text style={styles.title}>{t("pending_title_doctor")}</Text>
      <Text style={styles.subtitle}>{t("pending_subtitle_doctor")}</Text>

      <View style={styles.card}>
        <Text style={styles.waitMessage}>{t("pending_message_doctor")}</Text>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <Text style={styles.logoutBtnText}>{t("logout")}</Text>
        </TouchableOpacity>
      </View>
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

  logo: {
    fontSize: 50,
    textAlign: "center",
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    color: "#003049",
    marginTop: 10,
  },

  subtitle: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    marginBottom: 25,
  },

  card: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 20,
    elevation: 6,
  },

  waitMessage: {
    textAlign: "center",
    fontSize: 16,
    color: "#495057",
    marginBottom: 20,
    lineHeight: 24,
  },

  logoutBtn: {
    backgroundColor: "#D62828",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  logoutBtnText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
});
