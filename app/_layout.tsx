// app/_layout.tsx
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/context/AuthContext";
import { EmergencyProvider } from "../src/context/EmergencyContext";
import { LanguageProvider } from "../src/context/LanguageContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <EmergencyProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </EmergencyProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
