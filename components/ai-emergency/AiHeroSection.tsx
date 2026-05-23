import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { tokens, textStyles } from "../../src/ui/tokens";
import { useUiDirection } from "../ui/layout";
import { AiOrb, GlassSurface } from "./primitives";
import { AI_RADIUS, aiEmergencyTheme } from "./theme";

export type HeroChip = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export default function AiHeroSection({
  statusLine,
  subtitle,
  etaMinutes,
  etaLabel,
  etaUnit,
  responderLine,
  chips,
  aiListening,
  style,
}: {
  statusLine: string;
  subtitle?: string;
  etaMinutes: number | null;
  etaLabel: string;
  etaUnit: string;
  responderLine?: string | null;
  chips: HeroChip[];
  aiListening?: boolean;
  style?: ViewStyle;
}) {
  const { row } = useUiDirection();

  return (
    <GlassSurface style={[styles.wrap, style]} radius={AI_RADIUS.sheet}>
      <View style={styles.heroInner}>
        <AiOrb size={108} active={true} listening={aiListening} />

        <Text style={styles.statusHero} numberOfLines={2}>
          {statusLine}
        </Text>
        {subtitle ? (
          <Text style={styles.statusSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}

        {etaMinutes != null ? (
          <View style={styles.etaCard}>
            <Text style={styles.etaKicker}>{etaLabel}</Text>
            <View style={[styles.etaRow, row]}>
              <Text style={styles.etaValue}>{Math.max(0, Math.round(etaMinutes))}</Text>
              <Text style={styles.etaUnit}>{etaUnit}</Text>
            </View>
            {responderLine ? (
              <Text style={styles.responderLine} numberOfLines={2}>
                {responderLine}
              </Text>
            ) : null}
          </View>
        ) : responderLine ? (
          <View style={[styles.responderOnly, row]}>
            <Ionicons name="medkit-outline" size={18} color={aiEmergencyTheme.primary} />
            <Text style={styles.responderLine}>{responderLine}</Text>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
        >
          {chips.map((chip) => (
            <Pressable
              key={chip.id}
              onPress={chip.onPress}
              style={({ pressed }) => [
                styles.chip,
                row,
                pressed && styles.chipPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={chip.label}
            >
              <Ionicons name={chip.icon} size={16} color={aiEmergencyTheme.primary} />
              <Text style={styles.chipLabel}>{chip.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: tokens.space.lg,
  },
  heroInner: {
    alignItems: "center",
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.xl,
    gap: tokens.space.sm,
  },
  statusHero: {
    ...textStyles.h2,
    textAlign: "center",
    marginTop: tokens.space.sm,
    fontSize: tokens.font.h2,
  },
  statusSub: {
    ...textStyles.body,
    textAlign: "center",
    fontSize: tokens.font.bodyLg,
    paddingHorizontal: tokens.space.md,
  },
  etaCard: {
    width: "100%",
    marginTop: tokens.space.md,
    padding: tokens.space.lg,
    borderRadius: AI_RADIUS.card,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.15)",
    alignItems: "center",
  },
  etaKicker: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.bold,
    color: aiEmergencyTheme.primary,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: tokens.space.xs,
  },
  etaRow: {
    alignItems: "flex-end",
    gap: tokens.space.xs,
  },
  etaValue: {
    ...textStyles.eta,
    fontSize: 48,
    color: aiEmergencyTheme.primary,
  },
  etaUnit: {
    fontSize: tokens.font.title,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textSecondary,
    marginBottom: 8,
  },
  responderOnly: {
    alignItems: "center",
    gap: tokens.space.sm,
    marginTop: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
  },
  responderLine: {
    flex: 1,
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  chipScroll: {
    gap: tokens.space.sm,
    paddingTop: tokens.space.md,
    paddingHorizontal: tokens.space.xs,
  },
  chip: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: AI_RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: aiEmergencyTheme.glassBorder,
  },
  chipPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  chipLabel: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
  },
});
