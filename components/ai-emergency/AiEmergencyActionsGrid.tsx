import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";
import { useUiDirection } from "../ui/layout";
import { GlassSurface } from "./primitives";
import { AI_RADIUS, aiEmergencyTheme } from "./theme";

export type EmergencyAction = {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: string;
  onPress: () => void;
  wide?: boolean;
};

export default function AiEmergencyActionsGrid({
  title,
  actions,
  style,
}: {
  title: string;
  actions: EmergencyAction[];
  style?: ViewStyle;
}) {
  const { row, marginHorizontal } = useUiDirection();

  return (
    <View style={[styles.section, style]}>
      <Text style={[styles.sectionTitle, marginHorizontal(tokens.space.xs, 0)]}>
        {title}
      </Text>
      <View style={[styles.grid, row]}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.cell,
              action.wide && styles.cellWide,
              pressed && styles.cellPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={action.title}
          >
            <GlassSurface radius={AI_RADIUS.card} style={styles.cardFill}>
              <View style={styles.cardInner}>
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: `${action.accent ?? aiEmergencyTheme.primary}18`,
                      borderColor: `${action.accent ?? aiEmergencyTheme.primary}30`,
                    },
                  ]}
                >
                  <Ionicons
                    name={action.icon}
                    size={22}
                    color={action.accent ?? aiEmergencyTheme.primary}
                  />
                </View>
                <Text style={styles.actionTitle} numberOfLines={2}>
                  {action.title}
                </Text>
                {action.subtitle ? (
                  <Text style={styles.actionSub} numberOfLines={2}>
                    {action.subtitle}
                  </Text>
                ) : null}
              </View>
            </GlassSurface>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: tokens.space.lg,
  },
  sectionTitle: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.bold,
    color: tokens.color.textFaint,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: tokens.space.md,
  },
  grid: {
    flexWrap: "wrap",
    gap: tokens.space.md,
  },
  cell: {
    width: "47.5%",
    minWidth: 140,
  },
  cellWide: {
    width: "100%",
  },
  cellPressed: {
    transform: [{ scale: 0.98 }],
  },
  cardFill: {
    flex: 1,
  },
  cardInner: {
    padding: tokens.space.lg,
    minHeight: 108,
    justifyContent: "flex-start",
    gap: tokens.space.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  actionTitle: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    lineHeight: 20,
  },
  actionSub: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
    lineHeight: 16,
  },
});
