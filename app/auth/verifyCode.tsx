import { useRouter } from "expo-router";
import { deleteDoc, doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";

export default function VerifyCode({ route }: any) {
  const router = useRouter();
  const { t, lang, toggleLanguage } = useLanguage();

  // Get UID from router params
  const uid = route?.params?.uid;

  const [codeInput, setCodeInput] = useState("");

  useEffect(() => {
    if (!uid) {
      Alert.alert(t("error"), t("invalid_request"), [
        { text: t("ok"), onPress: () => router.replace("/auth/login") },
      ]);
    }
  }, [uid]);

  const verifyCode = async () => {
    if (!uid) return;

    try {
      const ref = doc(db, "emailVerificationCodes", uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        Alert.alert(t("error"), t("code_not_found"));
        return;
      }

      const data = snap.data() as any;
      if (data.code === codeInput.trim()) {
        // Code is correct
        await deleteDoc(ref);
        Alert.alert(t("success"), t("code_verified"), [
          { text: t("ok"), onPress: () => router.replace("/") },
        ]);
      } else {
        Alert.alert(t("error"), t("code_invalid"));
      }
    } catch (e) {
      Alert.alert(t("error"), t("something_went_wrong"));
    }
  };

  return (
    <View style={styles.container}>
      {/* Language Switch */}
      <TouchableOpacity style={styles.languageBtn} onPress={toggleLanguage}>
        <Text style={styles.languageText}>{lang === "he" ? "EN" : "HE"}</Text>
      </TouchableOpacity>

      <Text style={styles.logo}>⛑</Text>
      <Text style={styles.title}>{t("verify_code_title")}</Text>
      <Text style={styles.subtitle}>{t("verify_code_subtitle")}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>{t("enter_code_label")}</Text>
        <TextInput
          style={styles.input}
          placeholder="123456"
          placeholderTextColor="#ADB5BD"
          keyboardType="numeric"
          value={codeInput}
          onChangeText={setCodeInput}
          maxLength={6}
        />

        <TouchableOpacity style={styles.primaryBtn} onPress={verifyCode}>
          <Text style={styles.primaryText}>{t("verify_code_btn")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace("/auth/login")}
          style={styles.secondaryBtn}
        >
          <Text style={styles.secondaryText}>{t("back_to_login")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// 🖌️ Styles (same as login page)
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
  logo: { fontSize: 48, textAlign: "center", marginBottom: 6 },
  title: { fontSize: 32, fontWeight: "900", color: "#003049", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6C757D", textAlign: "center", marginBottom: 20 },
  card: { backgroundColor: "#FFFFFF", padding: 22, borderRadius: 20, elevation: 5, marginTop: 50 },
  label: { fontSize: 14, color: "#495057", marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: "#F1F3F5", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, fontSize: 15, color: "#212529", textAlign: "center", letterSpacing: 4 },
  primaryBtn: { backgroundColor: "#D62828", paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 20 },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondaryBtn: { marginTop: 10, paddingVertical: 10, alignItems: "center" },
  secondaryText: { color: "#003049", fontWeight: "600", fontSize: 14 },
});
