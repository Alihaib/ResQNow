/**
 * Loading / empty / error placeholder — calm bordered card, no heavy shadow.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { tokens } from "../../src/ui/tokens";

export type EmptyStateTone = "default" | "danger" | "primary";

export type EmptyStateProps = {
  /** @deprecated Prefer ionIcon for visible UI */
  icon?: string;
  ionIcon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  tone?: EmptyStateTone;
};

export default function EmptyState({
  icon,
  ionIcon,
  title,
  subtitle,
  loading,
  tone = "default",
}: EmptyStateProps) {
  const spinnerColor =
    tone === "danger"
      ? tokens.color.danger
      : tone === "primary"
        ? tokens.color.primary
        : tokens.color.textMuted;

  const iconColor =
    tone === "danger" ? tokens.color.danger : tokens.color.primary;

  return (
    <View
      style={[
        styles.card,
        tone === "danger" && styles.cardDanger,
      ]}
      accessibilityRole="summary"
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} size="small" />
      ) : ionIcon ? (
        <View style={styles.iconPill}>
          <Ionicons name={ionIcon} size={28} color={iconColor} />
        </View>
      ) : icon ? (
        <Text style={styles.icon} accessibilityElementsHidden>
          {icon}
        </Text>
      ) : null}
      {title ? (
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={3}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.xl,
    paddingVertical: tokens.space.xl,
    paddingHorizontal: tokens.space.lg,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    alignItems: "center",
    gap: tokens.space.sm,
  },
  cardDanger: {
    borderColor: tokens.color.dangerBorder,
    backgroundColor: tokens.color.dangerSurface,
  },
  iconPill: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.space.xs,
  },
  icon: { fontSize: 26 },
  title: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.bold,
    color: tokens.color.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: tokens.font.body,
    color: tokens.color.textMuted,
    fontWeight: tokens.fontWeight.medium,
    textAlign: "center",
    lineHeight: 18,
  },
});
