/**
 * Compact stat tile — label, large value, optional hint.
 */

import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";

export type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  style?: ViewStyle;
};

const VALUE_COLOR: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: tokens.color.textPrimary,
  primary: tokens.color.primary,
  success: tokens.color.success,
  warning: tokens.color.warning,
  danger: tokens.color.danger,
};

export default function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  style,
}: MetricCardProps) {
  return (
    <View style={[styles.card, style]} accessibilityRole="text">
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.value, { color: VALUE_COLOR[tone] }]} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.md,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    padding: tokens.space.md,
    gap: tokens.space.xs,
  },
  label: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.bold,
    color: tokens.color.textFaint,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  value: {
    fontSize: tokens.font.metric,
    fontWeight: tokens.fontWeight.heavy,
    letterSpacing: -0.4,
  },
  hint: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    fontWeight: tokens.fontWeight.medium,
  },
});
