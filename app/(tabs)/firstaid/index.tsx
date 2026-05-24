import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FEATURED_CATEGORY_IDS,
  FEATURED_FIRST_AID,
  type FeaturedFirstAidCategory,
  FirstAidCategoryCard,
  FirstAidHubHeader,
  FirstAidQuickHelp,
  FirstAidSosBanner,
  type QuickHelpAction,
} from "../../../components/first-aid";
import { firstAidTheme } from "../../../components/first-aid/theme";
import { firstAidCategories } from "../../../src/firstAid/categories";
import { pick } from "../../../src/firstAid/types";
import { useUiDirection } from "../../../components/ui/layout";
import { useLanguage } from "../../../src/context/LanguageContext";
import { pageStyles, tokens } from "../../../src/ui/tokens";

type SmartCase = "not_breathing" | "unconscious" | "bleeding" | "choking" | "burn" | "general";

/** Life-saving categories first — fixed hub scan order */
const PRIMARY_HUB_ORDER = [
  "cpr",
  "breathing",
  "bleeding",
  "cardiac",
  "burns",
  "choking",
] as const;

function featuredHighlightId(smartCase?: string): string | null {
  switch (smartCase as SmartCase | undefined) {
    case "bleeding":
      return "bleeding";
    case "burn":
      return "burns";
    case "choking":
      return "choking";
    case "not_breathing":
      return "cpr";
    case "unconscious":
      return "breathing";
    default:
      return null;
  }
}

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

function categoryDescription(catId: string, t: (k: string, fb?: string) => string): string {
  switch (catId) {
    case "bleeding":
      return t("firstAidCatDesc_bleeding", "Stop bleeding with pressure");
    case "breathing":
      return t("firstAidCatDesc_breathing", "Breathing, choking, CPR");
    case "burns":
      return t("firstAidCatDesc_burns", "Cool, cover, protect skin");
    case "injuries":
      return t("firstAidCatDesc_injuries", "Sprains, fractures, trauma");
    case "cardiac":
      return t("firstAidCatDesc_cardiac", "Chest pain and stroke signs");
    case "poisoning":
      return t("firstAidCatDesc_poisoning", "Swallowed or inhaled toxins");
    case "heatstroke":
      return t("firstAidCatDesc_heatstroke", "Heat illness and cooling");
    case "seizures":
      return t("firstAidCatDesc_seizures", "Seizure safety steps");
    case "allergic":
      return t("firstAidCatDesc_allergic", "Hives and severe reactions");
    case "drowning":
      return t("firstAidCatDesc_drowning", "Water rescue basics");
    default:
      return t("firstAidCatDesc_default", "Step-by-step guides");
  }
}

function sortPrimaryCategories(items: FeaturedFirstAidCategory[]) {
  return [...items].sort(
    (a, b) =>
      PRIMARY_HUB_ORDER.indexOf(a.id as (typeof PRIMARY_HUB_ORDER)[number]) -
      PRIMARY_HUB_ORDER.indexOf(b.id as (typeof PRIMARY_HUB_ORDER)[number]),
  );
}

