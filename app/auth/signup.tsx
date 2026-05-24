import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../../components/ui/Button";
import { useUiDirection } from "../../components/ui/layout";
import { useLanguage } from "../../src/context/LanguageContext";
import { auth, db } from "../../src/firebase/config";
import { pageStyles, tokens } from "../../src/ui/tokens";

export default function Signup() {
  const router = useRouter();
  const { t, lang, toggleLanguage } = useLanguage();

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [israeliId, setIsraeliId] = useState("");

  // role: user | doctor | ambulance
  const [role, setRole] = useState<"user" | "doctor" | "ambulance">("user");
  const insets = useSafeAreaInsets();
  const { row } = useUiDirection();

  // Phone number validation — Israeli format:
  // Accepts local (05x-xxxxxxx) or international (+9725x-xxxxxxx) and landlines (0[2-9]xxxxxxx)
  const validatePhoneNumber = (phone: string): boolean => {
    const digits = phone.replace(/\D/g, "");

    const toLocal = () => {
      if (digits.startsWith("972")) {
        return `0${digits.slice(3)}`;
      }
      return digits;
    };

    const local = toLocal();
    const mobilePattern = /^05\d{8}$/; // 10 digits starting with 05
    const landlinePattern = /^0[2-9]\d{7}$/; // 9 digits starting with 0 and area code 2-9

    return mobilePattern.test(local) || landlinePattern.test(local);
  };

  // Israeli ID validation - exactly 9 digits
  const validateIsraeliId = (id: string): boolean => {
    const digits = id.replace(/\D/g, "");
    return digits.length === 9 && /^\d{9}$/.test(digits);
  };

  const signup = async () => {
    if (!name || !phoneNumber || !email || !password || !israeliId) {
      Alert.alert(t("error"), t("fillAllFields"));
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert(t("error"), t("invalidPhoneNumber"));
      return;
    }

    if (!validateIsraeliId(israeliId)) {
      Alert.alert(t("error"), t("invalidIsraeliId"));
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password.trim()
      );

      // Doctors & ambulance require admin approval
      const needApproval = role === "doctor" || role === "ambulance";

      await setDoc(doc(db, "users", cred.user.uid), {
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
        israeliId: israeliId.replace(/\D/g, ""), // Store only digits
        role,
        approved: !needApproval, // regular users approved immediately
        createdAt: new Date().toISOString(),
      });

      if (needApproval) {
        if (role === "doctor") router.replace("/doctor/pending");
        else router.replace("/ambulance/pending");
      } else {
        router.replace("/");
      }
    } catch (err: any) {
      console.log(err);
      Alert.alert(t("error"), t("signupFailed"));
    }
  };

  return (
    <KeyboardAvoidingView
      style={pageStyles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
          <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
        </TouchableOpacity>

        <View style={styles.brandBadge}>
          <Ionicons name="person-add" size={28} color={tokens.color.primary} />
        </View>
        <Text style={styles.title}>{t("create_account")}</Text>
        <Text style={styles.subtitle}>{t("signup_subtitle")}</Text>

        <View style={styles.card}>
        {/* FULL NAME */}
        <Text style={styles.label}>{t("fullName")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("fullName_placeholder")}
          placeholderTextColor={tokens.color.textFaint}
          value={name}
          autoCapitalize="words"
          onChangeText={setName}
        />

        {/* PHONE NUMBER */}
        <Text style={[styles.label, { marginTop: 16 }]}>{t("phoneNumber")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("phoneNumber_placeholder")}
          placeholderTextColor={tokens.color.textFaint}
          value={phoneNumber}
          keyboardType="phone-pad"
          onChangeText={setPhoneNumber}
        />

        {/* ISRAELI ID */}
        <Text style={[styles.label, { marginTop: 16 }]}>{t("israeliId")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("israeliId_placeholder") || "123456789"}
          placeholderTextColor={tokens.color.textFaint}
          value={israeliId}
          keyboardType="number-pad"
          maxLength={9}
          onChangeText={(text) => {
            // Only allow digits
            const digits = text.replace(/\D/g, "");
            setIsraeliId(digits);
          }}
        />

        {/* EMAIL */}
        <Text style={[styles.label, { marginTop: 16 }]}>{t("email")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("email_placeholder")}
          placeholderTextColor={tokens.color.textFaint}
          value={email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
        />

        {/* PASSWORD */}
        <Text style={[styles.label, { marginTop: 16 }]}>{t("password")}</Text>
        <TextInput
          style={styles.input}
          placeholder="●●●●●●●●"
          placeholderTextColor={tokens.color.textFaint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* ROLE SELECTOR */}
        <Text style={[styles.label, { marginTop: 12 }]}>{t("select_role")}</Text>

        <View style={[styles.roleRow, row]}>
          {["user", "doctor", "ambulance"].map((r) => (
            <TouchableOpacity
              key={r}
              style={[
                styles.roleBtn,
                role === r && styles.roleBtnActive,
              ]}
              onPress={() => setRole(r as any)}
            >
              <Text
                style={[
                  styles.roleText,
                  role === r && styles.roleTextActive,
                ]}
              >
                {t(r)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SIGNUP BUTTON */}
        <PrimaryButton
          label={t("signup")}
          onPress={signup}
          fullWidth
          style={{ marginTop: tokens.space.xl }}
        />

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push("/auth/login")}
        >
          <Text style={styles.secondaryText}>{t("have_account")}</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ----------------------------
// 🎨 STYLES — Modern Medical Theme
// ----------------------------
const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: tokens.space.lg,
  },
  languageBtn: {
    position: "absolute",
    top: 56,
    end: tokens.space.lg,
    backgroundColor: tokens.color.primary,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.pill,
    zIndex: 10,
  },
  languageText: {
    color: tokens.color.textOnPrimary,
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.bold,
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
    fontSize: tokens.font.display,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    textAlign: "center",
    letterSpacing: -0.4,
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
  label: {
    fontSize: tokens.font.label,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.sm,
    fontWeight: tokens.fontWeight.semibold,
    marginTop: tokens.space.xs,
  },
  input: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: tokens.space.lg,
    fontSize: tokens.font.title,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.xs,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
  },
  roleRow: {
    justifyContent: "space-between",
    marginTop: tokens.space.md,
    marginBottom: tokens.space.sm,
    gap: tokens.space.sm,
  },
  roleBtn: {
    flex: 1,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.lg,
    alignItems: "center",
    backgroundColor: tokens.color.bgSurface,
  },
  roleBtnActive: {
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primaryBg,
  },
  roleText: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    fontWeight: tokens.fontWeight.semibold,
  },
  roleTextActive: {
    color: tokens.color.primary,
    fontWeight: tokens.fontWeight.bold,
  },
  secondaryBtn: {
    marginTop: tokens.space.lg,
    alignItems: "center",
    paddingVertical: tokens.space.sm,
  },
  secondaryText: {
    color: tokens.color.textPrimary,
    fontWeight: tokens.fontWeight.semibold,
    fontSize: tokens.font.label,
  },
});
