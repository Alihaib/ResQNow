import { Ionicons } from "@expo/vector-icons";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useUiDirection } from "../ui/layout";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { GlassSurface } from "../ai-emergency";
import { tokens } from "../../src/ui/tokens";
import { firstAidTheme } from "./theme";

export function FirstAidProgressBar({
  current,
  total,
  accent,
  lang,
  style,
}: {
  current: number;
  total: number;
  accent: string;
  lang: string;
  style?: ViewStyle;
}) {
  const pct = total > 0 ? Math.min(1, (current + 1) / total) : 0;
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(pct, {
      duration: tokens.motion.slow,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, width]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: width.value }],
  }));

  const { textAlign } = useUiDirection();

  return (
    <View style={[styles.progressWrap, style]}>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            fillStyle,
            { backgroundColor: accent },
          ]}
        />
      </View>
      <Text style={[styles.progressLabel, { textAlign }]}>
        {current + 1} / {total}
      </Text>
    </View>
  );
}

export function FirstAidInstructionCard({
  stepNumber,
  text,
  active,
  accent,
  lang,
}: {
  stepNumber: number;
  text: string;
  active: boolean;
  accent: string;
  lang: string;
}) {
  const opacity = useSharedValue(active ? 1 : 0.5);
  const scale = useSharedValue(active ? 1 : 0.98);

  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0.55, {
      duration: tokens.motion.normal,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withTiming(active ? 1 : 0.99, {
      duration: tokens.motion.normal,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, opacity, scale]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const { row, textAlign, chevronIcon } = useUiDirection();

  return (
    <Animated.View style={anim}>
      <GlassSurface
        radius={firstAidTheme.radius}
        style={active ? [styles.stepActive, { borderColor: `${accent}40` }] : undefined}
      >
        <View style={[styles.stepInner, row]}>
          <View
            style={[
              styles.stepBadge,
              { backgroundColor: active ? accent : tokens.color.textFaint },
            ]}
          >
            <Text style={styles.stepBadgeText}>{stepNumber}</Text>
          </View>
          <Text
            style={[
              styles.stepText,
              !active && styles.stepTextDim,
              { textAlign, flex: 1 },
            ]}
          >
            {text}
          </Text>
          {active ? (
            <Ionicons
              name={chevronIcon("forward")}
              size={20}
              color={accent}
            />
          ) : null}
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

export function FirstAidVoicePanel({
  children,
  lang,
}: {
  children: ReactNode;
  lang: string;
}) {
  const { row } = useUiDirection();
  return (
    <GlassSurface radius={firstAidTheme.radius} style={styles.voicePanel}>
      <View style={[styles.voiceInner, row]}>{children}</View>
    </GlassSurface>
  );
}

export function FirstAidWarningCard({
  title,
  lines,
  lang,
}: {
  title: string;
  lines: string[];
  lang: string;
}) {
  const { row, textAlign } = useUiDirection();
  return (
    <GlassSurface radius={firstAidTheme.radius} style={styles.warnWrap}>
      <View style={[styles.warnHeader, row]}>
        <Ionicons name="warning-outline" size={22} color={tokens.color.danger} />
        <Text style={[styles.warnTitle, { textAlign }]}>{title}</Text>
      </View>
      {lines.map((line, i) => (
        <Text key={i} style={[styles.warnLine, { textAlign }]}>
          {line}
        </Text>
      ))}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  progressWrap: {
    marginBottom: tokens.space.lg,
    gap: tokens.space.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    overflow: "hidden",
  },
  progressFill: {
    width: "100%",
    height: "100%",
    borderRadius: 3,
    transformOrigin: "left",
  },
  progressLabel: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textMuted,
  },
  stepActive: {
    borderWidth: 1.5,
  },
  stepInner: {
    alignItems: "flex-start",
    gap: tokens.space.md,
    padding: tokens.space.lg,
  },
  stepBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    color: tokens.color.textOnPrimary,
    fontSize: tokens.font.title,
    fontWeight: tokens.fontWeight.heavy,
  },
  stepText: {
    fontSize: tokens.font.title,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    lineHeight: 28,
  },
  stepTextDim: {
    color: tokens.color.textMuted,
    fontWeight: tokens.fontWeight.medium,
    fontSize: tokens.font.bodyLg,
  },
  voicePanel: {
    marginBottom: tokens.space.lg,
  },
  voiceInner: {
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.space.sm,
    padding: tokens.space.md,
  },
  warnWrap: {
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.2)",
    padding: tokens.space.lg,
    marginBottom: tokens.space.md,
  },
  warnHeader: {
    alignItems: "center",
    gap: tokens.space.sm,
    marginBottom: tokens.space.md,
  },
  warnTitle: {
    flex: 1,
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.dangerDark,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  warnLine: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.dangerDark,
    lineHeight: 26,
    marginBottom: tokens.space.sm,
  },
});
