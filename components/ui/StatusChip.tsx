/**
 * Compact pill chip for status / severity / distance / time labels.
 *
 * Variants are visual only — no business meaning. The caller passes either a
 * preset variant ("danger", "warning", "success", "neutral", "info") or a
 * custom { bg, fg } pair.
 */

import { StyleSheet, Text, View, ViewStyle } from "react-native";

type Variant = "danger" | "warning" | "success" | "neutral" | "info";

const PRESETS: Record<Variant, { bg: string; fg: string }> = {
  danger: { bg: "#FEE2E2", fg: "#B91C1C" },
  warning: { bg: "#FEF3C7", fg: "#92400E" },
  success: { bg: "#D1FAE5", fg: "#065F46" },
  neutral: { bg: "#F1F5F9", fg: "#475569" },
  info: { bg: "#DBEAFE", fg: "#1D4ED8" },
};

type Props = {
  label: string;
  variant?: Variant;
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
  bg,
  fg,
  solid,
  icon,
  style,
}: Props) {
  const preset = PRESETS[variant];
  const bgColor = bg ?? (solid ? preset.fg : preset.bg);
  const fgColor = fg ?? (solid ? "#FFFFFF" : preset.fg);
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: bgColor, borderColor: solid ? "transparent" : bgColor },
        style,
      ]}
    >
      {icon ? <Text style={[styles.icon, { color: fgColor }]}>{icon}</Text> : null}
      <Text style={[styles.label, { color: fgColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  icon: { fontSize: 12, marginRight: 4, fontWeight: "800" },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
});
