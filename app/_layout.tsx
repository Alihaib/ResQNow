// app/_layout.tsx
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthGuard from "../components/AuthGuard";
import { AuthProvider } from "../src/context/AuthContext";
import { EmergencyProvider } from "../src/context/EmergencyContext";
import { LanguageProvider } from "../src/context/LanguageContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <EmergencyProvider>
            <AuthGuard>
              <Stack screenOptions={{ headerShown: false }} />
            </AuthGuard>
          </EmergencyProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
