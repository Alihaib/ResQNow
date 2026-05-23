import { StyleSheet, Text, View } from "react-native";
import { useUiDirection } from "../ui/layout";
import StatusChip, { type StatusChipVariant } from "../ui/StatusChip";
import { tokens } from "../../src/ui/tokens";
import { AiOrb } from "./primitives";
import { AI_RADIUS, aiEmergencyTheme } from "./theme";
import BlurredBar from "../ui/BlurredBar";

export default function AiFloatingHeader({
  statusLabel,
  chipVariant,
  aiActive,
  subtitle,
}: {
  statusLabel: string;
  chipVariant: StatusChipVariant;
  aiActive: boolean;
  subtitle?: string;
}) {
  const { row, textAlign } = useUiDirection();

  return (
    <BlurredBar style={styles.bar} intensity={80}>
      <View style={[styles.inner, row]}>
        <View style={[styles.brandRow, row]}>
          <View style={styles.brandMark}>
            <Text style={styles.brandLetter}>R</Text>
          </View>
          <View style={styles.brandTextCol}>
            <Text style={[styles.brandTitle, { textAlign }]}>ResQNow</Text>
            <Text style={[styles.brandSub, { textAlign }]} numberOfLines={1}>
              {subtitle ?? "AI Emergency Command"}
            </Text>
          </View>
        </View>

        <View style={styles.statusCol}>
          <View style={[styles.aiLiveRow, row]}>
            <View style={[styles.liveDot, aiActive && styles.liveDotOn]} />
            <Text style={styles.liveLabel}>
              {aiActive ? "AI Active" : "AI Ready"}
            </Text>
            <AiOrb size={36} active={aiActive} listening={false} />
          </View>
          <StatusChip label={statusLabel} variant={chipVariant} />
        </View>
      </View>
    </BlurredBar>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: AI_RADIUS.card,
    marginBottom: tokens.space.md,
    borderWidth: 1,
    borderColor: aiEmergencyTheme.glassBorder,
    overflow: "hidden",
  },
  inner: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    gap: tokens.space.md,
  },
  brandRow: {
    alignItems: "center",
    gap: tokens.space.sm,
    flex: 1,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: tokens.color.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.color.primaryBorder,
  },
  brandLetter: {
    fontSize: 18,
    fontWeight: tokens.fontWeight.heavy,
    color: aiEmergencyTheme.primary,
  },
  brandTextCol: { flex: 1 },
  brandTitle: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    letterSpacing: -0.2,
  },
  brandSub: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
    marginTop: 1,
  },
  statusCol: {
    alignItems: "flex-end",
    gap: tokens.space.xs,
  },
  aiLiveRow: {
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.color.textFaint,
  },
  liveDotOn: {
    backgroundColor: aiEmergencyTheme.primary,
    shadowColor: aiEmergencyTheme.primary,
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  liveLabel: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.semibold,
    color: aiEmergencyTheme.primary,
  },
});
