import { useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { PrimaryButton } from "../../../components/ui/Button";
import SubScreenShell from "../../../components/ui/SubScreenShell";
import { subScreenStyles } from "../../../components/ui/subScreenStyles";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";
import { pageStyles, tokens } from "../../../src/ui/tokens";

export default function MedicalHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diseases, setDiseases] = useState("");
  const [medications, setMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");

  // Load existing medical history
  useEffect(() => {
    if (!user) return;

    const loadHistory = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDiseases(data.diseases || "");
          setMedications(data.medications || "");
          setAllergies(data.allergies || "");
          setNotes(data.sensitiveNotes || "");
        }
      } catch (error) {
        console.error("Error loading medical history:", error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [user]);

  const saveHistory = async () => {
    if (!user) {
      Alert.alert(t("error"), t("userNotLoggedIn"));
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          diseases: diseases.trim(),
          medications: medications.trim(),
          allergies: allergies.trim(),
          sensitiveNotes: notes.trim(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      Alert.alert(t("Success"), t("saveChanges") + " " + t("Success"));
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/profile");
      }
    } catch (error) {
      console.error("Error saving medical history:", error);
      Alert.alert(t("error"), t("failedToSaveMedicalHistory"));
    } finally {
      setSaving(false);
    }
  };

  const goProfile = () => router.replace("/(tabs)/profile");

  if (loading) {
    return (
      <View style={[pageStyles.screen, styles.center]}>
        <Text style={styles.loadingText}>{t("loading")}</Text>
      </View>
    );
  }

  return (
    <SubScreenShell
      title={t("medical_history")}
      onBack={goProfile}
      fallbackRoute="/(tabs)/profile"
    >
      <View style={subScreenStyles.section}>
        <Text style={subScreenStyles.label}>{t("diseases")}</Text>
        <TextInput
          style={styles.textArea}
          value={diseases}
          onChangeText={setDiseases}
          placeholder={t("diseases")}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={subScreenStyles.section}>
        <Text style={subScreenStyles.label}>{t("medications")}</Text>
        <TextInput
          style={styles.textArea}
          value={medications}
          onChangeText={setMedications}
          placeholder={t("medications")}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={subScreenStyles.section}>
        <Text style={subScreenStyles.label}>{t("allergies")}</Text>
        <TextInput
          style={styles.textArea}
          value={allergies}
          onChangeText={setAllergies}
          placeholder={t("allergies")}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={subScreenStyles.section}>
        <Text style={subScreenStyles.label}>{t("sensitive_notes")}</Text>
        <TextInput
          style={styles.textArea}
          value={notes}
          onChangeText={setNotes}
          placeholder={t("sensitive_notes")}
          multiline
          numberOfLines={4}
        />
      </View>

      <PrimaryButton
        label={saving ? t("loading") : t("saveChanges")}
        onPress={saveHistory}
        disabled={saving}
        loading={saving}
        fullWidth
      />
    </SubScreenShell>
  );
}

const styles = StyleSheet.create({
  textArea: {
    ...subScreenStyles.input,
    minHeight: 100,
    textAlignVertical: "top",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: tokens.color.textMuted,
  },
});


