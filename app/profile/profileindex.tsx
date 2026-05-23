import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Card from "../../components/ui/Card";
import { DangerButton, PrimaryButton } from "../../components/ui/Button";
import ListRow from "../../components/ui/ListRow";
import SubScreenShell from "../../components/ui/SubScreenShell";
import { subScreenStyles } from "../../components/ui/subScreenStyles";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";
import { useUiDirection } from "../../components/ui/layout";
import { tokens } from "../../src/ui/tokens";

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const { row } = useUiDirection();

  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState({
    name: "",
    age: "",
    weight: "",
    height: "",
    bloodType: "",
    medicalInfo: "",
    diseases: "",
    medications: "",
    sensitiveNotes: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as typeof profile);
        }
      } catch (e) {
        console.error("Failed to load profile:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;

    try {
      await setDoc(doc(db, "users", user.uid), profile, { merge: true });
      Alert.alert(t("save_update_profile") + "!");
    } catch (e) {
      console.error(e);
      Alert.alert(t("signupFailed"));
    }
  };

  const bmi =
    profile.weight && profile.height
      ? Number(profile.weight) / (Number(profile.height) / 100) ** 2
      : 0;

  const bmiCategory = (value: number) => {
    if (value === 0) return t("coming_soon");
    if (value < 18.5) return t("Underweight");
    if (value < 25) return t("Normal");
    if (value < 30) return t("Overweight");
    return t("Obese");
  };

  const bmiColor = (value: number) => {
    if (value === 0) return tokens.color.textFaint;
    if (value < 18.5) return tokens.color.warning;
    if (value < 25) return tokens.color.success;
    if (value < 30) return tokens.color.warning;
    return tokens.color.danger;
  };

  const bloodCompatibility = (type?: string) => {
    if (!type) return { donateTo: "N/A", receiveFrom: "N/A" };
    const formatted = type.trim().toUpperCase();
    switch (formatted) {
      case "A+":
        return { donateTo: "A+, AB+", receiveFrom: "A+, A-, O+, O-" };
      case "A-":
        return { donateTo: "A+, A-, AB+, AB-", receiveFrom: "A-, O-" };
      case "B+":
        return { donateTo: "B+, AB+", receiveFrom: "B+, B-, O+, O-" };
      case "B-":
        return { donateTo: "B+, B-, AB+, AB-", receiveFrom: "B-, O-" };
      case "AB+":
        return { donateTo: "AB+", receiveFrom: t("everyone") };
      case "AB-":
        return { donateTo: "AB+, AB-", receiveFrom: "A-, B-, AB-, O-" };
      case "O+":
        return { donateTo: "O+, A+, B+, AB+", receiveFrom: "O+, O-" };
      case "O-":
        return { donateTo: t("everyone"), receiveFrom: "O-" };
      default:
        return { donateTo: "N/A", receiveFrom: "N/A" };
    }
  };

  const { donateTo, receiveFrom } = bloodCompatibility(profile.bloodType);

  const normalBP = () => {
    if (!profile.age) return "N/A";
    const age = Number(profile.age);
    return age < 18 ? "90-120 / 60-80 mmHg" : "110-130 / 70-85 mmHg";
  };

  const normalHR = () => {
    if (!profile.age) return "N/A";
    const age = Number(profile.age);
    return age < 18 ? "70-100 bpm" : "60-100 bpm";
  };

  const maintenanceCalories = () => {
    if (!profile.weight || !profile.height || !profile.age) return "N/A";
    const weight = Number(profile.weight);
    const height = Number(profile.height);
    const age = Number(profile.age);
    const calories = 10 * weight + 6.25 * height - 5 * age + 5;
    return Math.round(calories);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tokens.color.primary} />
        <Text style={styles.loadingText}>{t("loading")}</Text>
      </View>
    );
  }

  return (
    <SubScreenShell
      title={`${t("hello_user")}, ${user?.email || t("user")}!`}
      eyebrow={t("manage_health_profile")}
      fallbackRoute="/(tabs)/profile"
    >
      <ListRow
        icon="language-outline"
        title={lang === "en" ? "עברית" : "English"}
        subtitle={t("change_language") || undefined}
        onPress={toggleLanguage}
      />

      <Card style={subScreenStyles.card}>
        <Text style={subScreenStyles.label}>{t("personal_info")}</Text>
        <TextInput
          style={[subScreenStyles.input, styles.field]}
          placeholder={t("full_name")}
          placeholderTextColor={tokens.color.textFaint}
          value={profile.name}
          onChangeText={(text) => setProfile({ ...profile, name: text })}
        />
        <TextInput
          style={[subScreenStyles.input, styles.field]}
          placeholder={t("age")}
          placeholderTextColor={tokens.color.textFaint}
          value={profile.age}
          onChangeText={(text) => setProfile({ ...profile, age: text })}
          keyboardType="numeric"
        />
        <TextInput
          style={[subScreenStyles.input, styles.field]}
          placeholder={t("weight")}
          placeholderTextColor={tokens.color.textFaint}
          value={profile.weight}
          onChangeText={(text) => setProfile({ ...profile, weight: text })}
          keyboardType="numeric"
        />
        <TextInput
          style={[subScreenStyles.input, styles.field]}
          placeholder={t("height")}
          placeholderTextColor={tokens.color.textFaint}
          value={profile.height}
          onChangeText={(text) => setProfile({ ...profile, height: text })}
          keyboardType="numeric"
        />
        <TextInput
          style={[subScreenStyles.input, styles.field]}
          placeholder={t("blood_type")}
          placeholderTextColor={tokens.color.textFaint}
          value={profile.bloodType}
          onChangeText={(text) => setProfile({ ...profile, bloodType: text })}
        />
      </Card>

      <Card style={subScreenStyles.card}>
        <Text style={subScreenStyles.label}>{t("medical_info")}</Text>
        <TextInput
          style={[subScreenStyles.input, styles.field, styles.multiline]}
          placeholder={t("medical_history")}
          placeholderTextColor={tokens.color.textFaint}
          value={profile.medicalInfo}
          onChangeText={(text) => setProfile({ ...profile, medicalInfo: text })}
          multiline
        />
        <TextInput
          style={[subScreenStyles.input, styles.field, styles.multiline]}
          placeholder={t("diseases")}
          placeholderTextColor={tokens.color.textFaint}
          value={profile.diseases}
          onChangeText={(text) => setProfile({ ...profile, diseases: text })}
          multiline
        />
        <TextInput
          style={[subScreenStyles.input, styles.field, styles.multiline]}
          placeholder={t("medications")}
          placeholderTextColor={tokens.color.textFaint}
          value={profile.medications}
          onChangeText={(text) => setProfile({ ...profile, medications: text })}
          multiline
        />
        <TextInput
          style={[subScreenStyles.input, styles.field, styles.multiline]}
          placeholder={t("sensitive_notes")}
          placeholderTextColor={tokens.color.textFaint}
          value={profile.sensitiveNotes}
          onChangeText={(text) => setProfile({ ...profile, sensitiveNotes: text })}
          multiline
        />
      </Card>

      <PrimaryButton
        label={t("save_update_profile")}
        onPress={saveProfile}
        fullWidth
        style={styles.actionBtn}
      />

      <DangerButton
        label={t("logout")}
        onPress={async () => {
          await logout();
          router.replace("../../auth/login");
        }}
        fullWidth
        style={styles.actionBtn}
      />

      <Card style={subScreenStyles.card}>
        <Text style={subScreenStyles.label}>{t("bmi_calculator")}</Text>
        <Text style={styles.meta}>
          {t("age")}: <Text style={styles.metaValue}>{profile.age || "—"}</Text>
        </Text>
        <Text style={styles.meta}>
          {t("weight")}: <Text style={styles.metaValue}>{profile.weight || "—"} kg</Text>
        </Text>
        <Text style={styles.meta}>
          {t("height")}: <Text style={styles.metaValue}>{profile.height || "—"} cm</Text>
        </Text>
        <Text style={styles.bmiText}>
          {t("your_bmi")}: {bmi.toFixed(1)}
        </Text>
        <Text style={[styles.bmiCategory, { color: bmiColor(bmi) }]}>
          {bmiCategory(bmi)}
        </Text>
        <View style={styles.bmiBarContainer}>
          <View
            style={[
              styles.bmiBar,
              { width: `${Math.min(bmi * 3, 100)}%`, backgroundColor: bmiColor(bmi) },
            ]}
          />
        </View>
        <Text style={styles.bmiGuide}>
          {"< 18.5: " +
            t("Underweight") +
            " | 18.5-24.9: " +
            t("Normal") +
            " | 25-29.9: " +
            t("Overweight") +
            " | ≥ 30: " +
            t("Obese")}
        </Text>
      </Card>

      <Card style={subScreenStyles.card}>
        <Text style={subScreenStyles.label}>{t("blood_type_info")}</Text>
        <Text style={styles.meta}>
          {t("your_blood_type")}: <Text style={styles.metaValue}>{profile.bloodType || "N/A"}</Text>
        </Text>
        <Text style={styles.meta}>
          {t("can_donate_to")}: <Text style={styles.metaValue}>{donateTo}</Text>
        </Text>
        <Text style={styles.meta}>
          {t("can_receive_from")}: <Text style={styles.metaValue}>{receiveFrom}</Text>
        </Text>
      </Card>

      <Card style={subScreenStyles.card}>
        <View style={[styles.vitalsRow, row]}>
          <Ionicons name="pulse-outline" size={20} color={tokens.color.primary} />
          <Text style={subScreenStyles.label}>{t("blood_pressure") || "Blood pressure"}</Text>
        </View>
        <Text style={styles.metaValue}>{normalBP()}</Text>
      </Card>

      <Card style={subScreenStyles.card}>
        <View style={[styles.vitalsRow, row]}>
          <Ionicons name="heart-outline" size={20} color={tokens.color.danger} />
          <Text style={subScreenStyles.label}>{t("heart_rate") || "Heart rate"}</Text>
        </View>
        <Text style={styles.metaValue}>{normalHR()}</Text>
      </Card>

      <Card style={subScreenStyles.card}>
        <Text style={subScreenStyles.label}>{t("emergency_contact")}</Text>
        <TextInput
          style={[subScreenStyles.input, styles.field]}
          placeholder={t("contact_name")}
          placeholderTextColor={tokens.color.textFaint}
          value={profile.emergencyContactName}
          onChangeText={(text) =>
            setProfile({ ...profile, emergencyContactName: text })
          }
        />
        <TouchableOpacity
          onPress={() =>
            profile.emergencyContactPhone &&
            Linking.openURL(`tel:${profile.emergencyContactPhone}`)
          }
        >
          <TextInput
            style={[subScreenStyles.input, styles.field, styles.phoneInput]}
            placeholder={t("contact_phone")}
            placeholderTextColor={tokens.color.textFaint}
            value={profile.emergencyContactPhone}
            onChangeText={(text) =>
              setProfile({ ...profile, emergencyContactPhone: text })
            }
            keyboardType="phone-pad"
          />
        </TouchableOpacity>
      </Card>

      <Card style={subScreenStyles.card}>
        <Text style={subScreenStyles.label}>{t("calorie_calculator")}</Text>
        <Text style={styles.meta}>
          {t("estimated_daily_calories")}:{" "}
          <Text style={styles.metaValue}>{maintenanceCalories()} kcal</Text>
        </Text>
      </Card>
    </SubScreenShell>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: tokens.color.bgPage,
    gap: tokens.space.sm,
  },
  loadingText: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textSecondary,
    fontWeight: tokens.fontWeight.medium,
  },
  field: {
    marginBottom: tokens.space.sm,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  phoneInput: {
    color: tokens.color.danger,
  },
  actionBtn: {
    marginBottom: tokens.space.md,
  },
  meta: {
    fontSize: tokens.font.body,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textMuted,
    marginTop: tokens.space.xs,
  },
  metaValue: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.bold,
    color: tokens.color.textPrimary,
  },
  bmiText: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.bold,
    marginTop: tokens.space.sm,
    color: tokens.color.textPrimary,
  },
  bmiCategory: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.bold,
    marginBottom: tokens.space.sm,
  },
  bmiBarContainer: {
    width: "100%",
    height: 18,
    backgroundColor: tokens.color.neutralBg,
    borderRadius: tokens.radius.sm,
    overflow: "hidden",
    marginBottom: tokens.space.sm,
  },
  bmiBar: {
    height: "100%",
    borderRadius: tokens.radius.sm,
  },
  bmiGuide: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    lineHeight: 18,
  },
  vitalsRow: {
    alignItems: "center",
    gap: tokens.space.sm,
    marginBottom: tokens.space.xs,
  },
});
