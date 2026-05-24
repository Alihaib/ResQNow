/**
 * Unified action button — medical blue primary, red danger only for SOS/destructive.
 */

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { tokens } from "../../src/ui/tokens";

export type ButtonVariant =
  | "danger"
  | "primary"
  | "secondary"
  | "ghost"
  | "neutralDark";
export type ButtonSize = "compact" | "md" | "lg";

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
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
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const sizeStyle = SIZE_STYLES[size];
  const variantStyles = VARIANT_STYLES[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.base,
        sizeStyle.container,
        variantStyles.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.label.color} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            sizeStyle.label,
            variantStyles.label,
          ]}
          numberOfLines={1}
        >
          {icon ? `${icon}  ` : ""}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Primary (medical blue) — default CTAs */
export function PrimaryButton(props: Omit<ButtonProps, "variant">) {
  return <Button {...props} variant="primary" />;
}

/** Danger (red) — SOS, cancel emergency, destructive */
export function DangerButton(props: Omit<ButtonProps, "variant">) {
  return <Button {...props} variant="danger" />;
}

const VARIANT_STYLES: Record<
  ButtonVariant,
  { container: ViewStyle; label: { color: string } }
> = {
  danger: {
    container: { backgroundColor: tokens.color.danger },
    label: { color: tokens.color.textOnDanger },
  },
  primary: {
    container: { backgroundColor: tokens.color.primary },
    label: { color: tokens.color.textOnPrimary },
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
    label: { color: tokens.color.textOnPrimary },
  },
};

const SIZE_STYLES: Record<
  ButtonSize,
  { container: ViewStyle; label: { fontSize: number } }
> = {
  compact: {
    container: {
      paddingVertical: tokens.space.sm,
      paddingHorizontal: tokens.space.md,
      minHeight: 36,
      borderRadius: tokens.radius.md,
    },
    label: { fontSize: tokens.font.body },
  },
  md: {
    container: {
      paddingVertical: tokens.space.md,
      paddingHorizontal: tokens.space.lg,
      minHeight: tokens.hitSlop,
      borderRadius: tokens.radius.lg,
    },
    label: { fontSize: tokens.font.label },
  },
  lg: {
    container: {
      paddingVertical: tokens.space.lg,
      paddingHorizontal: tokens.space.lg,
      minHeight: 56,
      borderRadius: tokens.radius.xl,
    },
    label: { fontSize: tokens.font.title },
  },
};

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.94,
  },
  fullWidth: { alignSelf: "stretch", width: "100%" },
  disabled: { opacity: 0.5 },
  label: {
    fontWeight: tokens.fontWeight.semibold,
    letterSpacing: 0.15,
    textAlign: "center",
  },
});
