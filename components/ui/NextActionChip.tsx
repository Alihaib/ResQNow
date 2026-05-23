/**
 * Suggested next step pill — links to the single recommended action for a phase.
 */

import { StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";

export type NextActionChipProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "warning";
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export default function NextActionChip({
  label,
  onPress,
  variant = "primary",
  style,
  accessibilityLabel,
}: NextActionChipProps) {
  const isPrimary = variant === "primary";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.chip,
        isPrimary ? styles.primary : styles.warning,
        style,
      ]}
    >
      <Text
        style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelWarning]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.hairline,
    minHeight: tokens.hitSlop,
    justifyContent: "center",
  },
  primary: {
    backgroundColor: tokens.color.primary,
    borderColor: tokens.color.primary,
  },
  warning: {
    backgroundColor: tokens.color.warningBg,
    borderColor: tokens.color.warningBorder,
  },
  label: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.bold,
    textAlign: "center",
  },
  labelPrimary: { color: tokens.color.textOnPrimary },
  labelWarning: { color: tokens.color.warningText },
});
