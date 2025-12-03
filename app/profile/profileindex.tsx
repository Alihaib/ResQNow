import { useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();

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
          setProfile(docSnap.data() as any);
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
      alert(t("save_update_profile") + "!");
    } catch (e) {
      console.error(e);
      alert(t("signupFailed"));
    }
  };

  const bmi = profile.weight && profile.height
    ? Number(profile.weight) / ((Number(profile.height) / 100) ** 2)
    : 0;

  const bmiCategory = (bmi: number) => {
    if (bmi === 0) return t("coming_soon");
    if (bmi < 18.5) return t("Underweight");
    if (bmi < 25) return t("Normal");
    if (bmi < 30) return t("Overweight");
    return t("Obese");
  };

  const bmiColor = (bmi: number) => {
    if (bmi === 0) return "#ccc";
    if (bmi < 18.5) return "#f0ad4e";
    if (bmi < 25) return "#28a745";
    if (bmi < 30) return "#ffc107";
    return "#dc3545";
  };

  const bloodCompatibility = (type?: string) => {
    if (!type) return { donateTo: "N/A", receiveFrom: "N/A" };
    const formatted = type.trim().toUpperCase();
    switch (formatted) {
      case "A+": return { donateTo: "A+, AB+", receiveFrom: "A+, A-, O+, O-" };
      case "A-": return { donateTo: "A+, A-, AB+, AB-", receiveFrom: "A-, O-" };
      case "B+": return { donateTo: "B+, AB+", receiveFrom: "B+, B-, O+, O-" };
      case "B-": return { donateTo: "B+, B-, AB+, AB-", receiveFrom: "B-, O-" };
      case "AB+": return { donateTo: "AB+", receiveFrom: t("everyone") };
      case "AB-": return { donateTo: "AB+, AB-", receiveFrom: "A-, B-, AB-, O-" };
      case "O+": return { donateTo: "O+, A+, B+, AB+", receiveFrom: "O+, O-" };
      case "O-": return { donateTo: t("everyone"), receiveFrom: "O-" };
      default: return { donateTo: "N/A", receiveFrom: "N/A" };
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
        <ActivityIndicator size="large" color="#e63946" />
        <Text style={{ marginTop: 10, color: "#1d3557" }}>{t("loading")}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>{t("hello_user")}, {user?.email || t("user")}!</Text>
      <Text style={styles.subHeader}>{t("manage_health_profile")}</Text>

      <TouchableOpacity style={styles.button} onPress={toggleLanguage}>
        <Text style={styles.buttonText}>
          {lang === "en" ? "🇮🇱 עברית" : "🇺🇸 English"}
        </Text>
      </TouchableOpacity>

      <View style={styles.profileRow}>
        <View style={styles.leftColumn}>
          <View style={styles.card}>
            <Text style={styles.cardTitle} >{t("personal_info")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("full_name")}
              placeholderTextColor="#888888"
              value={profile.name}
              onChangeText={(text) => setProfile({ ...profile, name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder={t("age")}
              placeholderTextColor="#888888"
              value={profile.age}
              onChangeText={(text) => setProfile({ ...profile, age: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder={t("weight")}
              placeholderTextColor="#888888"
              value={profile.weight}
              onChangeText={(text) => setProfile({ ...profile, weight: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder={t("height")}
              placeholderTextColor="#888888"
              value={profile.height}
              onChangeText={(text) => setProfile({ ...profile, height: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder={t("blood_type")}
              placeholderTextColor="#888888"
              value={profile.bloodType}
              onChangeText={(text) => setProfile({ ...profile, bloodType: text })}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("medical_info")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("medical_history")}
              placeholderTextColor="#888888"
              value={profile.medicalInfo}
              onChangeText={(text) => setProfile({ ...profile, medicalInfo: text })}
              multiline
            />
            <TextInput
              style={styles.input}
              placeholder={t("diseases")}
              placeholderTextColor="#888888"
              value={profile.diseases}
              onChangeText={(text) => setProfile({ ...profile, diseases: text })}
              multiline
            />
            <TextInput
              style={styles.input}
              placeholder={t("medications")}
              placeholderTextColor="#888888"
              value={profile.medications}
              onChangeText={(text) => setProfile({ ...profile, medications: text })}
              multiline
            />
            <TextInput
              style={styles.input}
              placeholder={t("sensitive_notes")}
              placeholderTextColor="#888888"
              value={profile.sensitiveNotes}
              onChangeText={(text) => setProfile({ ...profile, sensitiveNotes: text })}
              multiline
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={saveProfile}>
            <Text style={styles.buttonText}>{t("save_update_profile")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              await logout();
              router.replace("../../auth/login");
            }}
          >
            <Text style={styles.logoutText}>{t("logout")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("bmi_calculator")}</Text>
            <Text style={styles.label}>{t("age")}: <Text style={styles.value}>{profile.age}</Text></Text>
            <Text style={styles.label}>{t("weight")}: <Text style={styles.value}>{profile.weight} kg</Text></Text>
            <Text style={styles.label}>{t("height")}: <Text style={styles.value}>{profile.height} cm</Text></Text>
            <Text style={styles.bmiText}>{t("your_bmi")}: {bmi.toFixed(1)}</Text>
            <Text style={{ color: bmiColor(bmi), fontWeight: "700", marginBottom: 10 }}>
              {bmiCategory(bmi)}
            </Text>
            <View style={styles.bmiBarContainer}>
              <View
                style={[styles.bmiBar, { width: `${Math.min(bmi * 3, 100)}%`, backgroundColor: bmiColor(bmi) }]}
              />
            </View>
            <Text style={styles.bmiGuide}>
              {"< 18.5: " + t("Underweight") + " | 18.5-24.9: " + t("Normal") + " | 25-29.9: " + t("Overweight") + " | ≥ 30: " + t("Obese")}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("blood_type_info")}</Text>
            <Text style={styles.label}>{t("your_blood_type")}:</Text>
            <Text style={styles.value}>{profile.bloodType || "N/A"}</Text>
            <Text style={styles.label}>{t("can_donate_to")}:</Text>
            <Text style={styles.value}>{donateTo}</Text>
            <Text style={styles.label}>{t("can_receive_from")}:</Text>
            <Text style={styles.value}>{receiveFrom}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("blood_type")}</Text>
            <Text style={styles.value}>{normalBP()}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("blood_type")}</Text>
            <Text style={styles.value}>{normalHR()}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("emergency_contact")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("contact_name")}
              placeholderTextColor="#888888"
              value={profile.emergencyContactName}
              onChangeText={(text) => setProfile({ ...profile, emergencyContactName: text })}
            />
            <TouchableOpacity
              onPress={() =>
                profile.emergencyContactPhone &&
                Linking.openURL(`tel:${profile.emergencyContactPhone}`)
              }
            >
              <TextInput
                style={[styles.input, { color: "#e63946" }]}
                placeholder={t("contact_phone")}
                placeholderTextColor="#888888"
                value={profile.emergencyContactPhone}
                onChangeText={(text) => setProfile({ ...profile, emergencyContactPhone: text })}
                keyboardType="phone-pad"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("calorie_calculator")}</Text>
            <Text style={styles.label}>{t("estimated_daily_calories")}:</Text>
            <Text style={styles.value}>{maintenanceCalories()} kcal</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}



const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#F8F9FA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  header: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#003049",
    marginBottom: 5,
    textAlign: "center",
    marginTop:40,
  },
  subHeader: {
    fontSize: 15,
    color: "#6C757D",
    marginBottom: 20,
    textAlign: "center",
  },

  /** ⭐ MOBILE-FRIENDLY SINGLE COLUMN */
 profileRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  flexWrap: "wrap",   // ← added
},


  /** ⭐ Columns now full width */
  leftColumn: { 
  flex: 1, 
  minWidth: "100%",   // ← added
  marginRight: 0      // ← ensures perfect centering
},

  rightColumn: { 
  flex: 1, 
  minWidth: "100%",    // ← added
  marginTop: 20        // ← spacing
},


  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 12,
    color: "#003049",
  },

  /** ⭐ Input responsive for all iPhones */
  input: {
    width: "100%",
    backgroundColor: "#fffbfbff",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#adc5e9ff",
    fontSize: 16,
    color: "#003049",
    marginBottom: 10,
    textAlignVertical: "top",
  },

  button: {
    backgroundColor: "#D62828",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
    width: "100%",
  },
  buttonText: {
    color: "#553b3bff",
    fontSize: 17,
    fontWeight: "700",
  },

  logoutButton: {
    borderWidth: 2,
    borderColor: "#D62828",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
  },
  logoutText: {
    color: "#D62828",
    fontSize: 16,
    fontWeight: "700",
  },

  bmiText: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 5,
    color: "#003049",
  },
  bmiBarContainer: {
    width: "100%",
    height: 18,
    backgroundColor: "#E4E4E4",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
  },
  bmiBar: {
    height: "100%",
    borderRadius: 10,
  },
  bmiGuide: {
    fontSize: 12,
    color: "#6C757D",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C757D",
    marginTop: 5,
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
  },
});
