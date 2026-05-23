/**
 * Calm top title block for tab root screens (no back button).
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { textStyles, tokens } from "../../src/ui/tokens";
import { useUiDirection } from "./layout";

export type AppPageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  showBrandIcon?: boolean;
};

export default function AppPageHeader({
  title,
  subtitle,
  eyebrow,
  showBrandIcon = true,
}: AppPageHeaderProps) {
  const insets = useSafeAreaInsets();
  const { textAlign } = useUiDirection();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + tokens.space.md }]}>
      {showBrandIcon ? (
        <View style={styles.iconBadge}>
          <Ionicons name="medkit" size={28} color={tokens.color.primary} />
        </View>
      ) : null}
      {eyebrow ? (
        <Text style={[styles.eyebrow, { textAlign }]}>{eyebrow}</Text>
      ) : null}
      <Text style={[styles.title, { textAlign }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { textAlign }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.lg,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.primaryBg,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.space.md,
  },
  eyebrow: {
    ...textStyles.overline,
    marginBottom: tokens.space.xs,
  },
  title: {
    ...textStyles.h1,
    textAlign: "center",
  },
  subtitle: {
    ...textStyles.body,
    textAlign: "center",
    marginTop: tokens.space.sm,
    maxWidth: 320,
  },
});
