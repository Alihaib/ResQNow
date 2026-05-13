/**
 * Unified action button with a consistent visual hierarchy.
 *
 * Variants (highest → lowest visual weight):
 *  - "danger"      : red, used for the most urgent action (SOS, emergency).
 *  - "primary"     : near-black slate, used for "navigate", "open", confirms.
 *  - "secondary"   : white with a hairline border, used for non-destructive.
 *  - "ghost"       : transparent, used inside cards / overlays.
 *  - "neutralDark" : muted slate, for "I'm sure" non-destructive actions
 *                    such as End emergency.
 *
 * Sizes:
 *  - "compact" — 36pt min height, used inline (inside cards) for tertiary
 *                actions like "Navigate" on an emergency card. NOT a tap
 *                target for primary screen actions.
 *  - "md"      — 44pt min height, the default for most actions.
 *  - "lg"      — 56pt min height, used as the primary screen action.
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
type Size = "compact" | "md" | "lg";

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
  const sizeStyle = SIZE_STYLES[size];
  const variantStyles = VARIANT_STYLES[variant];
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
        sizeStyle.container,
        variantStyles.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.label.color} size="small" />
      ) : (
        <Text
          style={[styles.label, sizeStyle.label, variantStyles.label]}
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
      borderWidth: tokens.hairline,
      borderColor: tokens.color.border,
    },
    label: { color: tokens.color.textPrimary },
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    label: { color: tokens.color.textSecondary },
  },
  neutralDark: {
    container: { backgroundColor: tokens.color.slate },
    label: { color: "#FFFFFF" },
  },
};

const SIZE_STYLES: Record<
  Size,
  { container: ViewStyle; label: { fontSize: number } }
> = {
  compact: {
    container: {
      paddingVertical: tokens.space.sm,
      paddingHorizontal: tokens.space.md,
      minHeight: 36,
      borderRadius: tokens.radius.sm,
    },
    label: { fontSize: tokens.font.body },
  },
  md: {
    container: {
      paddingVertical: tokens.space.md,
      paddingHorizontal: tokens.space.lg,
      minHeight: tokens.hitSlop,
      borderRadius: tokens.radius.md,
    },
    label: { fontSize: tokens.font.label },
  },
  lg: {
    container: {
      paddingVertical: tokens.space.lg,
      paddingHorizontal: tokens.space.lg,
      minHeight: 56,
      borderRadius: tokens.radius.lg,
    },
    label: { fontSize: tokens.font.title },
  },
};

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: { alignSelf: "stretch", width: "100%" },
  disabled: { opacity: 0.55 },
  label: {
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "center",
  },
});
