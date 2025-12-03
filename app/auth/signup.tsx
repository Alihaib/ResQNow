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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // role: user | doctor | ambulance
  const [role, setRole] = useState<"user" | "doctor" | "ambulance">("user");

  const signup = async () => {
    if (!email || !password) {
      Alert.alert(t("error"), t("fillAllFields"));
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
        email: email.trim(),
        role,
        approved: !needApproval, // regular users approved immediately
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
        {/* EMAIL */}
        <Text style={styles.label}>{t("email")}</Text>
        <TextInput
          style={styles.input}
          placeholder="example@mail.com"
          placeholderTextColor="#ADB5BD"
          value={email}
          autoCapitalize="none"
          onChangeText={setEmail}
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
// 🎨 STYLES — MATCHES LOGIN
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
    borderRadius: 10,
    zIndex: 10,
  },
  languageText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },

  logo: {
    fontSize: 50,
    textAlign: "center",
    marginBottom: 8,
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
    marginBottom: 22,
  },

  card: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 20,
    elevation: 6,
    
  },

  label: {
    fontSize: 14,
    color: "#495057",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#F1F3F5",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#212529",
  },

  // Role buttons
  roleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 10,
  },
  roleBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#ADB5BD",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 4,
  },
  roleBtnActive: {
    borderColor: "#D62828",
    backgroundColor: "#FFE5E5",
  },
  roleText: {
    fontSize: 14,
    color: "#495057",
    fontWeight: "700",
  },
  roleTextActive: {
    color: "#D62828",
  },

  // Buttons
  primaryBtn: {
    backgroundColor: "#D62828",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 15,
  },
  primaryText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },

  secondaryBtn: {
    marginTop: 15,
    alignItems: "center",
  },
  secondaryText: {
    color: "#003049",
    fontWeight: "600",
    fontSize: 14,
  },
});
