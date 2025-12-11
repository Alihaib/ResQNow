import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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

export default function Login() {
  const router = useRouter();
  const { t, lang, toggleLanguage } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
    <View style={styles.container}>

      {/* 🌍 Language Switch */}
      <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
        <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      <Text style={styles.logo}>⛑</Text>
      <Text style={styles.title}>{t("login_title")}</Text>
      <Text style={styles.subtitle}>{t("login_subtitle")}</Text>

      <View style={styles.card}>
        {/* EMAIL */}
        <Text style={styles.label}>{t("email")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("email_placeholder")}
          placeholderTextColor="#ADB5BD"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />

        {/* PASSWORD */}
        <Text style={styles.label}>{t("password")}</Text>
        <TextInput
          style={styles.input}
          placeholder="●●●●●●●●"
          placeholderTextColor="#ADB5BD"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* LOGIN BUTTON */}
        <TouchableOpacity style={styles.primaryBtn} onPress={login}>
          <Text style={styles.primaryText}>{t("login")}</Text>
        </TouchableOpacity>

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
    color: "#FFF", 
    fontWeight: "700",
    fontSize: 14,
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
    backgroundColor: "#FFFFFF",
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
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  secondaryBtn: {
    marginTop: 20,
    paddingVertical: 8,
    alignItems: "center",
  },
  secondaryText: {
    color: "#003049",
    fontWeight: "600",
    fontSize: 15,
  },

  forgotText: {
    marginTop: 16,
    textAlign: "center",
    color: "#6C757D",
    fontSize: 14,
    fontWeight: "500",
  },
});

