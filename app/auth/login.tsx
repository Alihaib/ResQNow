import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../src/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { useLanguage } from "../../src/context/LanguageContext";

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
        <TouchableOpacity onPress={() => Alert.alert(t("coming_soon"))}>
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
    borderRadius: 10,
    zIndex: 10,
  },
  languageText: { color: "#FFF", fontWeight: "700" },

  logo: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: 6,
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#003049",
    textAlign: "center",
  },

  subtitle: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    padding: 22,
    borderRadius: 20,
    elevation: 5,
  },

  label: {
    fontSize: 14,
    color: "#495057",
    marginBottom: 4,
    marginTop: 10,
  },

  input: {
    backgroundColor: "#F1F3F5",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#212529",
  },

  primaryBtn: {
    backgroundColor: "#D62828",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  secondaryBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryText: {
    color: "#003049",
    fontWeight: "600",
    fontSize: 14,
  },

  forgotText: {
    marginTop: 10,
    textAlign: "center",
    color: "#6C757D",
    fontSize: 13,
  },
});

