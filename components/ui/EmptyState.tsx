/**
 * Empty / loading / error placeholder used inside sections.
 *
 * Renders a centred card with optional icon, title and subtitle. When
 * `loading` is true it shows a spinner instead of the icon — this matches
 * the pattern used in both responder dashboards ("Loading emergencies…",
 * "No active emergencies", "Failed to load…").
 */

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { tokens } from "../../src/ui/tokens";

type Props = {
  icon?: string;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  tone?: "default" | "danger";
};

export default function EmptyState({
  icon,
  title,
  subtitle,
  loading,
  tone = "default",
}: Props) {
  return (
    <View style={styles.card}>
      {loading ? (
        <ActivityIndicator
          color={tone === "danger" ? tokens.color.danger : tokens.color.textMuted}
          size="small"
        />
      ) : icon ? (
        <Text style={styles.icon}>{icon}</Text>
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
    borderRadius: tokens.radius.lg,
    paddingVertical: tokens.space.xl,
    paddingHorizontal: tokens.space.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    alignItems: "center",
    gap: tokens.space.sm,
  },
  icon: { fontSize: 28 },
  title: {
    fontSize: tokens.font.label,
    fontWeight: "800",
    color: tokens.color.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: tokens.font.body,
    color: tokens.color.textMuted,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
});
