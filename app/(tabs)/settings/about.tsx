import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Card from "../../../components/ui/Card";
import SectionHeader from "../../../components/ui/SectionHeader";
import SubScreenShell from "../../../components/ui/SubScreenShell";
import { subScreenStyles } from "../../../components/ui/subScreenStyles";
import { useLanguage } from "../../../src/context/LanguageContext";
import { tokens } from "../../../src/ui/tokens";

export default function AboutScreen() {
  const { t } = useLanguage();

  return (
    <SubScreenShell title={t("about")} fallbackRoute="/(tabs)/settings">
      <Card style={styles.brandCard}>
        <View style={styles.iconBadge}>
          <Ionicons name="medkit" size={32} color={tokens.color.primary} />
        </View>
        <Text style={styles.appName}>{t("appName")}</Text>
        <Text style={styles.version}>
          {t("appVersion").replace("{version}", "1.0.0")}
        </Text>
      </Card>

      <View style={subScreenStyles.section}>
        <SectionHeader title={t("aboutResQNow")} dense />
        <Text style={subScreenStyles.body}>{t("aboutDescription")}</Text>
      </View>

      <View style={subScreenStyles.section}>
        <SectionHeader title={t("features")} dense />
        <Card tone="subtle" compact>
          <Text style={styles.feature}>{t("featureOneTap")}</Text>
          <Text style={styles.feature}>{t("featureFirstAid")}</Text>
          <Text style={styles.feature}>{t("featureMedicalProfile")}</Text>
          <Text style={styles.feature}>{t("featureContacts")}</Text>
          <Text style={styles.feature}>{t("featureLocation")}</Text>
        </Card>
      </View>

      <View style={subScreenStyles.section}>
        <SectionHeader title={t("contact")} dense />
        <Text style={subScreenStyles.body}>{t("website")}</Text>
      </View>
    </SubScreenShell>
  );
}

const styles = StyleSheet.create({
  brandCard: {
    alignItems: "center",
    marginBottom: tokens.space.xl,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.primaryBg,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.space.md,
  },
  appName: {
    fontSize: tokens.font.h2,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.xs,
  },
  version: {
    fontSize: tokens.font.body,
    color: tokens.color.textMuted,
    fontWeight: tokens.fontWeight.medium,
  },
  feature: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textSecondary,
    fontWeight: tokens.fontWeight.medium,
    marginBottom: tokens.space.sm,
    lineHeight: 22,
  },
});
