/**
 * Compact pill chip for status / severity / distance / time labels.
 *
 * Variants are visual only — no business meaning. The caller passes either
 * a preset variant ("danger", "warning", "success", "neutral", "info") or
 * a custom { bg, fg } pair.
 *
 * Sizes:
 *  - "sm" : compact pill used inside dense card metadata rows.
 *  - "md" : default, used at the top of cards next to a title.
 */

import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";

type Variant = "danger" | "warning" | "success" | "neutral" | "info";
type Size = "sm" | "md";

const PRESETS: Record<Variant, { bg: string; fg: string }> = {
  danger: { bg: tokens.color.dangerBg, fg: tokens.color.dangerDark },
  warning: { bg: tokens.color.warningBg, fg: tokens.color.warningText },
  success: { bg: tokens.color.successBg, fg: tokens.color.successText },
  neutral: { bg: "#F1F5F9", fg: tokens.color.textSecondary },
  info: { bg: tokens.color.infoBg, fg: tokens.color.info },
};

type Props = {
  label: string;
  variant?: Variant;
  size?: Size;
  /** Optional override colours (skips the preset). */
  bg?: string;
  fg?: string;
  /** Apply a stronger emphasis (filled background instead of tinted). */
  solid?: boolean;
  /** Optional small leading icon/emoji. */
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
}: Props) {
  const preset = PRESETS[variant];
  const bgColor = bg ?? (solid ? preset.fg : preset.bg);
  const fgColor = fg ?? (solid ? "#FFFFFF" : preset.fg);
  const sizeStyle = size === "sm" ? styles.sm : styles.md;
  return (
    <View
      style={[
        styles.chip,
        sizeStyle,
        {
          backgroundColor: bgColor,
          borderColor: solid ? "transparent" : bgColor,
        },
        style,
      ]}
    >
      {icon ? (
        <Text style={[styles.icon, { color: fgColor }]}>{icon}</Text>
      ) : null}
      <Text
        style={[
          styles.label,
          size === "sm" ? styles.labelSm : styles.labelMd,
          { color: fgColor },
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
    flexDirection: "row",
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.hairline,
    alignSelf: "flex-start",
  },
  sm: { paddingHorizontal: tokens.space.sm, paddingVertical: 2 },
  md: { paddingHorizontal: tokens.space.md, paddingVertical: 4 },
  icon: { fontSize: 12, marginRight: 4, fontWeight: "800" },
  label: { fontWeight: "900", letterSpacing: 0.4 },
  labelSm: { fontSize: 10 },
  labelMd: { fontSize: 11 },
});
