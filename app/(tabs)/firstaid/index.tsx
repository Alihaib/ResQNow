import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { firstAidCategories } from "../../../src/firstAid/categories";
import { pick } from "../../../src/firstAid/types";
import { useLanguage } from "../../../src/context/LanguageContext";

type SmartCase = "not_breathing" | "unconscious" | "bleeding" | "choking" | "burn" | "general";

function emergencyHighlightKey(smartCase?: string): "bleeding" | "breathing" | "burns" | null {
  switch (smartCase as SmartCase | undefined) {
    case "bleeding":
      return "bleeding";
    case "burn":
      return "burns";
    case "not_breathing":
    case "choking":
    case "unconscious":
      return "breathing";
    default:
      return null;
  }
}

function CategoryCard({
  icon,
  title,
  subtitle,
  onPress,
  highlighted,
  pulsing,
  dimmed,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  highlighted: boolean;
  pulsing: boolean;
  dimmed: boolean;
}) {
  const on = highlighted;
  const scale = useSharedValue(on ? 1.02 : 1);
  const ring = useSharedValue(on ? 1 : 0);
  const pressed = useSharedValue(0);
  const pulse = useSharedValue(1);
  const dim = useSharedValue(dimmed ? 0.65 : 1);

  useEffect(() => {
    // SOS-only temporary highlight (no visible prioritization in normal mode)
    scale.value = withTiming(on ? 1.03 : 1, { duration: 220, easing: Easing.out(Easing.cubic) });
    ring.value = withTiming(on ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [on, ring, scale]);

  useEffect(() => {
    dim.value = withTiming(dimmed ? 0.65 : 1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [dimmed, dim]);

  useEffect(() => {
    if (pulsing) {
      pulse.value = withRepeat(
        withTiming(1.03, { duration: 520, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      return;
    }
    pulse.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [pulsing, pulse]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value * (pressed.value ? 0.98 : 1) }],
    borderColor: ring.value ? "#0F172A" : "#E2E8F0",
    shadowOpacity: pressed.value ? 0.04 : 0.06,
    opacity: dim.value,
  }));

  return (
    <Animated.View style={[styles.card, anim]}>
      <Pressable
        style={styles.cardPress}
        onPress={onPress}
        onPressIn={() => {
          pressed.value = 1;
        }}
        onPressOut={() => {
          pressed.value = 0;
        }}
      >
        <View style={styles.iconBubble}>
          <Text style={styles.cardIcon}>{icon}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function categoryDescription(catId: string, t: (k: string, fb?: string) => string): string {
  switch (catId) {
    case "bleeding":
      return t("firstAidCatDesc_bleeding", "Bleeding control basics");
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

export default function FirstAidIndexScreen() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { openMode, smartCase } = useLocalSearchParams<{ openMode?: string; smartCase?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const gridYRef = useRef(0);
  const itemYRef = useRef<Record<string, number>>({});

  const highlightKey = useMemo(() => emergencyHighlightKey(smartCase), [smartCase]);
  const [sosPulseActive, setSosPulseActive] = useState(false);

  useEffect(() => {
    if (openMode !== "sos") return;
    // Pulse + dim for a short time only.
    setSosPulseActive(true);
    const id = setTimeout(() => {
      const key = highlightKey;
      const y = key ? itemYRef.current[key] : undefined;
      scrollRef.current?.scrollTo({ y: Math.max(0, (y ?? gridYRef.current) - 10), animated: true });
    }, 80);
    const stop = setTimeout(() => setSosPulseActive(false), 2600);
    return () => {
      clearTimeout(id);
      clearTimeout(stop);
    };
  }, [openMode, highlightKey]);

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.hubTitle}>{t("firstAidHubTitle", "🧠 First Aid")}</Text>
        <Text style={styles.hubSubtitle}>{t("firstAidHubSubtitle", "Quick guidance for emergencies")}</Text>
      </View>

      <View
        onLayout={(e) => {
          gridYRef.current = e.nativeEvent.layout.y;
        }}
      >
        <View style={styles.grid}>
          {firstAidCategories.map((cat) => (
            <View
              key={cat.id}
              onLayout={(e) => {
                itemYRef.current[cat.id] = e.nativeEvent.layout.y;
              }}
              style={styles.gridItem}
            >
              <CategoryCard
                icon={cat.icon}
                title={pick(lang, cat.title)}
                subtitle={categoryDescription(cat.id, t)}
                onPress={() => router.push(`/(tabs)/firstaid/category/${cat.id}`)}
                highlighted={openMode === "sos" && highlightKey === cat.id}
                pulsing={openMode === "sos" && sosPulseActive && highlightKey === cat.id}
                dimmed={openMode === "sos" && sosPulseActive && highlightKey !== null && highlightKey !== cat.id}
              />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  content: { paddingTop: 28, paddingBottom: 28, paddingHorizontal: 18 },
  header: { marginBottom: 24 },
  hubTitle: { fontSize: 28, fontWeight: "900", color: "#0F172A", marginBottom: 6 },
  hubSubtitle: { fontSize: 14, fontWeight: "700", color: "#64748B" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  gridItem: { width: "48%", marginBottom: 14 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardPress: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 132,
  },
  iconBubble: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cardIcon: { fontSize: 28 },
  cardTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A", textAlign: "center" },
  cardSubtitle: { fontSize: 12, fontWeight: "700", color: "#64748B", marginTop: 6, textAlign: "center" },
});
