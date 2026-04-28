import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { theme } from "../../../src/ui/theme";

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
        <Text style={styles.appName}>{t("appName")}</Text>
        <Text style={styles.version}>{t("appVersion").replace("{version}", "1.0.0")}</Text>
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
    backgroundColor: theme.colors.bg,
  },
  content: {
    paddingTop: 60,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: "700",
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xxl,
    alignItems: "center",
    marginBottom: 24,
    ...theme.shadow.card,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  version: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  description: {
    fontSize: 16,
    color: theme.colors.textMuted,
    lineHeight: 24,
  },
  feature: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
    lineHeight: 24,
  },
  contactText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
});





