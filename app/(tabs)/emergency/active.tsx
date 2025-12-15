import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";

export default function ActiveEmergencyScreen() {
  const { user } = useAuth();
  const { t: translate } = useLanguage();
  const router = useRouter();
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [location] = useState("");

  const shareMedicalInfo = async () => {
    if (!user) {
      Alert.alert(translate("error"), "User not logged in");
      return;
    }

    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        Alert.alert(translate("error"), "No medical information found");
        return;
      }

      const data = docSnap.data();
      
      // Format medical information for sharing
      const medicalInfo = `
⛑ ResQNow Medical Information - EMERGENCY

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
Shared from ResQNow App - Emergency Situation
      `.trim();

      await Share.share({
        message: medicalInfo,
        title: translate("shareMedicalProfile"),
      });
    } catch (error) {
      console.error("Error sharing medical info:", error);
      Alert.alert(translate("error"), "Failed to share medical information");
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const endEmergency = () => {
    Alert.alert(translate("endEmergency"), translate("endEmergencyConfirm"), [
      { text: translate("cancel"), style: "cancel" },
      {
        text: translate("endEmergency"),
        style: "destructive",
        onPress: () => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(tabs)/emergency");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusIndicator} />
        <Text style={styles.statusText}>{translate("emergencyActive")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Timer */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>{translate("timeElapsed")}</Text>
          <Text style={styles.timer}>{formatTime(timeElapsed)}</Text>
        </View>

        {/* Location */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>📍</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>{translate("yourLocation")}</Text>
            <Text style={styles.infoValue}>{translate("locationLoading")}</Text>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>{translate("stayCalmTitle")}</Text>
          <Text style={styles.instructionsText}>
            {translate("helpOnWay")}{'\n'}
            {translate("stayWhereYouAre")}{'\n'}
            {translate("keepPhoneNearby")}{'\n'}
            {translate("followInstructions")}
          </Text>
        </View>

        {/* Medical Info Share */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={shareMedicalInfo}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>{translate("shareMedicalProfile")}</Text>
            <Text style={styles.actionSubtitle}>{translate("sendMedicalInfo")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* First Aid */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push("/(tabs)/firstaid")}
        >
          <Text style={styles.actionIcon}>⛑</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>{translate("medical_guides")}</Text>
            <Text style={styles.actionSubtitle}>{translate("getGuidance")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* End Emergency Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.endBtn} onPress={endEmergency}>
          <Text style={styles.endBtnText}>{translate("endEmergency")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#DC2626",
  },
  statusBar: {
    backgroundColor: "#DC2626",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
  content: {
    backgroundColor: "#F8F9FA",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 30,
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  timerLabel: {
    fontSize: 16,
    color: "#6C757D",
    marginBottom: 8,
  },
  timer: {
    fontSize: 64,
    fontWeight: "900",
    color: "#DC2626",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: "#6C757D",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
  },
  instructionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 16,
    color: "#212529",
    lineHeight: 28,
  },
  actionCard: {
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
  actionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: "#6C757D",
  },
  chevron: {
    fontSize: 24,
    color: "#6C757D",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E9ECEF",
  },
  endBtn: {
    backgroundColor: "#6C757D",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  endBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});