export default function FirstAidIndexScreen() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { row: rowDir, textAlign } = useUiDirection();
  const insets = useSafeAreaInsets();
  const { openMode, smartCase } = useLocalSearchParams<{ openMode?: string; smartCase?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const primaryGridYRef = useRef(0);
  const itemYRef = useRef<Record<string, number>>({});

  const featuredHighlight = useMemo(() => featuredHighlightId(smartCase), [smartCase]);
  const [sosPulseActive, setSosPulseActive] = useState(false);
  const [moreTopicsOpen, setMoreTopicsOpen] = useState(false);

  const primaryCategories = useMemo(
    () => sortPrimaryCategories(FEATURED_FIRST_AID),
    [],
  );

  const moreCategories = useMemo(
    () => firstAidCategories.filter((c) => !FEATURED_CATEGORY_IDS.has(c.id)),
    [],
  );

  const highlightedFeatured = useMemo(
    () => FEATURED_FIRST_AID.find((f) => f.id === featuredHighlight),
    [featuredHighlight],
  );

  useEffect(() => {
    if (openMode !== "sos") return;
    setSosPulseActive(true);
    const scrollTimer = setTimeout(() => {
      const y = featuredHighlight ? itemYRef.current[featuredHighlight] : undefined;
      scrollRef.current?.scrollTo({
        y: Math.max(0, (y ?? primaryGridYRef.current) - 12),
        animated: true,
      });
    }, 80);
    const stop = setTimeout(() => setSosPulseActive(false), 2400);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(stop);
    };
  }, [openMode, featuredHighlight]);

  const openFeatured = (item: FeaturedFirstAidCategory) => {
    if (item.guideId) {
      router.push(`/(tabs)/firstaid/guide/${item.guideId}`);
    } else {
      router.push(`/(tabs)/firstaid/category/${item.categoryId}`);
    }
  };

  const sosActionLabel = useMemo(() => {
    if (!highlightedFeatured) {
      return t("firstAidSosBannerAction", "Open recommended guide");
    }
    const name = t(highlightedFeatured.titleKey, highlightedFeatured.titleFallback);
    return t("firstAidSosContinueGuide", "Continue {guide}").replace("{guide}", name);
  }, [highlightedFeatured, t]);

  const quickHelpActions: QuickHelpAction[] = useMemo(
    () => [
      {
        id: "sos",
        label: t("firstAidQuick_sosShort", "SOS Call"),
        icon: "call-outline",
        onPress: () => router.push("/(tabs)/emergency"),
        urgent: true,
      },
      {
        id: "cpr",
        label: t("firstAidQuick_cprShort", "CPR"),
        icon: "heart-circle-outline",
        onPress: () => router.push("/(tabs)/firstaid/guide/breathing_cpr_overview"),
      },
      {
        id: "location",
        label: t("firstAidQuick_locationShort", "Share Location"),
        icon: "location-outline",
        onPress: () => router.push("/(tabs)/emergency"),
      },
      {
        id: "medical",
        label: t("firstAidQuick_medicalShort", "Medical ID"),
        icon: "id-card-outline",
        onPress: () => router.push("/(tabs)/profile/medical"),
      },
      {
        id: "voice",
        label: t("firstAidQuick_voiceShort", "Voice Guide"),
        icon: "volume-high-outline",
        onPress: () => router.push("/(tabs)/firstaid/guide/breathing_cpr_overview"),
      },
    ],
    [t, router, lang],
  );

  const isSosMode = openMode === "sos";

  return (
    <View style={pageStyles.screen}>
      <ScrollView
        ref={scrollRef}
        style={pageStyles.screen}
        contentContainerStyle={[
          pageStyles.scrollContent,
          styles.content,
          { paddingBottom: insets.bottom + 108 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header */}
        <FirstAidHubHeader
          subtitle={t("firstAidGuideLabel", "First Aid Guide")}
          statusLabel={
            isSosMode
              ? t("firstAidStatusEmergency", "Emergency mode")
              : t("firstAidStatusReady", "Guides ready")
          }
          lang={lang}
        />

        {/* 2. SOS context (compact, one action) */}
        {isSosMode ? (
          <FirstAidSosBanner
            message={t(
              "firstAidSosBannerShort",
              "Active emergency — follow the highlighted guide below.",
            )}
            actionLabel={sosActionLabel}
            onAction={() => {
              if (highlightedFeatured) openFeatured(highlightedFeatured);
            }}
            lang={lang}
          />
        ) : null}

        {/* 3. Quick help pills */}
        <FirstAidQuickHelp actions={quickHelpActions} lang={lang} />

        {/* 4. Primary life-saving grid */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {t("firstAidPrimaryHeading", "Life-saving guides")}
          </Text>
          <Text style={[styles.sectionHint, { textAlign }]}>
            {t("firstAidPrimaryHint", "Tap the situation that matches now")}
          </Text>

          <View
            onLayout={(e) => {
              primaryGridYRef.current = e.nativeEvent.layout.y;
            }}
            style={[styles.primaryGrid, rowDir]}
          >
            {primaryCategories.map((item) => (
                <View
                  key={item.id}
                  onLayout={(e) => {
                    itemYRef.current[item.id] = e.nativeEvent.layout.y;
                  }}
                  style={styles.gridCell}
                >
                  <FirstAidCategoryCard
                    tier="primary"
                    priority={!!item.priority}
                    icon={item.icon}
                    title={t(item.titleKey, item.titleFallback)}
                    description={t(item.descKey, item.descFallback)}
                    accent={item.accent}
                    onPress={() => openFeatured(item)}
                    highlighted={isSosMode && featuredHighlight === item.id}
                    pulsing={isSosMode && sosPulseActive && featuredHighlight === item.id}
                    dimmed={
                      isSosMode &&
                      sosPulseActive &&
                      featuredHighlight !== null &&
                      featuredHighlight !== item.id
                    }
                    lang={lang}
                  />
                </View>
            ))}
          </View>
        </View>

        {/* 5. More topics (collapsible, lighter) */}
        {moreCategories.length > 0 ? (
          <View style={styles.sectionBlock}>
            <Pressable
              onPress={() => setMoreTopicsOpen((v) => !v)}
              style={[
                styles.moreHeader,
                rowDir,
                moreTopicsOpen && styles.moreHeaderOpen,
              ]}
              accessibilityRole="button"
              accessibilityState={{ expanded: moreTopicsOpen }}
            >
              <Text style={[styles.moreTitle, { textAlign }]}>
                {t("firstAidMoreTopics", "More topics")}
              </Text>
              <Ionicons
                name={moreTopicsOpen ? "chevron-up" : "chevron-down"}
                size={22}
                color={tokens.color.textMuted}
              />
            </Pressable>

            {moreTopicsOpen ? (
              <View style={styles.secondaryGrid}>
                {moreCategories.map((cat) => (
                  <View key={cat.id} style={styles.secondaryCell}>
                    <FirstAidCategoryCard
                      tier="secondary"
                      icon={CATEGORY_ION[cat.id] ?? "book-outline"}
                      title={pick(lang, cat.title)}
                      description={categoryDescription(cat.id, t)}
                      accent={cat.accent}
                      onPress={() => router.push(`/(tabs)/firstaid/category/${cat.id}`)}
                      lang={lang}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 6. Calm footer strip */}
        <View style={styles.infoStrip}>
          <Text style={[styles.infoText, { textAlign }]}>
            {t(
              "firstAidHubFooter",
              "Tap a category to view step-by-step guidance",
            )}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const GUTTER = tokens.space.md;
const CELL_WIDTH = "48.5%";

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.sm,
  },
  sectionBlock: {
    marginBottom: tokens.space.xxl,
  },
  sectionTitle: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.xs,
    letterSpacing: -0.2,
  },
  sectionHint: {
    fontSize: tokens.font.body,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
    marginBottom: tokens.space.lg,
    lineHeight: 18,
  },
  primaryGrid: {
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: GUTTER,
  },
  gridCell: {
    width: CELL_WIDTH,
  },
  moreHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: tokens.space.md,
    minHeight: 48,
  },
  moreHeaderOpen: {
    marginBottom: tokens.space.md,
  },
  moreTitle: {
    flex: 1,
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textSecondary,
  },
  secondaryGrid: {
    gap: tokens.space.sm,
  },
  secondaryCell: {
    width: "100%",
  },
  infoStrip: {
    paddingVertical: tokens.space.lg,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.lg,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1,
    borderColor: tokens.color.border,
    marginTop: tokens.space.sm,
  },
  infoText: {
    fontSize: tokens.font.body,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
    lineHeight: 20,
  },
});
