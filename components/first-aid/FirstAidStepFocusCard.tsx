import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import { GlassSurface } from "../ai-emergency";
import { tokens } from "../../src/ui/tokens";
import { useUiDirection } from "../ui/layout";
import type { GuideInstructionTypography } from "./guideLayout";
import { firstAidTheme } from "./theme";

export type StepFocusVariant = "instruction" | "warning";

const WARN_STRIP_HEIGHT = 44;
const KICKER_BLOCK = 28;

/** Hero instruction card — natural height, soft max, in-card scroll when needed. */
export default function FirstAidStepFocusCard({
  stepLabel,
  headline,
  body,
  showHeadline = false,
  variant = "instruction",
  maxCardHeight,
  typography,
  style,
}: {
  stepLabel: string;
  headline: string;
  body: string;
  showHeadline?: boolean;
  variant?: StepFocusVariant;
  maxCardHeight: number;
  typography: GuideInstructionTypography;
  style?: ViewStyle;
}) {
  const { row, text } = useUiDirection();
  const isWarning = variant === "warning";
  const displayHeadline = !isWarning && showHeadline;
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const scrollOverflows = contentHeight > viewportHeight + 2;

  const scrollMaxHeight = useMemo(() => {
    const chrome = WARN_STRIP_HEIGHT + (isWarning ? 0 : KICKER_BLOCK) + 56;
    return Math.max(120, maxCardHeight - chrome);
  }, [isWarning, maxCardHeight]);

  const scrollContentStyle = useMemo(
    () => [
      styles.textScrollContent,
      viewportHeight > 0 ? { minHeight: viewportHeight } : null,
      !scrollOverflows ? styles.textScrollCentered : null,
    ],
    [viewportHeight, scrollOverflows],
  );

  const instructionStyle = useMemo(
    () => [
      typography.style,
      text,
      isWarning ? styles.instructionWarningColor : styles.instructionColor,
    ],
    [isWarning, text, typography.style],
  );

  const onScrollLayout = (e: LayoutChangeEvent) => {
    setViewportHeight(e.nativeEvent.layout.height);
  };

  return (
    <GlassSurface
      radius={firstAidTheme.sheetRadius}
      style={[
        styles.card,
        isWarning && styles.cardWarning,
        { maxHeight: maxCardHeight },
        style,
      ]}
    >
      {isWarning ? (
        <View style={[styles.warnStrip, row]}>
          <Ionicons name="warning-outline" size={16} color={tokens.color.danger} />
          <Text style={[styles.warnStripText, text]}>{headline}</Text>
        </View>
      ) : null}

      <View style={styles.inner}>
        {!isWarning ? (
          <Text style={[styles.kicker, text]}>{stepLabel}</Text>
        ) : null}

        <ScrollView
          style={[styles.textScroll, { maxHeight: scrollMaxHeight }]}
          onLayout={onScrollLayout}
          onContentSizeChange={(_w, h) => setContentHeight(h)}
          contentContainerStyle={scrollContentStyle}
          showsVerticalScrollIndicator={scrollOverflows}
          scrollEnabled={scrollOverflows}
          bounces={false}
          nestedScrollEnabled
          overScrollMode="never"
        >
          <View style={styles.textBlock}>
            {displayHeadline ? (
              <Text style={[styles.headline, text]}>{headline}</Text>
            ) : null}
            <Text style={instructionStyle}>{body}</Text>
          </View>
        </ScrollView>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: firstAidTheme.glassBorder,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  cardWarning: {
    borderColor: "rgba(220, 38, 38, 0.2)",
  },
  warnStrip: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(220, 38, 38, 0.1)",
  },
  warnStripText: {
    flex: 1,
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.bold,
    color: tokens.color.dangerDark,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  inner: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.xl,
    paddingBottom: tokens.space.xl,
  },
  kicker: {
    fontSize: 11,
    fontWeight: tokens.fontWeight.semibold,
    color: "rgba(37, 99, 235, 0.55)",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: tokens.space.lg,
  },
  textScroll: {
    flexGrow: 0,
  },
  textScrollContent: {
    paddingVertical: tokens.space.sm,
    paddingBottom: tokens.space.md,
  },
  textScrollCentered: {
    flexGrow: 1,
    justifyContent: "center",
  },
  textBlock: {
    gap: tokens.space.lg,
  },
  headline: {
    fontSize: 18,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
    lineHeight: 26,
  },
  instructionColor: {
    color: tokens.color.textPrimary,
    letterSpacing: -0.15,
  },
  instructionWarningColor: {
    color: tokens.color.dangerDark,
  },
});
