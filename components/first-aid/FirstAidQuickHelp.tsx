import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useUiDirection } from "../ui/layout";
import { tokens } from "../../src/ui/tokens";
import { firstAidTheme } from "./theme";

export type QuickHelpAction = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  urgent?: boolean;
};

/** Horizontal pill row — labels only, thumb-friendly (hub). */
export default function FirstAidQuickHelp({
  actions,
  lang,
}: {
  actions: QuickHelpAction[];
  lang: string;
}) {
  const { row, text } = useUiDirection();

  return (
    <View style={styles.section}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, row]}
      >
        {actions.map((action) => (
          <Pressable
            key={action.id}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.pill,
              row,
              action.urgent && styles.pillUrgent,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Ionicons
              name={action.icon}
              size={18}
              color={action.urgent ? tokens.color.danger : firstAidTheme.primary}
            />
            <Text
              style={[
                styles.pillLabel,
                text,
                action.urgent && styles.pillLabelUrgent,
              ]}
              numberOfLines={1}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: tokens.space.xxl,
  },
  scroll: {
    gap: tokens.space.sm,
    paddingVertical: 2,
  },
  pill: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: tokens.space.lg,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1,
    borderColor: firstAidTheme.glassBorder,
  },
  pillUrgent: {
    borderColor: "rgba(220, 38, 38, 0.28)",
    backgroundColor: tokens.color.dangerBg,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  pillLabel: {
    fontSize: tokens.font.body,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
  },
  pillLabelUrgent: {
    color: tokens.color.dangerDark,
  },
});
