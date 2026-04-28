import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { theme } from "../../../src/ui/theme";

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
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/settings");
            }
          }} 
          style={styles.backBtn}
        >
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
        <Text style={styles.contactEmail}>{t("supportEmail")}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    paddingTop: 60,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: "700",
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
  },
  faqCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  faqQuestion: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  faqAnswer: {
    fontSize: 16,
    color: theme.colors.textMuted,
    lineHeight: 24,
  },
  contactCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    alignItems: "center",
    marginTop: theme.spacing.lg,
    ...theme.shadow.card,
  },
  contactTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  contactText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  contactEmail: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
  },
});





