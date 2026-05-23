import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BlurredBar from "../ui/BlurredBar";
import { useUiDirection } from "../ui/layout";
import { tokens } from "../../src/ui/tokens";
import { firstAidTheme } from "./theme";
import {
  GUIDE_HEADER_PROGRESS_HEIGHT,
  GUIDE_HEADER_ROW_GAP,
  GUIDE_HEADER_ROW_HEIGHT,
  GUIDE_HEADER_VERTICAL_PAD,
} from "./guideLayout";

const PROGRESS_BLUE = "#2563EB";

export default function FirstAidGuideProgressHeader({
  categoryName,
  stepLabel,
  currentIndex,
  totalSteps,
  onBack,
}: {
  categoryName: string;
  stepLabel: string;
  currentIndex: number;
  totalSteps: number;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { row, text, chevronBack, isRTL } = useUiDirection();
  const pct = totalSteps > 0 ? Math.min(1, (currentIndex + 1) / totalSteps) : 0;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(pct, {
      duration: tokens.motion.slow,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <BlurredBar style={styles.bar} intensity={72}>
      <View
        style={[
          styles.inner,
          { paddingTop: insets.top + GUIDE_HEADER_VERTICAL_PAD },
        ]}
      >
        <View style={[styles.row, row]}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
          >
            <Text style={styles.backChevron}>{chevronBack}</Text>
          </Pressable>
          <Text style={[styles.category, text]} numberOfLines={1}>
            {categoryName}
          </Text>
          <Text style={[styles.step, text]} numberOfLines={1}>
            {stepLabel}
          </Text>
        </View>
        <View style={styles.track}>
          <Animated.View
            style={[styles.fill, fillStyle, isRTL && styles.fillRtl]}
          />
        </View>
      </View>
    </BlurredBar>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: 1,
    borderBottomColor: firstAidTheme.glassBorder,
    flexShrink: 0,
    zIndex: 2,
  },
  inner: {
    paddingHorizontal: tokens.space.lg,
    paddingBottom: GUIDE_HEADER_VERTICAL_PAD,
    gap: GUIDE_HEADER_ROW_GAP,
  },
  row: {
    alignItems: "center",
    height: GUIDE_HEADER_ROW_HEIGHT,
    gap: tokens.space.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: firstAidTheme.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  backPressed: { opacity: 0.88 },
  backChevron: {
    fontSize: 20,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    lineHeight: 22,
  },
  category: {
    flex: 1,
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.bold,
    color: PROGRESS_BLUE,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  step: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textSecondary,
    maxWidth: "38%",
  },
  track: {
    height: GUIDE_HEADER_PROGRESS_HEIGHT,
    borderRadius: 2,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    overflow: "hidden",
  },
  fill: {
    width: "100%",
    height: "100%",
    backgroundColor: PROGRESS_BLUE,
    borderRadius: 2,
    transformOrigin: "left",
  },
  fillRtl: { transformOrigin: "right" },
});
