import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import {
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useLanguage } from "../../src/context/LanguageContext";
import { auth, db } from "../../src/firebase/config";

export default function Signup() {
  const router = useRouter();
  const { t, lang, toggleLanguage } = useLanguage();

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  const signup = async () => {
    if (!name || !phoneNumber || !email || !password) {
      Alert.alert(t("error"), t("fillAllFields"));
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert(t("error"), t("invalidPhoneNumber"));
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
    <View style={styles.container}>
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

        {/* EMAIL */}
        <Text style={[styles.label, { marginTop: 16 }]}>{t("email")}</Text>
        <TextInput
          style={styles.input}
          placeholder="example@mail.com"
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
    </View>
  );
}

// ----------------------------
// 🎨 STYLES — Modern Medical Theme
// ----------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingTop: 70,
    paddingHorizontal: 20,
  },

  languageBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "#003049",
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
    fontSize: 36,
    fontWeight: "900",
    color: "#003049",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6C757D",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },

  card: {
    backgroundColor: "white",
    padding: 28,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },

  label: {
    fontSize: 15,
    color: "#212529",
    marginBottom: 8,
    fontWeight: "600",
    marginTop: 4,
  },
  input: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#212529",
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: "#E9ECEF",
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
    borderColor: "#E9ECEF",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  roleBtnActive: {
    borderColor: "#D62828",
    backgroundColor: "#FFF5F5",
    shadowColor: "#D62828",
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
    color: "#D62828",
    fontWeight: "800",
  },

  // Buttons
  primaryBtn: {
    backgroundColor: "#D62828",
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#D62828",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
    color: "#003049",
    fontWeight: "600",
    fontSize: 15,
  },
});
