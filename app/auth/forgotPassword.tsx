import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../src/context/LanguageContext";
import { auth } from "../../src/firebase/config";
import { theme } from "../../src/ui/theme";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const router = useRouter();
  const { t, lang, toggleLanguage } = useLanguage();

  const resetPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t("login_error_title"), t("email_required"));
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(t("success"), t("reset_password_sent"));
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/auth/login");
      }
    } catch (e) {
      Alert.alert(t("error"), t("reset_password_failed"));
    }
  };

  return (
    <View style={styles.container}>

      {/* 🌍 Language Switch Button */}
      <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
        <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t("forgot_password")}</Text>
      <Text style={styles.text}>{t("forgot_password_sub")}</Text>

      <TextInput
        style={styles.input}
        placeholder={t("email_placeholder")}
        placeholderTextColor="#ADB5BD"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.primaryBtn} onPress={resetPassword}>
        <Text style={styles.primaryText}>{t("send_reset")}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backText}>{t("back")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: theme.spacing.xxl,
    paddingTop: 70,
    marginTop: 40,
  },

  /* 🌍 Language toggle button at top-right */
  languageBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: theme.colors.text,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    zIndex: 10,
  },
  languageText: {
    color: "#FFF",
    fontWeight: "700",
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 20,
  },
  text: {
    textAlign: "center",
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 25,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    marginBottom: 20,
    ...theme.shadow.primary,
  },
  primaryText: {
    color: theme.colors.surface,
    fontWeight: "700",
    fontSize: 16,
  },
  backText: {
    textAlign: "center",
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: "600",
  },
});
