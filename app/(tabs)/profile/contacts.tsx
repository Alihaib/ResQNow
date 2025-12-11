import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../../src/context/LanguageContext";

interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [contacts, setContacts] = useState<Contact[]>([
    { id: "1", name: "John Doe", phone: "+972-50-123-4567", relationship: "Spouse" },
    { id: "2", name: "Jane Smith", phone: "+972-50-987-6543", relationship: "Doctor" },
  ]);

  const addContact = () => {
    // Placeholder - would open add contact modal
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ {t("back")}</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t("emergency_contact")}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={addContact}>
            <Text style={styles.addBtnText}>+ {t("add")}</Text>
          </TouchableOpacity>
        </View>
      </View>

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
          <TouchableOpacity style={styles.callBtn}>
            <Text style={styles.callBtnText}>📞</Text>
          </TouchableOpacity>
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
});





