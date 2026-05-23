import { useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import { PrimaryButton } from "../../../components/ui/Button";
import { useUiDirection } from "../../../components/ui/layout";
import SubScreenShell from "../../../components/ui/SubScreenShell";
import { subScreenStyles } from "../../../components/ui/subScreenStyles";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";
import { cardShadow, tokens } from "../../../src/ui/tokens";

interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { row, marginHorizontal } = useUiDirection();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", relationship: "" });

  // Load existing emergency contacts
  useEffect(() => {
    if (!user) return;

    const loadContacts = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const savedContacts = data.emergencyContacts || [];
          setContacts(savedContacts);
        }
      } catch (error) {
        console.error("Error loading contacts:", error);
      } finally {
        setLoading(false);
      }
    };

    loadContacts();
  }, [user]);

  const saveContacts = async (showSuccess = false) => {
    if (!user) {
      Alert.alert(t("error"), t("userNotLoggedIn"));
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          emergencyContacts: contacts,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      if (showSuccess) {
        Alert.alert(t("Success"), t("saveChanges") + " " + t("Success"));
      }
      setShowAddForm(false);
    } catch (error) {
      console.error("Error saving contacts:", error);
      Alert.alert(t("error"), t("failedToSaveContacts"));
    } finally {
      setSaving(false);
    }
  };

  const addContact = async () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      Alert.alert(t("error"), t("fillAllFields"));
      return;
    }

    const contact: Contact = {
      id: Date.now().toString(),
      name: newContact.name.trim(),
      phone: newContact.phone.trim(),
      relationship: newContact.relationship.trim() || "Contact",
    };

    const updatedContacts = [...contacts, contact];
    setContacts(updatedContacts);
    setNewContact({ name: "", phone: "", relationship: "" });
    setShowAddForm(false);
    
    // Save to database
    if (user) {
      setSaving(true);
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            emergencyContacts: updatedContacts,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Error saving contact:", error);
        Alert.alert(t("error"), t("failedToSaveContact"));
      } finally {
        setSaving(false);
      }
    }
  };

  const deleteContact = (id: string) => {
    Alert.alert(
      t("deleteAccount"),
      t("deleteContactConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            const updated = contacts.filter((c) => c.id !== id);
            setContacts(updated);
            if (user) {
              try {
                await setDoc(
                  doc(db, "users", user.uid),
                  {
                    emergencyContacts: updated,
                    updatedAt: new Date().toISOString(),
                  },
                  { merge: true }
                );
              } catch (error) {
                console.error("Error deleting contact:", error);
              }
            }
          },
        },
      ]
    );
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
        Alert.alert(t("error"), t("failedToMakeCall"));
      });
  };

  if (loading) {
    return (
      <SubScreenShell
        title={t("emergency_contact")}
        onBack={() => router.replace("/(tabs)/profile")}
        fallbackRoute="/(tabs)/profile"
      >
        <EmptyState loading tone="primary" title={t("loading")} />
      </SubScreenShell>
    );
  }

  const goProfile = () => router.replace("/(tabs)/profile");

  return (
    <SubScreenShell
      title={t("emergency_contact")}
      onBack={goProfile}
      fallbackRoute="/(tabs)/profile"
      trailing={
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddForm(!showAddForm)}
        >
          <Text style={styles.addBtnText}>+ {t("add")}</Text>
        </TouchableOpacity>
      }
    >
      {showAddForm ? (
        <Card style={styles.addForm}>
          <Text style={styles.formTitle}>
            {t("add")} {t("emergency_contact")}
          </Text>
          <TextInput
            style={subScreenStyles.input}
            placeholder={t("contact_name")}
            placeholderTextColor={tokens.color.textFaint}
            value={newContact.name}
            onChangeText={(text) => setNewContact({ ...newContact, name: text })}
          />
          <TextInput
            style={subScreenStyles.input}
            placeholder={t("contact_phone")}
            placeholderTextColor={tokens.color.textFaint}
            value={newContact.phone}
            onChangeText={(text) => setNewContact({ ...newContact, phone: text })}
            keyboardType="phone-pad"
          />
          <TextInput
            style={subScreenStyles.input}
            placeholder={t("relationshipOptional")}
            placeholderTextColor={tokens.color.textFaint}
            value={newContact.relationship}
            onChangeText={(text) =>
              setNewContact({ ...newContact, relationship: text })
            }
          />
          <View style={[styles.formButtons, row]}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setShowAddForm(false);
                setNewContact({ name: "", phone: "", relationship: "" });
              }}
            >
              <Text style={styles.cancelBtnText}>{t("cancel")}</Text>
            </TouchableOpacity>
            <PrimaryButton
              label={t("add")}
              onPress={addContact}
              disabled={saving}
              loading={saving}
              style={styles.saveFormBtn}
            />
          </View>
        </Card>
      ) : null}

      {contacts.map((contact) => (
        <Card key={contact.id} style={[styles.contactCard, row]}>
          <View style={[styles.contactAvatar, marginHorizontal(0, tokens.space.lg)]}>
            <Text style={styles.contactAvatarText}>
              {contact.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{contact.name}</Text>
            <Text style={styles.contactRelationship}>{contact.relationship}</Text>
            <Text style={styles.contactPhone}>{contact.phone}</Text>
          </View>
          <View style={[styles.contactActions, row]}>
            <TouchableOpacity
              style={styles.iconAction}
              onPress={() => deleteContact(contact.id)}
              accessibilityLabel={t("delete")}
            >
              <Ionicons
                name="trash-outline"
                size={22}
                color={tokens.color.danger}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconAction}
              onPress={() => makePhoneCall(contact.phone)}
              accessibilityLabel={t("call")}
            >
              <Ionicons
                name="call-outline"
                size={22}
                color={tokens.color.primary}
              />
            </TouchableOpacity>
          </View>
        </Card>
      ))}

      {contacts.length === 0 && !showAddForm ? (
        <EmptyState
          ionIcon="call-outline"
          title={t("noEmergencyContacts")}
          subtitle={t("addContactsToCall")}
        />
      ) : null}
    </SubScreenShell>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    backgroundColor: tokens.color.primary,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    borderRadius: tokens.radius.pill,
  },
  addBtnText: {
    color: tokens.color.textOnPrimary,
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.bold,
  },
  contactCard: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.xl,
    padding: tokens.space.lg,
    alignItems: "center",
    marginBottom: tokens.space.sm,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    ...cardShadow,
  },
  contactAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  contactAvatarText: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textOnPrimary,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.xs,
  },
  contactRelationship: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textMuted,
    marginBottom: tokens.space.xs,
  },
  contactPhone: {
    fontSize: tokens.font.title,
    color: tokens.color.textPrimary,
    fontWeight: tokens.fontWeight.semibold,
  },
  iconAction: {
    padding: tokens.space.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.bgSubtle,
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
  addForm: {
    marginBottom: tokens.space.lg,
    gap: tokens.space.sm,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.color.textPrimary,
    marginBottom: 16,
  },
  formButtons: {
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: tokens.color.border,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    color: tokens.color.textMuted,
    fontSize: 16,
    fontWeight: "700",
  },
  saveFormBtn: {
    flex: 1,
  },
  contactActions: {
    alignItems: "center",
    gap: 8,
  },
});





