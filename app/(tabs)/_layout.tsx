import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { useLanguage } from "../../src/context/LanguageContext";
import { tokens } from "../../src/ui/tokens";

function TabBarBackground() {
  if (Platform.OS === "android") {
    return (
      <View style={styles.tabBarAndroid}>
        <View style={styles.tabBarBorder} />
      </View>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={88} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.tabBarTint} />
      <View style={styles.tabBarBorder} />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.color.primary,
        tabBarInactiveTintColor: tokens.color.textMuted,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === "ios" ? 84 : 68,
          paddingBottom: Platform.OS === "ios" ? 24 : tokens.space.sm,
          paddingTop: tokens.space.sm,
        },
        tabBarLabelStyle: {
          fontSize: tokens.font.caption,
          fontWeight: tokens.fontWeight.semibold,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab_home"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="home-outline"
              activeName="home"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="emergency"
        options={{
          title: t("tab_emergency"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="alert-circle-outline"
              activeName="alert-circle"
              color={focused ? tokens.color.danger : color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="firstaid"
        options={{
          title: t("tab_firstaid"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="medkit-outline"
              activeName="medkit"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab_profile"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="person-outline"
              activeName="person"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tab_settings"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="settings-outline"
              activeName="settings"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen name="emergency/active" options={{ href: null }} />
      <Tabs.Screen name="profile/medical" options={{ href: null }} />
      <Tabs.Screen name="profile/history" options={{ href: null }} />
      <Tabs.Screen name="profile/contacts" options={{ href: null }} />
      <Tabs.Screen name="profile/emergency-history" options={{ href: null }} />
      <Tabs.Screen name="profile/medical-records" options={{ href: null }} />
      <Tabs.Screen name="settings/privacy" options={{ href: null }} />
      <Tabs.Screen name="settings/help" options={{ href: null }} />
      <Tabs.Screen name="settings/about" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarAndroid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
  },
  tabBarTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(246, 248, 251, 0.4)",
  },
  tabBarBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: tokens.hairline,
    backgroundColor: tokens.color.border,
  },
});
