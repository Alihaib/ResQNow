import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { GlassSurface } from "../ai-emergency";
import { tokens } from "../../src/ui/tokens";
import { textAlignStyle } from "../../src/utils/rtl";
import { firstAidTheme } from "./theme";

const PRIMARY_CARD_HEIGHT = 168;
const SECONDARY_CARD_HEIGHT = 128;

export default function FirstAidCategoryCard({
  icon,
  title,
  description,
  accent,
  onPress,
  highlighted,
  pulsing,
  dimmed,
  lang,
  tier = "primary",
  priority = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  accent: string;
  onPress: () => void;
  highlighted?: boolean;
  pulsing?: boolean;
  dimmed?: boolean;
  lang: string;
  /** Primary = life-saving grid; secondary = more topics */
  tier?: "primary" | "secondary";
  /** CPR / breathing / bleeding emphasis */
  priority?: boolean;
}) {
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);
  const dim = useSharedValue(1);
  const isPrimary = tier === "primary";
  const iconColor = isPrimary && priority ? firstAidTheme.primary : accent;

  useEffect(() => {
    dim.value = withTiming(dimmed ? 0.5 : 1, {
      duration: tokens.motion.slow,
      easing: Easing.out(Easing.cubic),
    });
  }, [dimmed, dim]);

  useEffect(() => {
    if (pulsing) {
      pulse.value = withRepeat(
        withTiming(1.015, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      return;
    }
    pulse.value = withTiming(1, { duration: tokens.motion.normal });
  }, [pulsing, pulse]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value }],
    opacity: dim.value,
  }));

  const cardHeight = isPrimary ? PRIMARY_CARD_HEIGHT : SECONDARY_CARD_HEIGHT;

  return (
    <Animated.View
      style={[
        styles.wrap,
        anim,
        highlighted && styles.wrapHighlight,
      ]}
    >
      {isPrimary ? (
        <GlassSurface radius={firstAidTheme.radius} style={styles.glassFill}>
          <Pressable
            onPress={onPress}
            onPressIn={() => {
              scale.value = withTiming(0.98, { duration: tokens.motion.fast });
            }}
            onPressOut={() => {
              scale.value = withTiming(1, { duration: tokens.motion.normal });
            }}
            style={[styles.press, { height: cardHeight }]}
            accessibilityRole="button"
            accessibilityLabel={title}
          >
            {priority ? <View style={styles.priorityBar} /> : null}
            <View
              style={[
                styles.iconWrap,
                styles.iconWrapPrimary,
                {
                  backgroundColor: `${iconColor}12`,
                  borderColor: `${iconColor}24`,
                },
              ]}
            >
              <Ionicons name={icon} size={isPrimary ? 28 : 22} color={iconColor} />
            </View>
            <Text
              style={[
                styles.title,
                isPrimary && styles.titlePrimary,
                priority && styles.titlePriority,
                textAlignStyle(lang),
              ]}
              numberOfLines={2}
            >
              {title}
            </Text>
            <Text style={[styles.desc, textAlignStyle(lang)]} numberOfLines={2}>
              {description}
            </Text>
          </Pressable>
        </GlassSurface>
      ) : (
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            scale.value = withTiming(0.98, { duration: tokens.motion.fast });
          }}
          onPressOut={() => {
            scale.value = withTiming(1, { duration: tokens.motion.normal });
          }}
          style={[styles.pressSecondary, { height: cardHeight }]}
          accessibilityRole="button"
          accessibilityLabel={title}
        >
          <View style={[styles.iconWrap, styles.iconWrapSecondary]}>
            <Ionicons name={icon} size={20} color={tokens.color.textMuted} />
          </View>
          <Text style={[styles.titleSecondary, textAlignStyle(lang)]} numberOfLines={2}>
            {title}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  wrapHighlight: {
    borderRadius: firstAidTheme.radius,
    borderWidth: 2,
    borderColor: tokens.color.danger,
  },
  glassFill: {
    flex: 1,
  },
  press: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    justifyContent: "flex-start",
    alignItems: "stretch",
  },
  priorityBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: firstAidTheme.primary,
    borderTopLeftRadius: firstAidTheme.radius,
    borderTopRightRadius: firstAidTheme.radius,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: tokens.space.md,
  },
  iconWrapPrimary: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  iconWrapSecondary: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: tokens.color.bgSubtle,
    borderColor: tokens.color.border,
    alignSelf: "flex-start",
  },
  title: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    lineHeight: 22,
  },
  titlePrimary: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.semibold,
  },
  titlePriority: {
    color: tokens.color.textPrimary,
    fontWeight: tokens.fontWeight.bold,
  },
  titleSecondary: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textSecondary,
    lineHeight: 20,
  },
  desc: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
    lineHeight: 17,
    marginTop: tokens.space.xs,
  },
  pressSecondary: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    justifyContent: "flex-start",
  },
});
