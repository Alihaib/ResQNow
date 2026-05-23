import { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import ListRow from "../../../components/ui/ListRow";
import SectionHeader from "../../../components/ui/SectionHeader";
import SubScreenShell from "../../../components/ui/SubScreenShell";
import { subScreenStyles } from "../../../components/ui/subScreenStyles";
import { useLanguage } from "../../../src/context/LanguageContext";
import { tokens } from "../../../src/ui/tokens";

const switchProps = {
  trackColor: {
    false: tokens.color.border,
    true: tokens.color.primary,
  },
  thumbColor: tokens.color.bgSurface,
} as const;

export default function PrivacySettingsScreen() {
  const { t } = useLanguage();
  const [shareLocation, setShareLocation] = useState(true);
  const [shareMedicalInfo, setShareMedicalInfo] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  return (
    <SubScreenShell title={t("privacySecurity")} fallbackRoute="/(tabs)/settings">
      <View style={subScreenStyles.section}>
        <SectionHeader title={t("dataSharing")} dense />
        <ListRow
          icon="location-outline"
          title={t("shareLocation")}
          subtitle={t("allowSharingLocation")}
          trailing={
            <Switch
              value={shareLocation}
              onValueChange={setShareLocation}
              {...switchProps}
            />
          }
        />
        <ListRow
          icon="document-text-outline"
          title={t("shareMedicalInfo")}
          subtitle={t("allowSharingProfile")}
          trailing={
            <Switch
              value={shareMedicalInfo}
              onValueChange={setShareMedicalInfo}
              {...switchProps}
            />
          }
        />
        <ListRow
          icon="analytics-outline"
          title={t("analytics")}
          subtitle={t("helpImproveApp")}
          trailing={
            <Switch
              value={analytics}
              onValueChange={setAnalytics}
              {...switchProps}
            />
          }
        />
      </View>

      <View style={subScreenStyles.section}>
        <SectionHeader title={t("dataManagement")} dense />
        <ListRow icon="download-outline" title={t("downloadMyData")} />
        <ListRow
          icon="trash-outline"
          title={t("deleteAccount")}
          destructive
        />
      </View>
    </SubScreenShell>
  );
}

const styles = StyleSheet.create({});
