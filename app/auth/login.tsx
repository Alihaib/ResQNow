import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../../components/ui/Button";
import { useLanguage } from "../../src/context/LanguageContext";
import { auth, db } from "../../src/firebase/config";
import { pageStyles, tokens } from "../../src/ui/tokens";

export default function Login() {
  const router = useRouter();
  const { t, lang, toggleLanguage } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const insets = useSafeAreaInsets();

  const login = async () => {
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password.trim()
      );

      const ref = doc(db, "users", cred.user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data() as any;
        const role = data.role;
        const approved = data.approved;

        if ((role === "doctor" || role === "ambulance") && approved === false) {
          router.replace(role === "doctor" ? "/doctor/pending" : "/ambulance/pending");
          return;
        }
      }

      router.replace("/");
    } catch (e) {
      Alert.alert(t("login_error_title"), t("login_error_msg"));
    }
  };

  return (
    <View style={[pageStyles.screen, styles.container, { paddingTop: insets.top + 16 }]}>
      <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
        <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      <View style={styles.brandBadge}>
        <Ionicons name="medkit" size={32} color={tokens.color.primary} />
      </View>
      <Text style={styles.title}>{t("login_title")}</Text>
      <Text style={styles.subtitle}>{t("login_subtitle")}</Text>

      <View style={styles.card}>
        {/* EMAIL */}
        <Text style={styles.label}>{t("email")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("email_placeholder")}
          placeholderTextColor={tokens.color.textFaint}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />

        {/* PASSWORD */}
        <Text style={styles.label}>{t("password")}</Text>
        <TextInput
          style={styles.input}
          placeholder="●●●●●●●●"
          placeholderTextColor={tokens.color.textFaint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* LOGIN BUTTON */}
        <PrimaryButton
          label={t("login")}
          onPress={login}
          fullWidth
          style={{ marginTop: tokens.space.xl }}
        />

        {/* SIGNUP LINK */}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push("/auth/signup")}
        >
          <Text style={styles.secondaryText}>{t("no_account")}</Text>
        </TouchableOpacity>

        {/* FORGOT PASSWORD */}
        <TouchableOpacity onPress={() => router.push("/auth/forgotPassword")}>
          <Text style={styles.forgotText}>{t("forgot_password")}</Text>
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
    width: 64,
    height: 64,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.primaryBg,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.space.md,
  },
  title: {
    fontSize: tokens.font.display,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    textAlign: "center",
    marginBottom: tokens.space.sm,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textMuted,
    textAlign: "center",
    marginBottom: tokens.space.xxl,
    lineHeight: 22,
  },
  card: {
    backgroundColor: tokens.color.bgSurface,
    padding: tokens.space.xl,
    borderRadius: tokens.radius.xxl,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
  },
  label: {
    fontSize: tokens.font.label,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.sm,
    fontWeight: tokens.fontWeight.semibold,
    marginTop: tokens.space.xs,
  },
  input: {
    backgroundColor: tokens.color.bgPage,
    borderRadius: tokens.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: tokens.space.lg,
    fontSize: tokens.font.title,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.xs,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
  },
  secondaryBtn: {
    marginTop: tokens.space.lg,
    paddingVertical: tokens.space.sm,
    alignItems: "center",
  },
  secondaryText: {
    color: tokens.color.textPrimary,
    fontWeight: tokens.fontWeight.semibold,
    fontSize: tokens.font.label,
  },
  forgotText: {
    marginTop: tokens.space.lg,
    textAlign: "center",
    color: tokens.color.textMuted,
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.medium,
  },
});

