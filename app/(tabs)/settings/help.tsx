import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../../src/context/LanguageContext";

export default function HelpScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const faqs = [
    {
      question: t("howToCallEmergency"),
      answer: t("howToCallEmergencyAnswer"),
    },
    {
      question: t("howToUpdateProfile"),
      answer: t("howToUpdateProfileAnswer"),
    },
    {
      question: t("useWithoutInternet"),
      answer: t("useWithoutInternetAnswer"),
    },
    {
      question: t("howToAddContacts"),
      answer: t("howToAddContactsAnswer"),
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ {t("back")}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t("helpFAQTitle")}</Text>
      </View>

      {faqs.map((faq, index) => (
        <View key={index} style={styles.faqCard}>
          <Text style={styles.faqQuestion}>{faq.question}</Text>
          <Text style={styles.faqAnswer}>{faq.answer}</Text>
        </View>
      ))}

      <View style={styles.contactCard}>
        <Text style={styles.contactTitle}>{t("needMoreHelp")}</Text>
        <Text style={styles.contactText}>{t("contactSupport")}</Text>
        <Text style={styles.contactEmail}>support@resqnow.app</Text>
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
  faqCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  faqQuestion: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003049",
    marginBottom: 12,
  },
  faqAnswer: {
    fontSize: 16,
    color: "#6C757D",
    lineHeight: 24,
  },
  contactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 8,
  },
  contactText: {
    fontSize: 16,
    color: "#6C757D",
    marginBottom: 8,
  },
  contactEmail: {
    fontSize: 16,
    fontWeight: "700",
    color: "#D62828",
  },
});





