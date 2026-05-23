/**
 * Label + value row for clinical / profile metadata.
 */

import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";
import { useUiDirection } from "./layout";

export type InfoRowProps = {
  label: string;
  value: string;
  /** Emphasize value (e.g. vitals) */
  strong?: boolean;
  style?: ViewStyle;
};

export default function InfoRow({ label, value, strong, style }: InfoRowProps) {
  const { row, text } = useUiDirection();
  return (
    <View style={[styles.row, row, style]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          strong && styles.valueStrong,
          text,
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: tokens.space.md,
    gap: tokens.space.lg,
  },
  label: {
    flex: 1,
    fontSize: tokens.font.body,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
  },
  value: {
    flex: 1.2,
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
  },
  valueStrong: {
    fontWeight: tokens.fontWeight.bold,
  },
});
