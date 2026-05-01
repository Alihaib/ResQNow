import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useLanguage } from "../../src/context/LanguageContext";

const CATEGORY_COLORS: Record<string, string> = {
  bleeding: "#DC2626",
  burns: "#EA580C",
  choking: "#D97706",
  cpr: "#DC2626",
  fractures: "#7C3AED",
  poisoning: "#7C3AED",
  shock: "#D97706",
  unconscious: "#1D4ED8",
};

function CategoryCard({
  id,
  icon,
  titleKey,
  t,
  onPress,
}: {
  id: string;
  icon: string;
  titleKey: string;
  t: (k: string) => string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const rotateX = useSharedValue(0);
  const accent = CATEGORY_COLORS[id] || "#D62828";

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { rotateX: rotateX.value + "deg" },
      { scale: scale.value },
    ],
  }));

  return (
    <TouchableOpacity
      style={styles.cardTouchable}
      onPressIn={() => {
        scale.value = withTiming(0.91, { duration: 110 });
        rotateX.value = withTiming(8, { duration: 110 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 });
        rotateX.value = withSpring(0, { damping: 10, stiffness: 200 });
      }}
      onPress={onPress}
      activeOpacity={1}
    >
      <Animated.View style={[styles.categoryCard, { borderTopColor: accent, borderTopWidth: 3 }, cardStyle]}>
        <Text style={styles.categoryIcon}>{icon}</Text>
        <Text style={styles.categoryTitle}>{t(titleKey)}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function FirstAidScreen() {
  const { t } = useLanguage();
  const router = useRouter();

  const categories = [
    { id: "bleeding", icon: "🩸", titleKey: "bleeding" },
    { id: "burns", icon: "🔥", titleKey: "burns" },
    { id: "choking", icon: "😷", titleKey: "choking" },
    { id: "cpr", icon: "❤️", titleKey: "cpr" },
    { id: "fractures", icon: "🦴", titleKey: "fractures" },
    { id: "poisoning", icon: "☠️", titleKey: "poisoning" },
    { id: "shock", icon: "⚡", titleKey: "shock" },
    { id: "unconscious", icon: "😴", titleKey: "unconscious" },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>⛑</Text>
        <Text style={styles.title}>{t("firstAidTitle")}</Text>
        <Text style={styles.subtitle}>{t("firstAidSubtitle")}</Text>
      </View>

      {/* Emergency Notice */}
      <View style={styles.noticeCard}>
        <Text style={styles.noticeIcon}>⚠️</Text>
        <Text style={styles.noticeText}>
          {t("emergencyNotice")}
        </Text>
      </View>

      {/* Categories Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("categories")}</Text>
        <View style={styles.grid}>
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              id={category.id}
              icon={category.icon}
              titleKey={category.titleKey}
              t={t}
              onPress={() => router.push(`/(tabs)/firstaid/${category.id}`)}
            />
          ))}
        </View>
      </View>

      {/* Quick Tips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("quickTips")}</Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>✓ {t("checkDangerFirst")}</Text>
          <Text style={styles.tipText}>✓ {t("callEmergencyIfNeeded")}</Text>
          <Text style={styles.tipText}>✓ {t("stayCalmReassure")}</Text>
          <Text style={styles.tipText}>✓ {t("protectFromInfection")}</Text>
        </View>
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
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    fontSize: 60,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#003049",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6C757D",
    textAlign: "center",
  },
  noticeCard: {
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  noticeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: "#92400E",
    fontWeight: "600",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#003049",
    marginBottom: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cardTouchable: {
    width: "47%",
  },
  categoryCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#003049",
  },
  tipCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipText: {
    fontSize: 16,
    color: "#212529",
    marginBottom: 12,
    lineHeight: 24,
  },
});


