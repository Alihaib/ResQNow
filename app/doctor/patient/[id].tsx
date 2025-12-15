import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";

export default function PatientViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const [patientData, setPatientData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPatientData();
  }, [id]);

  const loadPatientData = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      const docRef = doc(db, "users", id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setPatientData({ id: docSnap.id, ...docSnap.data() });
      } else {
        setPatientData(null);
      }
    } catch (error) {
      console.error("Error loading patient data:", error);
    } finally {
      setLoading(false);
    }
  };

  const makePhoneCall = (phoneNumber: string) => {
    // Clean the phone number - remove any non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, "");
    
    // Check if phone number is valid
    if (!cleaned || cleaned.length < 7) {
      Alert.alert(t("error"), t("invalidPhoneNumber") || "Invalid phone number");
      return;
    }

    // Format phone number for calling
    // If it starts with +972, use as is
    // If it starts with 0, convert to +972 format
    // Otherwise, assume it's already in correct format
    let phoneToCall = cleaned;
    if (cleaned.startsWith("0")) {
      // Convert Israeli local format (05xxxxxxxx) to international (+9725xxxxxxxx)
      phoneToCall = `+972${cleaned.substring(1)}`;
    } else if (!cleaned.startsWith("+")) {
      // If no + prefix, add it (assuming it's an international number)
      phoneToCall = `+${cleaned}`;
    }

    // Open phone dialer
    const phoneUrl = `tel:${phoneToCall}`;
    Linking.canOpenURL(phoneUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(phoneUrl);
        } else {
          Alert.alert(t("error"), "Phone calls are not supported on this device");
        }
      })
      .catch((error) => {
        console.error("Error making phone call:", error);
        Alert.alert(t("error"), "Failed to make phone call");
      });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#D62828" />
        <Text style={styles.loadingText}>{t("loading")}</Text>
      </View>
    );
  }

  if (!patientData) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>{t("patientNotFound")}</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/doctor/dashboard");
            }
          }}
        >
          <Text style={styles.backBtnText}>{t("goBack") || "Go Back"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/doctor/dashboard");
            }
          }}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("patientProfile")}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Patient Name Card */}
      <View style={styles.nameCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(patientData.name || patientData.email || "P")?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.patientName}>{patientData.name || patientData.email || t("user")}</Text>
        {patientData.israeliId && (
          <Text style={styles.patientId}>{t("israeliId")}: {patientData.israeliId}</Text>
        )}
      </View>

      {/* Personal Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 {t("personalInfo")}</Text>
        <View style={styles.infoCard}>
          {patientData.name && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("name")}:</Text>
              <Text style={styles.infoValue}>{patientData.name}</Text>
            </View>
          )}
          {patientData.email && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("email")}:</Text>
              <Text style={styles.infoValue}>{patientData.email}</Text>
            </View>
          )}
          {patientData.israeliId && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("israeliId")}:</Text>
              <Text style={styles.infoValue}>{patientData.israeliId}</Text>
            </View>
          )}
          {patientData.phoneNumber && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("phoneNumber")}:</Text>
              <Text style={styles.infoValue}>{patientData.phoneNumber}</Text>
            </View>
          )}
          {patientData.age && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("age")}:</Text>
              <Text style={styles.infoValue}>{patientData.age}</Text>
            </View>
          )}
          {patientData.bloodType && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("blood_type")}:</Text>
              <Text style={[styles.infoValue, styles.bloodType]}>
                {patientData.bloodType}
              </Text>
            </View>
          )}
          {patientData.weight && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("weight")}:</Text>
              <Text style={styles.infoValue}>{patientData.weight} kg</Text>
            </View>
          )}
          {patientData.height && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("height")}:</Text>
              <Text style={styles.infoValue}>{patientData.height} cm</Text>
            </View>
          )}
          {!patientData.name && !patientData.email && !patientData.phoneNumber && 
           !patientData.age && !patientData.bloodType && !patientData.weight && !patientData.height && (
            <Text style={styles.noData}>{t("noDataAvailable")}</Text>
          )}
        </View>
      </View>

      {/* Medical History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏥 {t("medicalInfo")}</Text>
        <View style={styles.infoCard}>
          {patientData.diseases && (
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>{t("diseases")}:</Text>
              <Text style={styles.infoText}>{patientData.diseases}</Text>
            </View>
          )}
          {patientData.medications && (
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>{t("medications")}:</Text>
              <Text style={styles.infoText}>{patientData.medications}</Text>
            </View>
          )}
          {patientData.allergies && (
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>{t("allergies")}:</Text>
              <Text style={[styles.infoText, styles.allergyWarning]}>
                ⚠️ {patientData.allergies}
              </Text>
            </View>
          )}
          {patientData.sensitiveNotes && (
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>{t("sensitiveNotes") || "Sensitive Notes"}:</Text>
              <Text style={styles.infoText}>{patientData.sensitiveNotes}</Text>
            </View>
          )}
          {!patientData.diseases && !patientData.medications && 
           !patientData.allergies && !patientData.sensitiveNotes && (
            <Text style={styles.noData}>{t("noDataAvailable")}</Text>
          )}
        </View>
      </View>

      {/* Emergency Contacts */}
      {patientData.emergencyContacts && patientData.emergencyContacts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📞 {t("emergencyContacts")}</Text>
          {patientData.emergencyContacts.map((contact: any, index: number) => (
            <TouchableOpacity
              key={index}
              style={styles.contactCard}
              onPress={() => makePhoneCall(contact.phone)}
              activeOpacity={0.7}
            >
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
                {contact.relationship && (
                  <Text style={styles.contactRelation}>{contact.relationship}</Text>
                )}
                {contact.relation && (
                  <Text style={styles.contactRelation}>{contact.relation}</Text>
                )}
              </View>
              <View style={styles.callIconContainer}>
                <Text style={styles.callIcon}>📞</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6C757D",
  },
  errorText: {
    fontSize: 18,
    color: "#D62828",
    fontWeight: "700",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backText: {
    fontSize: 24,
    color: "#003049",
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#003049",
  },
  placeholder: {
    width: 40,
  },
  nameCard: {
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
  patientName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 8,
  },
  patientId: {
    fontSize: 14,
    color: "#6C757D",
    fontWeight: "600",
    letterSpacing: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  infoLabel: {
    fontSize: 14,
    color: "#6C757D",
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    color: "#003049",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  bloodType: {
    color: "#D62828",
    fontSize: 16,
  },
  infoSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  infoSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#212529",
    lineHeight: 20,
  },
  allergyWarning: {
    color: "#D62828",
    fontWeight: "700",
  },
  noData: {
    fontSize: 14,
    color: "#6C757D",
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
  },
  contactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: "#D62828",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 8,
  },
  contactPhone: {
    fontSize: 16,
    color: "#212529",
    marginBottom: 4,
    fontWeight: "600",
  },
  contactRelation: {
    fontSize: 14,
    color: "#6C757D",
  },
  callIconContainer: {
    marginLeft: 16,
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
  },
  callIcon: {
    fontSize: 24,
  },
  backBtn: {
    backgroundColor: "#D62828",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});

