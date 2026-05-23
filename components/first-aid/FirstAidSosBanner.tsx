import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useUiDirection } from "../ui/layout";
import { GlassSurface } from "../ai-emergency";
import { tokens } from "../../src/ui/tokens";
import { firstAidTheme } from "./theme";

/** Compact SOS context — one urgent line + single action (hub only). */
export default function FirstAidSosBanner({
  message,
  actionLabel,
  onAction,
  lang,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  lang: string;
}) {
  const { row, textAlign, text, chevronIcon } = useUiDirection();

  return (
    <GlassSurface radius={firstAidTheme.radius} style={styles.wrap}>
      <View style={[styles.row, row]}>
        <View style={styles.urgentStripe} />
        <Text style={[styles.message, { textAlign }]} numberOfLines={2}>
          {message}
        </Text>
      </View>
      <Pressable
        onPress={onAction}
        style={({ pressed }) => [styles.btn, row, pressed && styles.btnPressed]}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={[styles.btnText, text]}>{actionLabel}</Text>
        <Ionicons
          name={chevronIcon("forward")}
          size={18}
          color={tokens.color.dangerDark}
        />
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: tokens.space.xl,
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.22)",
    overflow: "hidden",
  },
  row: {
    alignItems: "stretch",
    paddingTop: tokens.space.md,
    paddingEnd: tokens.space.lg,
    paddingStart: 0,
    gap: tokens.space.md,
  },
  urgentStripe: {
    width: 4,
    backgroundColor: tokens.color.danger,
    borderTopEndRadius: 2,
    borderBottomEndRadius: 2,
  },
  message: {
    flex: 1,
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.dangerDark,
    lineHeight: 22,
    paddingBottom: tokens.space.sm,
  },
  btn: {
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space.xs,
    marginHorizontal: tokens.space.lg,
    marginBottom: tokens.space.md,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.dangerBg,
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.25)",
    minHeight: 48,
  },
  btnPressed: {
    opacity: 0.9,
  },
  btnText: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.dangerDark,
  },
});
