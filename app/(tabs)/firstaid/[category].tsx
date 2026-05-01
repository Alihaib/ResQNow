import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { FirstAidAnimationScene } from "../../../src/components/FirstAidAnimation";
import { useLanguage } from "../../../src/context/LanguageContext";

const { width: SCREEN_W } = Dimensions.get("window");

const STEP_COUNTS: Record<string, number> = {
  bleeding: 6,
  burns: 6,
  choking: 6,
  cpr: 8,
  fractures: 6,
  poisoning: 6,
  shock: 6,
  unconscious: 7,
};

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

export default function FirstAidCategoryScreen() {
  const { category } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useLanguage();

  const categoryKey = (category as string) || "bleeding";
  const stepCount = STEP_COUNTS[categoryKey] || 6;
  const accent = CATEGORY_COLORS[categoryKey] || "#D62828";

  const [currentStep, setCurrentStep] = useState(0);
  const [displayedStep, setDisplayedStep] = useState(0);
  const busy = useRef(false);

  // Screen entrance
  const screenY = useSharedValue(60);
  const screenOp = useSharedValue(0);

  // Step card
  const cardX = useSharedValue(0);
  const cardOp = useSharedValue(1);
  const cardScale = useSharedValue(1);

  useEffect(() => {
    screenY.value = withTiming(0, { duration: 450, easing: Easing.out(Easing.ease) });
    screenOp.value = withTiming(1, { duration: 350 });
  }, []);

  const screenStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateY: screenY.value }],
    opacity: screenOp.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateX: cardX.value },
      { scale: cardScale.value },
    ],
    opacity: cardOp.value,
  }));

  const applyStep = (next: number) => {
    setDisplayedStep(next);
    setCurrentStep(next);
  };

  const goToStep = (next: number, dir: "fwd" | "back") => {
    if (next < 0 || next >= stepCount || busy.current) return;
    busy.current = true;

    const EXIT_X = dir === "fwd" ? -SCREEN_W * 0.65 : SCREEN_W * 0.65;
    const ENTER_X = dir === "fwd" ? SCREEN_W * 0.65 : -SCREEN_W * 0.65;

    // Exit: slide out + shrink + fade
    cardX.value = withTiming(EXIT_X, { duration: 200, easing: Easing.in(Easing.ease) }, (done) => {
      if (!done) return;
      // Instantly reposition to entry side
      cardX.value = ENTER_X;
      cardScale.value = 0.88;
      cardOp.value = 0;
      // Update content on JS thread, then animate in
      runOnJS(applyStep)(next);
      cardX.value = withSpring(0, { damping: 16, stiffness: 180 }, (done2) => {
        if (done2) runOnJS(clearBusy)();
      });
      cardScale.value = withSpring(1, { damping: 14, stiffness: 160 });
      cardOp.value = withTiming(1, { duration: 180 });
    });
    cardScale.value = withTiming(0.92, { duration: 200 });
    cardOp.value = withTiming(0, { duration: 160 });
  };

  const clearBusy = () => { busy.current = false; };

  const progress = (currentStep + 1) / stepCount;
  const stepText = t(`${categoryKey}_step${displayedStep + 1}`);
  const isLast = currentStep === stepCount - 1;
  const isFirst = currentStep === 0;

  return (
    <View style={styles.container}>
      {/* Colored header */}
      <View style={[styles.header, { backgroundColor: accent }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/firstaid"))}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{t(categoryKey)}</Text>
        <View style={styles.stepPill}>
          <Text style={styles.stepPillText}>{currentStep + 1}/{stepCount}</Text>
        </View>
      </View>

      <Animated.View style={screenStyle}>
        {/* 3D Animation Scene */}
        <View style={styles.sceneWrapper}>
          <FirstAidAnimationScene category={categoryKey} />
        </View>

        {/* Progress bar */}
        <View style={styles.progressBg}>
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: accent, width: `${progress * 100}%` as any },
            ]}
          />
        </View>

        {/* Step card with 3D transition */}
        <Animated.View style={[styles.stepCard, cardStyle]}>
          <View style={[styles.stepBadge, { backgroundColor: accent }]}>
            <Text style={styles.stepBadgeText}>
              {t("step") || "Step"} {displayedStep + 1}
            </Text>
          </View>
          <Text style={styles.stepText}>{stepText}</Text>
        </Animated.View>

        {/* Navigation */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, styles.navSecondary, isFirst && styles.navDisabled]}
            onPress={() => goToStep(currentStep - 1, "back")}
            disabled={isFirst}
          >
            <Text style={[styles.navBtnText, { color: isFirst ? "#9CA3AF" : "#003049" }]}>
              ‹ {t("prev") || "Prev"}
            </Text>
          </TouchableOpacity>

          {isLast ? (
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: "#16A34A" }]}
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/firstaid"))}
            >
              <Text style={[styles.navBtnText, { color: "#fff" }]}>✓ {t("done") || "Done"}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: accent }]}
              onPress={() => goToStep(currentStep + 1, "fwd")}
            >
              <Text style={[styles.navBtnText, { color: "#fff" }]}>{t("next") || "Next"} ›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Step dots */}
        <View style={styles.dotsRow}>
          {Array.from({ length: stepCount }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentStep
                  ? { backgroundColor: accent, width: 20 }
                  : i < currentStep
                  ? { backgroundColor: accent, opacity: 0.4 }
                  : { backgroundColor: "#D1D5DB" },
              ]}
            />
          ))}
        </View>

        {/* Warning */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>{t("generalGuidelines")}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    paddingTop: 58,
    paddingBottom: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    alignItems: "flex-start",
  },
  backText: {
    fontSize: 34,
    color: "#fff",
    fontWeight: "700",
    lineHeight: 40,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  stepPill: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 48,
    alignItems: "center",
  },
  stepPillText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
  },
  sceneWrapper: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 14,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  progressBg: {
    height: 5,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
    borderRadius: 3,
    marginBottom: 14,
    overflow: "hidden",
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
  },
  stepCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 22,
    minHeight: 110,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  stepBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 13,
  },
  stepBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  stepText: {
    fontSize: 17,
    color: "#1F2937",
    lineHeight: 27,
    fontWeight: "600",
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  navSecondary: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  navDisabled: {
    opacity: 0.35,
  },
  navBtnText: {
    fontSize: 16,
    fontWeight: "800",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  dot: {
    height: 7,
    width: 7,
    borderRadius: 4,
  },
  warningCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  warningIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
    lineHeight: 18,
  },
});
