import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../../components/ui/Button";
import { useLanguage } from "../../src/context/LanguageContext";
import { auth } from "../../src/firebase/config";
import { pageStyles, tokens } from "../../src/ui/tokens";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const router = useRouter();
  const { t, lang, toggleLanguage } = useLanguage();
  const insets = useSafeAreaInsets();

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
    } catch {
      Alert.alert(t("error"), t("reset_password_failed"));
    }
  };

  return (
    <View style={[pageStyles.screen, styles.container, { paddingTop: insets.top + 16 }]}>
      <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
        <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      <View style={styles.brandBadge}>
        <Ionicons name="lock-closed-outline" size={28} color={tokens.color.primary} />
      </View>
      <Text style={styles.title}>{t("forgot_password")}</Text>
      <Text style={styles.subtitle}>{t("forgot_password_sub")}</Text>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder={t("email_placeholder")}
          placeholderTextColor={tokens.color.textFaint}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <PrimaryButton
          label={t("send_reset")}
          onPress={resetPassword}
          fullWidth
          style={{ marginTop: tokens.space.xl }}
        />

        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{t("back")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.xxl,
  },
  languageBtn: {
    position: "absolute",
    top: 56,
    right: tokens.space.lg,
    backgroundColor: tokens.color.primary,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.pill,
    zIndex: 10,
  },
  languageText: {
    color: tokens.color.textOnPrimary,
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.font.caption,
  },
  brandBadge: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.primaryBg,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.space.md,
  },
  title: {
    fontSize: tokens.font.h1,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    textAlign: "center",
    marginBottom: tokens.space.sm,
  },
  subtitle: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textMuted,
    textAlign: "center",
    marginBottom: tokens.space.xl,
    lineHeight: 22,
  },
  card: {
    backgroundColor: tokens.color.bgSurface,
    padding: tokens.space.xl,
    borderRadius: tokens.radius.xxl,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
  },
  input: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: tokens.space.lg,
    fontSize: tokens.font.title,
    color: tokens.color.textPrimary,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
  },
  backBtn: {
    marginTop: tokens.space.lg,
    alignItems: "center",
  },
  backText: {
    color: tokens.color.textMuted,
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
  },
});
