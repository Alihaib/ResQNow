import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppPageHeader from "../../components/ui/AppPageHeader";
import { DangerButton } from "../../components/ui/Button";
import ListRow from "../../components/ui/ListRow";
import SectionHeader from "../../components/ui/SectionHeader";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { pageStyles, tokens } from "../../src/ui/tokens";

export default function SettingsScreen() {
  const { logout, user } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/auth/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <ScrollView
      style={pageStyles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 96 },
      ]}
    >
      <AppPageHeader title={t("settingsTitle")} showBrandIcon={false} />

      <View style={styles.section}>
        <SectionHeader title={t("account")} />
        <ListRow
          icon="person-outline"
          title={t("profile")}
          subtitle={t("manageAccount")}
          onPress={() => router.push("/(tabs)/profile")}
        />
        <ListRow
          icon="lock-closed-outline"
          title={t("privacySecurity")}
          subtitle={t("dataPrivacySettings")}
          onPress={() => router.push("/(tabs)/settings/privacy")}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t("preferences")} />
        <ListRow
          icon="language-outline"
          title={t("language")}
          subtitle={lang === "he" ? "עברית" : "English"}
          trailing={
            <TouchableOpacity onPress={toggleLanguage} style={styles.langPill}>
              <Text style={styles.langPillText}>{lang === "he" ? "EN" : "HE"}</Text>
            </TouchableOpacity>
          }
        />
        <ListRow
          icon="notifications-outline"
          title={t("notifications")}
          subtitle={t("emergencyAlertsUpdates")}
          trailing={
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{
                false: tokens.color.border,
                true: tokens.color.primary,
              }}
              thumbColor={tokens.color.bgSurface}
            />
          }
        />
        <ListRow
          icon="location-outline"
          title={t("locationServices")}
          subtitle={t("shareLocationEmergencies")}
          trailing={
            <Switch
              value={locationEnabled}
              onValueChange={setLocationEnabled}
              trackColor={{
                false: tokens.color.border,
                true: tokens.color.primary,
              }}
              thumbColor={tokens.color.bgSurface}
            />
          }
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t("support")} />
        <ListRow
          icon="help-circle-outline"
          title={t("helpFAQ")}
          subtitle={t("getHelpAnswers")}
          onPress={() => router.push("/(tabs)/settings/help")}
        />
        <ListRow
          icon="information-circle-outline"
          title={t("about")}
          subtitle={t("appVersionInfo")}
          onPress={() => router.push("/(tabs)/settings/about")}
        />
      </View>

      <DangerButton
        label={t("logout")}
        onPress={handleLogout}
        fullWidth
        style={styles.logout}
      />
      {user?.email ? (
        <Text style={styles.signedIn}>{user.email}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: tokens.space.lg,
    ...pageStyles.content,
  },
  section: {
    marginBottom: tokens.space.xl,
  },
  langPill: {
    backgroundColor: tokens.color.primaryBg,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.primaryBorder,
    paddingVertical: tokens.space.xs,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.pill,
  },
  langPillText: {
    color: tokens.color.primary,
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.bold,
  },
  logout: {
    marginTop: tokens.space.xl,
  },
  signedIn: {
    marginTop: tokens.space.md,
    textAlign: "center",
    fontSize: tokens.font.caption,
    color: tokens.color.textFaint,
    fontWeight: tokens.fontWeight.medium,
  },
});
