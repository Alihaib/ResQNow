/**
 * Secondary navigation row — icon, title, subtitle, trailing chevron or chip.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";
import { useUiDirection } from "./layout";

export type ShortcutEmphasis = "default" | "primary" | "accent";

export type ShortcutCardProps = {
  icon?: string;
  ionIcon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  trailing?: React.ReactNode;
  /** primary = active mission (blue accent); use danger surfaces only via parent SOS UI */
  emphasis?: ShortcutEmphasis;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
};

export default function ShortcutCard({
  icon,
  ionIcon,
  title,
  subtitle,
  onPress,
  trailing,
  emphasis = "default",
  style,
  accessibilityLabel,
}: ShortcutCardProps) {
  const { row, chevronForward } = useUiDirection();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.98}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[
        styles.card,
        row,
        emphasis === "primary" || emphasis === "accent"
          ? styles.cardAccent
          : null,
        style as ViewStyle,
      ]}
    >
      {ionIcon ? (
        <View style={styles.iconPill}>
          <Ionicons name={ionIcon} size={18} color={tokens.color.textMuted} />
        </View>
      ) : icon ? (
        <Text style={styles.icon} accessibilityElementsHidden>
          {icon}
        </Text>
      ) : null}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        <Text style={styles.chevron} accessibilityElementsHidden>
          {chevronForward}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.bgSubtle,
    borderRadius: tokens.radius.lg,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    alignItems: "center",
    marginBottom: tokens.space.sm,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    gap: tokens.space.md,
    minHeight: 56,
  },
  cardAccent: {
    backgroundColor: tokens.color.primarySurface,
    borderColor: tokens.color.primaryBorder,
    borderStartWidth: 3,
    borderStartColor: tokens.color.primary,
  },
  icon: { fontSize: 22 },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1 },
  title: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textSecondary,
  },
  subtitle: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    marginTop: 2,
    fontWeight: tokens.fontWeight.medium,
  },
  chevron: {
    fontSize: 22,
    color: tokens.color.textFaint,
    fontWeight: tokens.fontWeight.semibold,
  },
});
