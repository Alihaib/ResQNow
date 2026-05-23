import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Card from "../../../components/ui/Card";
import { PrimaryButton } from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import SectionHeader from "../../../components/ui/SectionHeader";
import SubScreenShell from "../../../components/ui/SubScreenShell";
import { subScreenStyles } from "../../../components/ui/subScreenStyles";
import { useUiDirection } from "../../../components/ui/layout";
import { tokens } from "../../../src/ui/tokens";

import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";

export default function PatientViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { row, text, marginHorizontal } = useUiDirection();
  const { role, approved, user, loading: authLoading } = useAuth();
  const [patientData, setPatientData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (role !== "doctor" || approved !== true) {
      router.replace("/");
      return;
    }

    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "users", id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setPatientData({ id: snap.id, ...snap.data() });
        } else {
          setPatientData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error loading patient data:", err);
        setPatientData(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [authLoading, user, role, approved, id, router]);

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
          Alert.alert(t("error"), t("phoneCallsNotSupported"));
        }
      })
      .catch((error) => {
        console.error("Error making phone call:", error);
        Alert.alert(t("error"), t("failedToMakeCall"));
      });
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/doctor/dashboard");
    }
  };

  if (loading) {
    return (
      <SubScreenShell
        title={t("patientProfile")}
        onBack={goBack}
        fallbackRoute="/doctor/dashboard"
      >
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={tokens.color.primary} />
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </View>
      </SubScreenShell>
    );
  }

  if (!patientData) {
    return (
      <SubScreenShell
        title={t("patientProfile")}
        onBack={goBack}
        fallbackRoute="/doctor/dashboard"
      >
        <EmptyState ionIcon="person-outline" title={t("patientNotFound")} />
        <PrimaryButton label={t("goBack")} onPress={goBack} style={styles.backAction} />
      </SubScreenShell>
    );
  }

  return (
    <SubScreenShell
      title={t("patientProfile")}
      onBack={goBack}
      fallbackRoute="/doctor/dashboard"
    >
      <Card style={styles.nameCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(patientData.name || patientData.email || "P")?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.patientName}>{patientData.name || patientData.email || t("user")}</Text>
        {patientData.israeliId && (
          <Text style={styles.patientId}>{t("israeliId")}: {patientData.israeliId}</Text>
        )}
      </Card>

      <View style={subScreenStyles.section}>
        <SectionHeader title={t("personalInfo")} dense />
        <Card>
          {patientData.name && (
            <View style={[styles.infoRow, row]}>
              <Text style={styles.infoLabel}>{t("name")}:</Text>
              <Text style={[styles.infoValue, text]}>{patientData.name}</Text>
            </View>
          )}
          {patientData.email && (
            <View style={[styles.infoRow, row]}>
              <Text style={styles.infoLabel}>{t("email")}:</Text>
              <Text style={[styles.infoValue, text]}>{patientData.email}</Text>
            </View>
          )}
          {patientData.israeliId && (
            <View style={[styles.infoRow, row]}>
              <Text style={styles.infoLabel}>{t("israeliId")}:</Text>
              <Text style={[styles.infoValue, text]}>{patientData.israeliId}</Text>
            </View>
          )}
          {patientData.phoneNumber && (
            <View style={[styles.infoRow, row]}>
              <Text style={styles.infoLabel}>{t("phoneNumber")}:</Text>
              <Text style={[styles.infoValue, text]}>{patientData.phoneNumber}</Text>
            </View>
          )}
          {patientData.age && (
            <View style={[styles.infoRow, row]}>
              <Text style={styles.infoLabel}>{t("age")}:</Text>
              <Text style={[styles.infoValue, text]}>{patientData.age}</Text>
            </View>
          )}
          {patientData.bloodType && (
            <View style={[styles.infoRow, row]}>
              <Text style={styles.infoLabel}>{t("blood_type")}:</Text>
              <Text style={[styles.infoValue, styles.bloodType, text]}>
                {patientData.bloodType}
              </Text>
            </View>
          )}
          {patientData.weight && (
            <View style={[styles.infoRow, row]}>
              <Text style={styles.infoLabel}>{t("weight")}:</Text>
              <Text style={[styles.infoValue, text]}>{patientData.weight} kg</Text>
            </View>
          )}
          {patientData.height && (
            <View style={[styles.infoRow, row]}>
              <Text style={styles.infoLabel}>{t("height")}:</Text>
              <Text style={[styles.infoValue, text]}>{patientData.height} cm</Text>
            </View>
          )}
          {!patientData.name && !patientData.email && !patientData.phoneNumber && 
           !patientData.age && !patientData.bloodType && !patientData.weight && !patientData.height && (
            <Text style={styles.noData}>{t("noDataAvailable")}</Text>
          )}
        </Card>
      </View>

      <View style={subScreenStyles.section}>
        <SectionHeader title={t("medicalInfo")} dense />
        <Card>
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
                {patientData.allergies}
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
        </Card>
      </View>

      {patientData.emergencyContacts && patientData.emergencyContacts.length > 0 ? (
        <View style={subScreenStyles.section}>
          <SectionHeader title={t("emergencyContacts")} dense />
          {patientData.emergencyContacts.map((contact: { name?: string; phone?: string; relationship?: string; relation?: string }, index: number) => (
            <Card
              key={index}
              style={styles.contactCard}
            >
            <TouchableOpacity
              onPress={() => contact.phone && makePhoneCall(contact.phone)}
              activeOpacity={0.7}
              style={[styles.contactRow, row]}
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
              <View style={[styles.callIconContainer, marginHorizontal(16, 0)]}>
                <Ionicons name="call-outline" size={22} color={tokens.color.primary} />
              </View>
            </TouchableOpacity>
            </Card>
          ))}
        </View>
      ) : null}
    </SubScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.bgPage,
  },
  content: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: tokens.space.xxl,
  },
  backAction: {
    marginTop: tokens.space.lg,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: tokens.color.textMuted,
  },
  errorText: {
    fontSize: 18,
    color: tokens.color.primary,
    fontWeight: "700",
    marginBottom: 20,
  },
  header: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.bgSurface,
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
    color: tokens.color.textPrimary,
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: tokens.color.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  nameCard: {
    backgroundColor: tokens.color.bgSurface,
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
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "900",
    color: tokens.color.bgSurface,
  },
  patientName: {
    fontSize: 24,
    fontWeight: "800",
    color: tokens.color.textPrimary,
    marginBottom: 8,
  },
  patientId: {
    fontSize: 14,
    color: tokens.color.textMuted,
    fontWeight: "600",
    letterSpacing: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: tokens.color.textPrimary,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  infoLabel: {
    fontSize: 14,
    color: tokens.color.textMuted,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    color: tokens.color.textPrimary,
    fontWeight: "700",
    flex: 1,
  },
  bloodType: {
    color: tokens.color.primary,
    fontSize: 16,
  },
  infoSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  infoSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.color.textPrimary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: tokens.color.textPrimary,
    lineHeight: 20,
  },
  allergyWarning: {
    color: tokens.color.primary,
    fontWeight: "700",
  },
  noData: {
    fontSize: 14,
    color: tokens.color.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
  },
  contactRow: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  contactCard: {
    marginBottom: tokens.space.sm,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.color.textPrimary,
    marginBottom: 8,
  },
  contactPhone: {
    fontSize: 16,
    color: tokens.color.textPrimary,
    marginBottom: 4,
    fontWeight: "600",
  },
  contactRelation: {
    fontSize: 14,
    color: tokens.color.textMuted,
  },
  callIconContainer: {
    padding: 12,
    backgroundColor: tokens.color.bgPage,
    borderRadius: 12,
  },
  callIcon: {
    fontSize: 24,
  },
  backBtn: {
    backgroundColor: tokens.color.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
  },
  backBtnText: {
    color: tokens.color.bgSurface,
    fontSize: 16,
    fontWeight: "700",
  },
});

