import { useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { PrimaryButton } from "../../../components/ui/Button";
import { useUiDirection } from "../../../components/ui/layout";
import SubScreenShell from "../../../components/ui/SubScreenShell";
import { subScreenStyles } from "../../../components/ui/subScreenStyles";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";
import { pageStyles, tokens } from "../../../src/ui/tokens";

export default function MedicalProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { row } = useUiDirection();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || "");
          setAge(data.age || "");
          setBloodType(data.bloodType || "");
          setWeight(data.weight || "");
          setHeight(data.height || "");
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const saveProfile = async () => {
    if (!user) {
      Alert.alert(t("error"), t("userNotLoggedIn"));
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          name: name.trim(),
          age: age.trim(),
          bloodType: bloodType,
          weight: weight.trim(),
          height: height.trim(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      Alert.alert(t("Success"), t("saveChanges") + " " + t("Success"));
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/profile");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert(t("error"), t("failedToSaveProfile"));
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
      title={t("personalInformation")}
      onBack={goProfile}
      fallbackRoute="/(tabs)/profile"
    >
      <View style={subScreenStyles.section}>
        <Text style={subScreenStyles.label}>{t("full_name")}</Text>
        <TextInput
          style={subScreenStyles.input}
          value={name}
          onChangeText={setName}
          placeholder={t("fullName_placeholder")}
          placeholderTextColor={tokens.color.textFaint}
        />
      </View>

      <View style={subScreenStyles.section}>
        <Text style={subScreenStyles.label}>{t("age")}</Text>
        <TextInput
          style={subScreenStyles.input}
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
          placeholder={t("age")}
          placeholderTextColor={tokens.color.textFaint}
        />
      </View>

      <View style={subScreenStyles.section}>
        <Text style={subScreenStyles.label}>{t("blood_type")}</Text>
        <View style={[styles.bloodTypeRow, row]}>
          {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.bloodTypeBtn,
                bloodType === type && styles.bloodTypeBtnActive,
              ]}
              onPress={() => setBloodType(type)}
            >
              <Text
                style={[
                  styles.bloodTypeText,
                  bloodType === type && styles.bloodTypeTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={subScreenStyles.section}>
        <Text style={subScreenStyles.label}>{t("weight")}</Text>
        <TextInput
          style={subScreenStyles.input}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          placeholder={t("weight")}
          placeholderTextColor={tokens.color.textFaint}
        />
      </View>

      <View style={subScreenStyles.section}>
        <Text style={subScreenStyles.label}>{t("height")}</Text>
        <TextInput
          style={subScreenStyles.input}
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
          placeholder={t("height")}
          placeholderTextColor={tokens.color.textFaint}
        />
      </View>

      <PrimaryButton
        label={saving ? t("loading") : t("saveChanges")}
        onPress={saveProfile}
        disabled={saving}
        loading={saving}
        fullWidth
      />
    </SubScreenShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: tokens.font.h3,
    color: tokens.color.textMuted,
    fontWeight: tokens.fontWeight.medium,
  },
  bloodTypeRow: {
    flexWrap: "wrap",
    gap: tokens.space.sm,
  },
  bloodTypeBtn: {
    width: "22%",
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.lg,
    padding: tokens.space.md,
    alignItems: "center",
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
  },
  bloodTypeBtnActive: {
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primaryBg,
  },
  bloodTypeText: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textMuted,
  },
  bloodTypeTextActive: {
    color: tokens.color.primary,
  },
});
