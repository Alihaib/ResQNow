import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { GlassSurface } from "../../../../components/ai-emergency";
import EmptyState from "../../../../components/ui/EmptyState";
import SubScreenShell from "../../../../components/ui/SubScreenShell";
import {
  FirstAidGuideListRow,
  firstAidTheme,
} from "../../../../components/first-aid";
import { useUiDirection } from "../../../../components/ui/layout";
import { useLanguage } from "../../../../src/context/LanguageContext";
import { firstAidCategories } from "../../../../src/firstAid/categories";
import { guidesInCategory } from "../../../../src/firstAid/guides";
import { pick } from "../../../../src/firstAid/types";
import { tokens } from "../../../../src/ui/tokens";

const CATEGORY_ION: Record<string, keyof typeof Ionicons.glyphMap> = {
  bleeding: "water-outline",
  breathing: "fitness-outline",
  burns: "flame-outline",
  injuries: "bandage-outline",
  cardiac: "heart-outline",
  poisoning: "skull-outline",
  heatstroke: "thermometer-outline",
  seizures: "flash-outline",
  allergic: "alert-circle-outline",
  drowning: "water-outline",
};

export default function FirstAidCategoryGuidesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { row: rowDir, textAlign } = useUiDirection();

  const categoryId = typeof id === "string" ? id : "";
  const category = firstAidCategories.find((c) => c.id === categoryId);
  const guides = guidesInCategory(categoryId);
  const quick = guides.filter((g) => g.steps.length <= 3);
  const detailed = guides.filter((g) => g.steps.length > 3);
  const accent = category?.accent ?? firstAidTheme.primary;
  const categoryIcon = CATEGORY_ION[categoryId] ?? "book-outline";
  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/(tabs)/firstaid");

  return (
    <SubScreenShell
      title={category ? pick(lang, category.title) : t("firstAidTitle")}
      eyebrow={t("firstAidTitle")}
      onBack={goBack}
      fallbackRoute="/(tabs)/firstaid"
      contentStyle={styles.shellContent}
    >
      <GlassSurface radius={firstAidTheme.sheetRadius} style={styles.heroCard}>
        <View style={[styles.heroRow, rowDir]}>
          <View style={[styles.heroIconWrap, { backgroundColor: `${accent}14` }]}>
            <Ionicons name={categoryIcon} size={30} color={accent} />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.subhead, { textAlign }]}>
              {t("firstAidPickGuide", "Choose a guide")}
            </Text>
            <Text style={[styles.miniHint, { textAlign }]}>
              {t("firstAidTapToOpen", "Tap to open guides")}
            </Text>
          </View>
        </View>
      </GlassSurface>

      {guides.length === 0 ? (
        <EmptyState
          ionIcon="book-outline"
          title={t("firstAidNoGuides", "No guides in this topic yet.")}
        />
      ) : (
        <>
          {quick.length > 0 ? (
            <View style={styles.section}>
              <View style={[styles.groupHeader, rowDir]}>
                <Ionicons name="flash-outline" size={16} color={tokens.color.textMuted} />
                <Text style={[styles.groupTitle, { textAlign }]}>
                  {t("firstAidQuick", "Quick guides")}
                </Text>
              </View>
              {quick.map((g) => (
                <FirstAidGuideListRow
                  key={g.id}
                  title={pick(lang, g.title)}
                  meta={`${g.steps.length} ${t("firstAidStepsShort", "steps")}`}
                  accent={accent}
                  onPress={() => router.push(`/(tabs)/firstaid/guide/${g.id}`)}
                  lang={lang}
                />
              ))}
            </View>
          ) : null}

          {detailed.length > 0 ? (
            <View style={styles.section}>
              <View style={[styles.groupHeader, rowDir]}>
                <Ionicons name="book-outline" size={16} color={tokens.color.textMuted} />
                <Text style={[styles.groupTitle, { textAlign }]}>
                  {t("firstAidDetailed", "Detailed guides")}
                </Text>
              </View>
              {detailed.map((g) => (
                <FirstAidGuideListRow
                  key={g.id}
                  title={pick(lang, g.title)}
                  meta={`${g.steps.length} ${t("firstAidStepsShort", "steps")} · ${g.warnings.length} ${t("firstAidWarningsShort", "warnings")}`}
                  accent={accent}
                  onPress={() => router.push(`/(tabs)/firstaid/guide/${g.id}`)}
                  lang={lang}
                />
              ))}
            </View>
          ) : null}
        </>
      )}
    </SubScreenShell>
  );
}

const styles = StyleSheet.create({
  shellContent: {
    backgroundColor: firstAidTheme.bg,
    paddingTop: tokens.space.md,
  },
  heroCard: {
    marginBottom: tokens.space.xl,
    overflow: "hidden",
  },
  heroRow: {
    alignItems: "center",
    gap: tokens.space.md,
    padding: tokens.space.lg,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: firstAidTheme.glassBorder,
  },
  heroText: { flex: 1 },
  subhead: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
  },
  miniHint: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
    marginTop: tokens.space.xs,
    lineHeight: 20,
  },
  section: {
    marginBottom: tokens.space.xl,
  },
  groupHeader: {
    alignItems: "center",
    gap: tokens.space.xs,
    marginBottom: tokens.space.md,
  },
  groupTitle: {
    flex: 1,
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.bold,
    color: tokens.color.textMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
