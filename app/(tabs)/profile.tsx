import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { db } from "../../src/firebase/config";

export default function ProfileTab() {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [sharing, setSharing] = useState(false);

  const shareMedicalInfo = async () => {
    if (!user) {
      Alert.alert(t("error"), "User not logged in");
      return;
    }

    setSharing(true);
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        Alert.alert(t("error"), "No medical information found");
        setSharing(false);
        return;
      }

      const data = docSnap.data();
      
      // Format medical information for sharing
      const medicalInfo = `
⛑ ResQNow Medical Information

👤 Personal Information:
${data.name ? `Name: ${data.name}` : ""}
${data.age ? `Age: ${data.age}` : ""}
${data.bloodType ? `Blood Type: ${data.bloodType}` : ""}
${data.weight ? `Weight: ${data.weight} kg` : ""}
${data.height ? `Height: ${data.height} cm` : ""}

🏥 Medical History:
${data.diseases ? `Diseases: ${data.diseases}` : ""}
${data.medications ? `Medications: ${data.medications}` : ""}
${data.allergies ? `Allergies: ${data.allergies}` : ""}
${data.sensitiveNotes ? `Notes: ${data.sensitiveNotes}` : ""}

📞 Emergency Contacts:
${data.emergencyContacts && data.emergencyContacts.length > 0
  ? data.emergencyContacts.map((c: any) => `${c.name}: ${c.phone}`).join("\n")
  : "No emergency contacts"}

---
Shared from ResQNow App
      `.trim();

      const result = await Share.share({
        message: medicalInfo,
        title: t("shareMedicalProfile"),
      });

      if (result.action === Share.sharedAction) {
        Alert.alert(t("Success"), "Medical information shared successfully");
      }
    } catch (error) {
      console.error("Error sharing medical info:", error);
      Alert.alert(t("error"), "Failed to share medical information");
    } finally {
      setSharing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>👤</Text>
        <Text style={styles.title}>{t("profileTitle")}</Text>
      </View>

      {/* User Info Card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.email || t("user")}</Text>
        <Text style={styles.userRole}>{t(role || "user")}</Text>
      </View>

      {/* Medical Profile Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("medicalProfile")}</Text>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={shareMedicalInfo}
            disabled={sharing}
          >
            <Text style={styles.shareIcon}>📤</Text>
            <Text style={styles.shareText}>{t("shareMedicalProfile")}</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push("/(tabs)/profile/medical")}
        >
          <Text style={styles.menuIcon}>📋</Text>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{t("personalInformation")}</Text>
            <Text style={styles.menuSubtitle}>{t("nameAgeBloodType")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push("/(tabs)/profile/history")}
        >
          <Text style={styles.menuIcon}>📝</Text>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{t("medical_history")}</Text>
            <Text style={styles.menuSubtitle}>{t("diseasesMedicationsAllergies")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push("/(tabs)/profile/contacts")}
        >
          <Text style={styles.menuIcon}>📞</Text>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{t("emergency_contact")}</Text>
            <Text style={styles.menuSubtitle}>{t("familyFriendsDoctors")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Records Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("medicalRecords")}</Text>
        
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push("/(tabs)/profile/emergency-history")}
        >
          <Text style={styles.menuIcon}>🚨</Text>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{t("emergencyHistory")}</Text>
            <Text style={styles.menuSubtitle}>{t("pastEmergencyCalls")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push("/(tabs)/profile/medical-records")}
        >
          <Text style={styles.menuIcon}>🏥</Text>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{t("medicalRecords")}</Text>
            <Text style={styles.menuSubtitle}>{t("visitsTreatmentsTests")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>
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
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    fontSize: 60,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#003049",
  },
  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#D62828",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 4,
  },
  userRole: {
    fontSize: 16,
    color: "#6C757D",
    textTransform: "capitalize",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D62828",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  shareIcon: {
    fontSize: 16,
  },
  shareText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 14,
    color: "#6C757D",
  },
  chevron: {
    fontSize: 24,
    color: "#6C757D",
  },
});


