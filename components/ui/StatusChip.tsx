/**
 * Semantic status pill — shared colours for danger / warning / success / info / primary / neutral.
 */

import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";
import { useUiDirection } from "./layout";

export type StatusChipVariant =
  | "danger"
  | "warning"
  | "success"
  | "neutral"
  | "info"
  | "primary";
export type StatusChipSize = "sm" | "md";

const PRESETS: Record<StatusChipVariant, { bg: string; fg: string }> = {
  danger: { bg: tokens.color.dangerBg, fg: tokens.color.dangerDark },
  warning: { bg: tokens.color.warningBg, fg: tokens.color.warningText },
  success: { bg: tokens.color.successBg, fg: tokens.color.successText },
  neutral: { bg: tokens.color.neutralBg, fg: tokens.color.neutralText },
  info: { bg: tokens.color.infoBg, fg: tokens.color.info },
  primary: { bg: tokens.color.primaryBg, fg: tokens.color.primaryDark },
};

export type StatusChipProps = {
  label: string;
  variant?: StatusChipVariant;
  size?: StatusChipSize;
  bg?: string;
  fg?: string;
  solid?: boolean;
  icon?: string;
  style?: ViewStyle;
};

export default function StatusChip({
  label,
  variant = "neutral",
  size = "md",
  bg,
  fg,
  solid,
  icon,
  style,
}: StatusChipProps) {
  const { row, text } = useUiDirection();
  const preset = PRESETS[variant];
  const bgColor = bg ?? (solid ? preset.fg : preset.bg);
  const fgColor = fg ?? (solid ? tokens.color.textOnPrimary : preset.fg);
  const sizeStyle = size === "sm" ? styles.sm : styles.md;
  return (
    <View
      style={[
        styles.chip,
        row,
        sizeStyle,
        {
          backgroundColor: bgColor,
          borderColor: solid ? "transparent" : tokens.color.border,
        },
        style,
      ]}
      accessibilityRole="text"
    >
      {icon ? (
        <Text style={[styles.icon, { color: fgColor }]} accessibilityElementsHidden>
          {icon}
        </Text>
      ) : null}
      <Text
        style={[
          styles.label,
          size === "sm" ? styles.labelSm : styles.labelMd,
          { color: fgColor },
          text,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.hairline,
    alignSelf: "flex-start",
  },
  sm: {
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
    gap: tokens.space.xs,
  },
  md: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: 4,
    gap: tokens.space.xs,
  },
  icon: { fontSize: 12, fontWeight: tokens.fontWeight.bold },
  label: { fontWeight: tokens.fontWeight.heavy, letterSpacing: 0.3 },
  labelSm: { fontSize: tokens.font.overline },
  labelMd: { fontSize: tokens.font.caption },
});
