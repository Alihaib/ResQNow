/**
 * Shortcut row card — icon + title + subtitle + trailing.
 *
 * This is the operational shortcut pattern used everywhere:
 *  - Doctor dashboard: "View Active Emergencies", "Search Patient"…
 *  - Ambulance dashboard: "Current Mission", "Start Navigation"…
 *  - SOS screen: "Medical Guides", "Medical Profile"…
 *  - Active emergency screen: "AI Triage Assistant", "Share Medical Profile"…
 *
 * Centralising it means every shortcut everywhere has identical touch
 * target size, padding, typography, chevron and emphasis styling.
 *
 * Visual weight is deliberately restrained — shortcuts are secondary
 * affordances, never the primary action on a screen.
 */

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";

type Props = {
  /** Leading emoji / glyph (kept as text — no icon library). */
  icon?: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  /** Element shown at the right (chip, badge…). When absent, a chevron is rendered. */
  trailing?: React.ReactNode;
  /** Emphasis variant: "primary" promotes the row when it represents the
   *  user's active mission / case. Use sparingly — at most one per screen. */
  emphasis?: "default" | "primary";
  /** Optional override style — keep usage rare; layout is opinionated for a reason. */
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
};

export default function ShortcutCard({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
  emphasis = "default",
  style,
  accessibilityLabel,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[
        styles.card,
        emphasis === "primary" && styles.cardPrimary,
        style as ViewStyle,
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
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
      {trailing ?? <Text style={styles.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: tokens.space.sm,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    gap: tokens.space.md,
    minHeight: 60,
  },
  cardPrimary: {
    backgroundColor: tokens.color.dangerSurface,
    borderColor: tokens.color.dangerBorder,
    borderLeftWidth: 3,
    borderLeftColor: tokens.color.danger,
  },
  icon: { fontSize: 22 },
  content: { flex: 1 },
  title: {
    fontSize: tokens.font.label,
    fontWeight: "800",
    color: tokens.color.textPrimary,
  },
  subtitle: {
    fontSize: tokens.font.caption,
    color: tokens.color.textMuted,
    marginTop: 2,
    fontWeight: "600",
  },
  chevron: {
    fontSize: 22,
    color: tokens.color.textFaint,
    fontWeight: "700",
  },
});
