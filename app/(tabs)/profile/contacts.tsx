import { useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { db } from "../../../src/firebase/config";

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
      Alert.alert(t("error"), "User not logged in");
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
      Alert.alert(t("error"), "Failed to save contacts");
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
        Alert.alert(t("error"), "Failed to save contact");
      } finally {
        setSaving(false);
      }
    }
  };

  const deleteContact = (id: string) => {
    Alert.alert(
      t("deleteAccount"),
      "Are you sure you want to delete this contact?",
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: "Delete",
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
        Alert.alert(t("error"), "Failed to make phone call");
      });
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
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/profile");
            }
          }} 
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹ {t("back")}</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t("emergency_contact")}</Text>
          <TouchableOpacity 
            style={styles.addBtn} 
            onPress={() => setShowAddForm(!showAddForm)}
          >
            <Text style={styles.addBtnText}>+ {t("add")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add Contact Form */}
      {showAddForm && (
        <View style={styles.addForm}>
          <Text style={styles.formTitle}>{t("add")} {t("emergency_contact")}</Text>
          <TextInput
            style={styles.formInput}
            placeholder={t("contact_name")}
            value={newContact.name}
            onChangeText={(text) => setNewContact({ ...newContact, name: text })}
          />
          <TextInput
            style={styles.formInput}
            placeholder={t("contact_phone")}
            value={newContact.phone}
            onChangeText={(text) => setNewContact({ ...newContact, phone: text })}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.formInput}
            placeholder="Relationship (optional)"
            value={newContact.relationship}
            onChangeText={(text) => setNewContact({ ...newContact, relationship: text })}
          />
          <View style={styles.formButtons}>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => {
                setShowAddForm(false);
                setNewContact({ name: "", phone: "", relationship: "" });
              }}
            >
              <Text style={styles.cancelBtnText}>{t("cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.saveFormBtn} 
              onPress={addContact}
              disabled={saving}
            >
              <Text style={styles.saveFormBtnText}>{t("add")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {contacts.map((contact) => (
        <View key={contact.id} style={styles.contactCard}>
          <View style={styles.contactAvatar}>
            <Text style={styles.contactAvatarText}>
              {contact.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{contact.name}</Text>
            <Text style={styles.contactRelationship}>{contact.relationship}</Text>
            <Text style={styles.contactPhone}>{contact.phone}</Text>
          </View>
          <View style={styles.contactActions}>
            <TouchableOpacity 
              style={styles.deleteBtn}
              onPress={() => deleteContact(contact.id)}
            >
              <Text style={styles.deleteBtnText}>🗑️</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.callBtn}
              onPress={() => makePhoneCall(contact.phone)}
            >
              <Text style={styles.callBtnText}>📞</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {contacts.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📞</Text>
          <Text style={styles.emptyText}>{t("noEmergencyContacts")}</Text>
          <Text style={styles.emptySubtext}>{t("addContactsToCall")}</Text>
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
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#003049",
  },
  addBtn: {
    backgroundColor: "#D62828",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  contactCard: {
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
  contactAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#D62828",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  contactAvatarText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 4,
  },
  contactRelationship: {
    fontSize: 14,
    color: "#6C757D",
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 16,
    color: "#003049",
    fontWeight: "600",
  },
  callBtn: {
    padding: 12,
  },
  callBtnText: {
    fontSize: 24,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6C757D",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#ADB5BD",
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
  addForm: {
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
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 16,
  },
  formInput: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "#E9ECEF",
  },
  formButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#E9ECEF",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#6C757D",
    fontSize: 16,
    fontWeight: "700",
  },
  saveFormBtn: {
    flex: 1,
    backgroundColor: "#D62828",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  saveFormBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  contactActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    fontSize: 20,
  },
});





