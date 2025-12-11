import { Tabs } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { useLanguage } from "../../src/context/LanguageContext";

export default function TabsLayout() {
  const { t } = useLanguage();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#D62828",
        tabBarInactiveTintColor: "#6C757D",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E9ECEF",
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab_home"),
          tabBarIcon: () => <Text style={styles.icon}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="emergency"
        options={{
          title: t("tab_emergency"),
          tabBarIcon: () => <Text style={styles.icon}>🚨</Text>,
        }}
      />
      <Tabs.Screen
        name="firstaid"
        options={{
          title: t("tab_firstaid"),
          tabBarIcon: () => <Text style={styles.icon}>⛑</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab_profile"),
          tabBarIcon: () => <Text style={styles.icon}>👤</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tab_settings"),
          tabBarIcon: () => <Text style={styles.icon}>⚙️</Text>,
        }}
      />
      {/* Hide nested routes from tab bar */}
      <Tabs.Screen
        name="emergency/active"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="firstaid/[category]"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="profile/medical"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/history"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/contacts"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/emergency-history"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/medical-records"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings/privacy"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings/help"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings/about"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 24,
  },
});


