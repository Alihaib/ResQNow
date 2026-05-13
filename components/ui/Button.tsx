/**
 * Unified action button with a consistent visual hierarchy.
 *
 * Variants (highest → lowest visual weight):
 *  - "danger"     : red, used for the most urgent action (SOS, "Call ambulance").
 *  - "primary"    : dark, used for "navigate", "open", confirmations.
 *  - "secondary"  : white with border, used for non-destructive actions.
 *  - "ghost"      : transparent, used inside cards / overlays.
 *  - "neutralDark": slate grey, used for non-destructive actions that
 *                   are still "I'm sure" — e.g. End emergency.
 *
 * Sizes:
 *  - "md" (default) — 44px tall, comfortable tap target on every device.
 *  - "lg"           — 56px tall, used as the primary screen action.
 *
 * Loading and disabled states are mutually exclusive: when `loading` is
 * true the button is automatically disabled and shows a spinner.
 */

import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { tokens } from "../../src/ui/tokens";

type Variant = "danger" | "primary" | "secondary" | "ghost" | "neutralDark";
type Size = "md" | "lg";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  fullWidth?: boolean;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
};

export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  icon,
  fullWidth,
  style,
  accessibilityLabel,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.base,
        size === "lg" ? styles.sizeLg : styles.sizeMd,
        VARIANT_STYLES[variant].container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={VARIANT_STYLES[variant].label.color}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            size === "lg" ? styles.labelLg : styles.labelMd,
            VARIANT_STYLES[variant].label,
          ]}
          numberOfLines={1}
        >
          {icon ? `${icon}  ` : ""}
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const VARIANT_STYLES: Record<
  Variant,
  { container: ViewStyle; label: { color: string } }
> = {
  danger: {
    container: { backgroundColor: tokens.color.danger },
    label: { color: tokens.color.textOnDanger },
  },
  primary: {
    container: { backgroundColor: tokens.color.primarySolid },
    label: { color: "#FFFFFF" },
  },
  secondary: {
    container: {
      backgroundColor: tokens.color.bgSurface,
      borderWidth: 1.5,
      borderColor: tokens.color.border,
    },
    label: { color: tokens.color.textPrimary },
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    label: { color: tokens.color.textSecondary },
  },
  neutralDark: {
    container: { backgroundColor: "#475569" },
    label: { color: "#FFFFFF" },
  },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space.lg,
    minHeight: tokens.hitSlop,
  },
  sizeMd: {
    paddingVertical: tokens.space.md,
    minHeight: tokens.hitSlop,
  },
  sizeLg: {
    paddingVertical: tokens.space.lg,
    minHeight: 56,
    borderRadius: tokens.radius.lg,
  },
  fullWidth: { alignSelf: "stretch", width: "100%" },
  disabled: { opacity: 0.55 },
  label: {
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  labelMd: { fontSize: tokens.font.label },
  labelLg: { fontSize: tokens.font.title },
});
