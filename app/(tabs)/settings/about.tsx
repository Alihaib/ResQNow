import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../../src/context/LanguageContext";

export default function AboutScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/settings");
            }
          }} 
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹ {t("back")}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t("about")}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.logo}>⛑</Text>
        <Text style={styles.appName}>ResQNow</Text>
        <Text style={styles.version}>Version 1.0.0</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("aboutResQNow")}</Text>
        <Text style={styles.description}>
          {t("aboutDescription")}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("features")}</Text>
        <Text style={styles.feature}>{t("featureOneTap")}</Text>
        <Text style={styles.feature}>{t("featureFirstAid")}</Text>
        <Text style={styles.feature}>{t("featureMedicalProfile")}</Text>
        <Text style={styles.feature}>{t("featureContacts")}</Text>
        <Text style={styles.feature}>{t("featureLocation")}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("contact")}</Text>
        <Text style={styles.contactText}>{t("website")}</Text>
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
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 18,
    color: "#003049",
    fontWeight: "700",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#003049",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: "900",
    color: "#003049",
    marginBottom: 8,
  },
  version: {
    fontSize: 16,
    color: "#6C757D",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: "#6C757D",
    lineHeight: 24,
  },
  feature: {
    fontSize: 16,
    color: "#6C757D",
    marginBottom: 8,
    lineHeight: 24,
  },
  contactText: {
    fontSize: 16,
    color: "#6C757D",
    marginBottom: 8,
  },
});





