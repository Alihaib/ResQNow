import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { firstAidCategories } from "../../../../src/firstAid/categories";
import { guidesInCategory } from "../../../../src/firstAid/guides";
import { pick } from "../../../../src/firstAid/types";
import { useLanguage } from "../../../../src/context/LanguageContext";

export default function FirstAidCategoryGuidesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useLanguage();

  const categoryId = typeof id === "string" ? id : "";
  const category = firstAidCategories.find((c) => c.id === categoryId);
  const guides = guidesInCategory(categoryId);
  const quick = guides.filter((g) => g.steps.length <= 3);
  const detailed = guides.filter((g) => g.steps.length > 3);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: category?.accent ?? "#003049" }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/firstaid"))}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {category ? pick(lang, category.title) : t("firstAidTitle")}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroRow}>
          <Text style={styles.heroIcon}>{category?.icon ?? "📖"}</Text>
          <View style={styles.heroText}>
            <Text style={styles.subhead}>{t("firstAidPickGuide", "Choose a guide")}</Text>
            <Text style={styles.miniHint}>{t("firstAidTapToOpen", "Tap to open guides")}</Text>
          </View>
        </View>
        {guides.length === 0 ? (
          <Text style={styles.empty}>{t("firstAidNoGuides", "No guides in this topic yet.")}</Text>
        ) : (
          <>
            {quick.length ? (
              <>
                <Text style={styles.groupTitle}>⚡ {t("firstAidQuick", "Quick guides")}</Text>
                {quick.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.guideRow}
                    onPress={() => router.push(`/(tabs)/firstaid/guide/${g.id}`)}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.guideAccent, { backgroundColor: category?.accent ?? "#D62828" }]} />
                    <View style={styles.guideBody}>
                      <Text style={styles.guideTitle}>{pick(lang, g.title)}</Text>
                      <Text style={styles.guideMeta}>
                        {g.steps.length} {t("firstAidStepsShort", "steps")}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : null}

            {detailed.length ? (
              <>
                <Text style={styles.groupTitle}>📖 {t("firstAidDetailed", "Detailed guides")}</Text>
                {detailed.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.guideRow}
                    onPress={() => router.push(`/(tabs)/firstaid/guide/${g.id}`)}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.guideAccent, { backgroundColor: category?.accent ?? "#D62828" }]} />
                    <View style={styles.guideBody}>
                      <Text style={styles.guideTitle}>{pick(lang, g.title)}</Text>
                      <Text style={styles.guideMeta}>
                        {g.steps.length} {t("firstAidStepsShort", "steps")} · {g.warnings.length} {t("firstAidWarningsShort", "warnings")}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: { width: 40 },
  backText: { fontSize: 32, color: "#fff", fontWeight: "800" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "900", color: "#fff", textAlign: "center" },
  headerSpacer: { width: 40 },
  scroll: { padding: 18, paddingBottom: 40 },
  heroRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  heroIcon: { fontSize: 34, marginRight: 12 },
  heroText: { flex: 1 },
  subhead: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  miniHint: { fontSize: 13, fontWeight: "700", color: "#64748B", marginTop: 4 },
  groupTitle: { fontSize: 13, fontWeight: "900", color: "#475569", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 10, marginBottom: 10 },
  empty: { fontSize: 16, color: "#64748B", fontWeight: "600" },
  guideRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  guideAccent: { width: 5, alignSelf: "stretch", minHeight: 72 },
  guideBody: { flex: 1, paddingVertical: 16, paddingHorizontal: 14 },
  guideTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  guideMeta: { fontSize: 13, color: "#64748B", marginTop: 6, fontWeight: "600" },
  chevron: { fontSize: 26, color: "#94A3B8", paddingRight: 12, fontWeight: "300" },
});
