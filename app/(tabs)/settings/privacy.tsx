import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../../src/context/LanguageContext";

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [shareLocation, setShareLocation] = useState(true);
  const [shareMedicalInfo, setShareMedicalInfo] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ {t("back")}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t("privacySecurity")}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("dataSharing")}</Text>
        
        <View style={styles.settingCard}>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>{t("shareLocation")}</Text>
            <Text style={styles.settingDescription}>
              {t("allowSharingLocation")}
            </Text>
          </View>
          <Switch
            value={shareLocation}
            onValueChange={setShareLocation}
            trackColor={{ false: "#E9ECEF", true: "#D62828" }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>{t("shareMedicalInfo")}</Text>
            <Text style={styles.settingDescription}>
              {t("allowSharingProfile")}
            </Text>
          </View>
          <Switch
            value={shareMedicalInfo}
            onValueChange={setShareMedicalInfo}
            trackColor={{ false: "#E9ECEF", true: "#D62828" }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>{t("analytics")}</Text>
            <Text style={styles.settingDescription}>
              {t("helpImproveApp")}
            </Text>
          </View>
          <Switch
            value={analytics}
            onValueChange={setAnalytics}
            trackColor={{ false: "#E9ECEF", true: "#D62828" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("dataManagement")}</Text>
        
        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionText}>{t("downloadMyData")}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionText}>{t("deleteAccount")}</Text>
          <Text style={styles.actionTextDanger}>›</Text>
        </TouchableOpacity>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 16,
  },
  settingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: "#6C757D",
    lineHeight: 20,
  },
  actionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
  },
  actionTextDanger: {
    fontSize: 24,
    color: "#DC2626",
  },
  chevron: {
    fontSize: 24,
    color: "#6C757D",
  },
});





