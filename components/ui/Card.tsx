/**
 * Universal surface card — calm white, hairline border, optional accent stripe.
 */

import React from "react";
import { StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { cardShadow, tokens } from "../../src/ui/tokens";

export type CardTone = "default" | "subtle" | "accent" | "danger";

export type CardProps = ViewProps & {
  tone?: CardTone;
  compact?: boolean;
  /** Coloured start-edge stripe (RTL-aware) */
  accentStart?: boolean | string;
  /** @deprecated Use accentStart */
  accentLeft?: boolean | string;
  accentTop?: boolean | string;
  elevated?: boolean;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
};

const ACCENT = 3;

export default function Card({
  tone = "default",
  compact,
  accentStart,
  accentLeft,
  accentTop,
  elevated,
  style,
  children,
  ...rest
}: CardProps) {
  const stripe = accentStart ?? accentLeft;
  const startColor =
    typeof stripe === "string"
      ? stripe
      : tone === "danger"
        ? tokens.color.danger
        : tokens.color.primary;

  return (
    <View
      style={[
        styles.base,
        compact ? styles.compactPad : styles.padded,
        tone === "accent" && styles.accent,
        tone === "danger" && styles.danger,
        tone === "subtle" && styles.subtle,
        stripe
          ? {
              borderStartWidth: ACCENT,
              borderStartColor: startColor,
            }
          : null,
        accentTop
          ? { borderTopWidth: ACCENT, borderTopColor: startColor }
          : null,
        elevated && cardShadow,
        style as ViewStyle,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.xl,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    ...cardShadow,
  },
  padded: { padding: tokens.space.xl },
  compactPad: { padding: tokens.space.lg },
  accent: {
    backgroundColor: tokens.color.primarySurface,
    borderColor: tokens.color.primaryBorder,
  },
  danger: {
    backgroundColor: tokens.color.dangerSurface,
    borderColor: tokens.color.dangerBorder,
  },
  subtle: { backgroundColor: tokens.color.bgSubtle },
});
