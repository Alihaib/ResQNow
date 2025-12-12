import { useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";

export default function MedicalProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  // Load existing profile data
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
      Alert.alert(t("error"), "User not logged in");
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
        { merge: true }
      );
      Alert.alert(t("Success"), t("saveChanges") + " " + t("Success"));
      router.back();
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert(t("error"), "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>{t("loading")}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ {t("back")}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t("personalInformation")}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t("full_name")}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t("fullName_placeholder")}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t("age")}</Text>
        <TextInput
          style={styles.input}
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
          placeholder={t("age")}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t("blood_type")}</Text>
        <View style={styles.bloodTypeRow}>
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

      <View style={styles.section}>
        <Text style={styles.label}>{t("weight")}</Text>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          placeholder={t("weight")}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t("height")}</Text>
        <TextInput
          style={styles.input}
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
          placeholder={t("height")}
        />
      </View>

      <TouchableOpacity 
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]} 
        onPress={saveProfile}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>
          {saving ? t("loading") : t("saveChanges")}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  content: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 18,
    color: "#003049",
    fontWeight: "700",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#003049",
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "#E9ECEF",
  },
  bloodTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bloodTypeBtn: {
    width: "22%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E9ECEF",
  },
  bloodTypeBtnActive: {
    borderColor: "#D62828",
    backgroundColor: "#FFF5F5",
  },
  bloodTypeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6C757D",
  },
  bloodTypeTextActive: {
    color: "#D62828",
  },
  saveBtn: {
    backgroundColor: "#D62828",
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#D62828",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#6C757D",
  },
});


