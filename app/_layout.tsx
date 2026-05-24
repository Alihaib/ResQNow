// app/_layout.tsx
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthGuard from "../components/AuthGuard";
import { AiBackground } from "../components/ui/AiBackground";
import { AuthProvider } from "../src/context/AuthContext";
import { EmergencyProvider } from "../src/context/EmergencyContext";
import { LanguageProvider } from "../src/context/LanguageContext";
import { navigationTheme, stackScreenDefaults } from "../src/ui/tokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <View style={styles.appRoot}>
          <AiBackground />
          <View style={styles.appForeground}>
            <LanguageProvider>
              <AuthProvider>
                <EmergencyProvider>
                  <AuthGuard>
                    <Stack screenOptions={stackScreenDefaults} />
                  </AuthGuard>
                </EmergencyProvider>
              </AuthProvider>
            </LanguageProvider>
          </View>
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  appForeground: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
