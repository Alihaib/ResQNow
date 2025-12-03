import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../src/context/LanguageContext";
import { auth } from "../../src/firebase/config";

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
      router.back();
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
    backgroundColor: "#F8F9FA",
    padding: 30,
    paddingTop: 70,
    marginTop:40
  },

  /* 🌍 Language toggle button at top-right */
  languageBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "#003049",
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
    color: "#003049",
    textAlign: "center",
    marginBottom: 20,
  },
  text: {
    textAlign: "center",
    fontSize: 14,
    color: "#6C757D",
    marginBottom: 25,
  },
  input: {
    backgroundColor: "#F1F3F5",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: "#D62828",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  primaryText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },
  backText: {
    textAlign: "center",
    fontSize: 14,
    color: "#003049",
    fontWeight: "600",
  },
});
