import { StyleSheet, Text, View } from "react-native";
import Card from "../../../components/ui/Card";
import SubScreenShell from "../../../components/ui/SubScreenShell";
import { subScreenStyles } from "../../../components/ui/subScreenStyles";
import { useLanguage } from "../../../src/context/LanguageContext";
import { tokens } from "../../../src/ui/tokens";

export default function HelpScreen() {
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
    <SubScreenShell title={t("helpFAQTitle")} fallbackRoute="/(tabs)/settings">
      {faqs.map((faq, index) => (
        <Card key={index} style={styles.faqCard}>
          <Text style={styles.faqQuestion}>{faq.question}</Text>
          <Text style={styles.faqAnswer}>{faq.answer}</Text>
        </Card>
      ))}

      <Card tone="accent" style={styles.contactCard}>
        <Text style={styles.contactTitle}>{t("needMoreHelp")}</Text>
        <Text style={subScreenStyles.body}>{t("contactSupport")}</Text>
        <Text style={styles.contactEmail}>{t("supportEmail")}</Text>
      </Card>
    </SubScreenShell>
  );
}

const styles = StyleSheet.create({
  faqCard: {
    marginBottom: tokens.space.sm,
  },
  faqQuestion: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.sm,
  },
  faqAnswer: {
    ...subScreenStyles.body,
  },
  contactCard: {
    marginTop: tokens.space.md,
  },
  contactTitle: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.sm,
  },
  contactEmail: {
    marginTop: tokens.space.sm,
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.primary,
  },
});
