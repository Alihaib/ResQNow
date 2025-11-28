import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useLanguage } from "../../src/context/LanguageContext";

export default function AmbulancePending() {
  const router = useRouter();
  const { t, lang, toggleLanguage } = useLanguage();

  return (
    <View style={styles.container}>
      {/* Language Switch */}
      <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
        <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      <Text style={styles.logo}>🚑</Text>

      <Text style={styles.title}>{t("pending_title_ambulance")}</Text>
      <Text style={styles.subtitle}>{t("pending_subtitle_ambulance")}</Text>

      <View style={styles.card}>
        <Text style={styles.waitText}>{t("pending_message_ambulance")}</Text>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.homeBtnText}>{t("backHome")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
  },
  languageText: { color: "#FFF", fontWeight: "800" },

  logo: { fontSize: 55, textAlign: "center" },

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
    backgroundColor: "#FFF",
    padding: 25,
    borderRadius: 20,
    elevation: 5,
  },

  waitText: {
    textAlign: "center",
    fontSize: 15,
    color: "#495057",
    lineHeight: 24,
  },

  homeBtn: {
    marginTop: 20,
    backgroundColor: "#D62828",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  homeBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
});
