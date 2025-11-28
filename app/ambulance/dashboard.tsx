import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useLanguage } from "../../src/context/LanguageContext";

export default function AmbulanceDashboard() {
  const router = useRouter();
  const { t, lang, toggleLanguage } = useLanguage();

  return (
    <View style={styles.container}>

      {/* 🌍 Language Switch */}
      <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
        <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      <Text style={styles.logo}>🚑</Text>
      <Text style={styles.title}>{t("ambulance_dashboard_title")}</Text>
      <Text style={styles.subtitle}>{t("ambulance_dashboard_sub")}</Text>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* LIVE EMERGENCY CALLS */}
        <TouchableOpacity style={styles.card} onPress={() => alert("Coming soon…")}>
          <Text style={styles.cardTitle}>{t("live_calls")}</Text>
          <Text style={styles.cardDesc}>{t("live_calls_desc")}</Text>
        </TouchableOpacity>

        {/* MAP */}
        <TouchableOpacity style={styles.card} onPress={() => alert("Coming soon…")}>
          <Text style={styles.cardTitle}>{t("nearby_emergencies")}</Text>
          <Text style={styles.cardDesc}>{t("nearby_emergencies_desc")}</Text>
        </TouchableOpacity>

        {/* STATUS */}
        <TouchableOpacity style={styles.card} onPress={() => alert("Coming soon…")}>
          <Text style={styles.cardTitle}>{t("vehicle_status")}</Text>
          <Text style={styles.cardDesc}>{t("vehicle_status_desc")}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* BUTTON BACK HOME */}
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
    zIndex: 10,
  },
  languageText: { color: "#FFF", fontWeight: "700" },

  logo: {
    fontSize: 55,
    textAlign: "center",
    marginBottom: 10,
  },

  title: {
    fontSize: 34,
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

  scrollContent: {
    paddingBottom: 80,
  },

  card: {
    backgroundColor: "#FFFFFF",
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
  cardDesc: {
    color: "#6C757D",
    fontSize: 13,
  },

  homeBtn: {
    backgroundColor: "#D62828",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },

  homeText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
});
