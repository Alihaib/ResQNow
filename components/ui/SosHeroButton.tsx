/**
 * Large circular SOS / emergency hero control — red for new SOS, blue when active.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { elevatedShadow, tokens } from "../../src/ui/tokens";

export type SosHeroSize = "large" | "hero";

export type SosHeroButtonProps = {
  label: string;
  sublabel?: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** When true, user is in an active emergency — calm blue ring, not red */
  activeEmergency?: boolean;
  size?: SosHeroSize;
  style?: ViewStyle;
};

const SIZES: Record<SosHeroSize, { outer: number; inner: number; icon: number }> = {
  large: { outer: 168, inner: 148, icon: 52 },
  hero: { outer: 220, inner: 196, icon: 64 },
};

export default function SosHeroButton({
  label,
  sublabel,
  onPress,
  disabled,
  busy,
  activeEmergency,
  size = "hero",
  style,
}: SosHeroButtonProps) {
  const dim = SIZES[size];
  const ringColor = activeEmergency ? tokens.color.primary : tokens.color.danger;
  const fillColor = activeEmergency ? tokens.color.primary : tokens.color.danger;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.stack,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.outerRing,
          {
            width: dim.outer,
            height: dim.outer,
            borderRadius: dim.outer / 2,
            borderColor: ringColor,
          },
          elevatedShadow,
        ]}
      >
        <View
          style={[
            styles.inner,
            {
              width: dim.inner,
              height: dim.inner,
              borderRadius: dim.inner / 2,
              backgroundColor: fillColor,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={tokens.color.textOnDanger} size="large" />
          ) : (
            <Ionicons
              name={activeEmergency ? "pulse" : "warning"}
              size={dim.icon}
              color={tokens.color.textOnDanger}
            />
          )}
        </View>
      </View>
      <Text style={styles.label}>{label}</Text>
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    alignItems: "center",
    gap: tokens.space.md,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  outerRing: {
    backgroundColor: tokens.color.bgSurface,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: tokens.font.h2,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  sublabel: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
});
