import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../src/context/LanguageContext";

export default function FirstAidScreen() {
  const { t } = useLanguage();
  const router = useRouter();

  const categories = [
    { id: "bleeding", icon: "🩸", titleKey: "bleeding" },
    { id: "burns", icon: "🔥", titleKey: "burns" },
    { id: "choking", icon: "😷", titleKey: "choking" },
    { id: "cpr", icon: "❤️", titleKey: "cpr" },
    { id: "fractures", icon: "🦴", titleKey: "fractures" },
    { id: "poisoning", icon: "☠️", titleKey: "poisoning" },
    { id: "shock", icon: "⚡", titleKey: "shock" },
    { id: "unconscious", icon: "😴", titleKey: "unconscious" },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>⛑</Text>
        <Text style={styles.title}>{t("firstAidTitle")}</Text>
        <Text style={styles.subtitle}>{t("firstAidSubtitle")}</Text>
      </View>

      {/* Emergency Notice */}
      <View style={styles.noticeCard}>
        <Text style={styles.noticeIcon}>⚠️</Text>
        <Text style={styles.noticeText}>
          {t("emergencyNotice")}
        </Text>
      </View>

      {/* Categories Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("categories")}</Text>
        <View style={styles.grid}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => router.push(`/(tabs)/firstaid/${category.id}`)}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text style={styles.categoryTitle}>{t(category.titleKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Quick Tips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("quickTips")}</Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>✓ {t("checkDangerFirst")}</Text>
          <Text style={styles.tipText}>✓ {t("callEmergencyIfNeeded")}</Text>
          <Text style={styles.tipText}>✓ {t("stayCalmReassure")}</Text>
          <Text style={styles.tipText}>✓ {t("protectFromInfection")}</Text>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6C757D",
    textAlign: "center",
  },
  noticeCard: {
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  noticeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: "#92400E",
    fontWeight: "600",
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  categoryCard: {
    width: "47%",
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
  categoryIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
  },
  tipCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipText: {
    fontSize: 16,
    color: "#212529",
    marginBottom: 12,
    lineHeight: 24,
  },
});


