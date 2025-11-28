import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useLanguage } from "../../src/context/LanguageContext";

export default function DoctorDashboard() {
  const router = useRouter();
  const { lang, toggleLanguage, t } = useLanguage();

  return (
    <View style={styles.container}>
      {/* 🌍 Language Switch */}
      <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
        <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      <Text style={styles.logo}>🩺</Text>
      <Text style={styles.title}>{t("doctor_dashboard_title")}</Text>
      <Text style={styles.subtitle}>{t("doctor_dashboard_sub")}</Text>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => alert("Coming soon…")}
        >
          <Text style={styles.cardTitle}>{t("view_cases")}</Text>
          <Text style={styles.cardDesc}>{t("view_cases_desc")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => alert("Coming soon…")}
        >
          <Text style={styles.cardTitle}>{t("medical_guides")}</Text>
          <Text style={styles.cardDesc}>{t("medical_guides_desc")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => alert("Coming soon…")}
        >
          <Text style={styles.cardTitle}>{t("notifications")}</Text>
          <Text style={styles.cardDesc}>{t("notifications_desc")}</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={styles.homeBtn}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.homeText}>{t("backHome")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingTop: 60,
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
    zIndex: 20,
  },
  languageText: { color: "#FFF", fontWeight: "700" },

  logo: { fontSize: 55, textAlign: "center", marginBottom: 10 },

  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#003049",
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    fontSize: 14,
    color: "#6C757D",
    marginBottom: 25,
  },

  scrollContent: { paddingBottom: 80 },

  card: {
    backgroundColor: "#FFF",
    padding: 22,
    borderRadius: 18,
    elevation: 5,
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 4,
  },
  cardDesc: { color: "#6C757D", fontSize: 13 },

  homeBtn: {
    backgroundColor: "#D62828",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  homeText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
