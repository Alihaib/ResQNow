/**
 * Full-width binary (or ternary) choice for high-stakes decisions (e.g. SOS victim type).
 */

import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";

export type DecisionOption = {
  id: string;
  label: string;
  /** danger = red (rare); primary = blue default */
  variant?: "primary" | "secondary" | "danger";
};

export type EmergencyDecisionCardProps = {
  title: string;
  hint?: string;
  options: DecisionOption[];
  onSelect: (id: string) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  style?: ViewStyle;
};

export default function EmergencyDecisionCard({
  title,
  hint,
  options,
  onSelect,
  onCancel,
  cancelLabel,
  style,
}: EmergencyDecisionCardProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.options}>
        {options.map((opt) => {
          const variant = opt.variant ?? "primary";
          const btnStyle =
            variant === "danger"
              ? styles.btnDanger
              : variant === "secondary"
                ? styles.btnSecondary
                : styles.btnPrimary;
          const textStyle =
            variant === "secondary" ? styles.btnTextSecondary : styles.btnTextOnFill;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.btn, btnStyle]}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.btnText, textStyle]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {onCancel && cancelLabel ? (
        <TouchableOpacity
          onPress={onCancel}
          style={styles.cancelBtn}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        >
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.bgPage,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.huge,
    justifyContent: "center",
  },
  title: {
    fontSize: tokens.font.h1,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    textAlign: "center",
    marginBottom: tokens.space.sm,
  },
  hint: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textMuted,
    textAlign: "center",
    marginBottom: tokens.space.xl,
    lineHeight: 22,
  },
  options: { gap: tokens.space.md },
  btn: {
    paddingVertical: tokens.space.lg,
    borderRadius: tokens.radius.lg,
    alignItems: "center",
    minHeight: 56,
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: tokens.color.primary },
  btnSecondary: {
    backgroundColor: tokens.color.bgSurface,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
  },
  btnDanger: { backgroundColor: tokens.color.danger },
  btnText: {
    fontSize: tokens.font.title,
    fontWeight: tokens.fontWeight.bold,
  },
  btnTextOnFill: { color: tokens.color.textOnPrimary },
  btnTextSecondary: { color: tokens.color.textPrimary },
  cancelBtn: {
    marginTop: tokens.space.xl,
    paddingVertical: tokens.space.md,
    alignItems: "center",
  },
  cancelText: {
    fontSize: tokens.font.label,
    color: tokens.color.textMuted,
    fontWeight: tokens.fontWeight.semibold,
  },
});
