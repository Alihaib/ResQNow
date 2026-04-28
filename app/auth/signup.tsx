import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
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
import { useLanguage } from "../../src/context/LanguageContext";
import { auth, db } from "../../src/firebase/config";
import { theme } from "../../src/ui/theme";

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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 🌍 Language Switch */}
        <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
          <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
        </TouchableOpacity>

        <Text style={styles.logo}>⛑</Text>
        <Text style={styles.title}>{t("create_account")}</Text>
        <Text style={styles.subtitle}>{t("signup_subtitle")}</Text>

        <View style={styles.card}>
        {/* FULL NAME */}
        <Text style={styles.label}>{t("fullName")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("fullName_placeholder")}
          placeholderTextColor="#ADB5BD"
          value={name}
          autoCapitalize="words"
          onChangeText={setName}
        />

        {/* PHONE NUMBER */}
        <Text style={[styles.label, { marginTop: 16 }]}>{t("phoneNumber")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("phoneNumber_placeholder")}
          placeholderTextColor="#ADB5BD"
          value={phoneNumber}
          keyboardType="phone-pad"
          onChangeText={setPhoneNumber}
        />

        {/* ISRAELI ID */}
        <Text style={[styles.label, { marginTop: 16 }]}>{t("israeliId")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("israeliId_placeholder") || "123456789"}
          placeholderTextColor="#ADB5BD"
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
          placeholderTextColor="#ADB5BD"
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
          placeholderTextColor="#ADB5BD"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* ROLE SELECTOR */}
        <Text style={[styles.label, { marginTop: 12 }]}>{t("select_role")}</Text>

        <View style={styles.roleRow}>
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
        <TouchableOpacity style={styles.primaryBtn} onPress={signup}>
          <Text style={styles.primaryText}>{t("signup")}</Text>
        </TouchableOpacity>

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
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scrollContent: {
    paddingTop: 70,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 40,
  },

  languageBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: theme.colors.text,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  languageText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },

  logo: {
    fontSize: 60,
    textAlign: "center",
    marginBottom: 12,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },

  card: {
    backgroundColor: theme.colors.surface,
    padding: 28,
    borderRadius: 24,
    ...theme.shadow.card,
  },

  label: {
    fontSize: 15,
    color: "#212529",
    marginBottom: 8,
    fontWeight: "600",
    marginTop: 4,
  },
  input: {
    backgroundColor: theme.colors.bg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#212529",
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },

  // Role buttons
  roleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 8,
    gap: 10,
  },
  roleBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  roleBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: "#FFF5F5",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  roleText: {
    fontSize: 14,
    color: "#6C757D",
    fontWeight: "700",
  },
  roleTextActive: {
    color: theme.colors.primary,
    fontWeight: "800",
  },

  // Buttons
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
    ...theme.shadow.primary,
  },
  primaryText: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  secondaryBtn: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 8,
  },
  secondaryText: {
    color: theme.colors.text,
    fontWeight: "600",
    fontSize: 15,
  },
});
