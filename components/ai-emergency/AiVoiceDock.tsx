import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "../../src/ui/tokens";
import { useUiDirection } from "../ui/layout";
import { AiOrb, GlassSurface, VoiceWaveform } from "./primitives";
import { AI_RADIUS, aiEmergencyTheme } from "./theme";

export default function AiVoiceDock({
  onMicPress,
  onOpenAi,
  listening,
  hint,
  micLabel,
}: {
  onMicPress: () => void;
  onOpenAi?: () => void;
  listening?: boolean;
  hint: string;
  micLabel: string;
}) {
  const insets = useSafeAreaInsets();
  const { row } = useUiDirection();

  return (
    <View style={[styles.dockWrap, { paddingBottom: Math.max(insets.bottom, tokens.space.md) }]}>
      <GlassSurface radius={AI_RADIUS.dock} style={styles.dock}>
        <View style={[styles.dockInner, row]}>
          <View style={styles.hintCol}>
            <VoiceWaveform active={listening} compact />
            <Text style={styles.hintText} numberOfLines={1}>
              {listening ? "AI is listening…" : hint}
            </Text>
          </View>

          <Pressable
            onPress={onMicPress}
            style={({ pressed }) => [styles.micBtn, pressed && styles.micPressed]}
            accessibilityRole="button"
            accessibilityLabel={micLabel}
          >
            <AiOrb size={56} active listening={listening} />
          </Pressable>

          {onOpenAi ? (
            <Pressable
              onPress={onOpenAi}
              style={({ pressed }) => [styles.aiPill, pressed && styles.chipPressed]}
              accessibilityRole="button"
              accessibilityLabel="Open AI assistant"
            >
              <Ionicons name="sparkles" size={18} color={aiEmergencyTheme.primary} />
            </Pressable>
          ) : null}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  dockWrap: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.sm,
  },
  dock: {
    borderWidth: 1,
    borderColor: aiEmergencyTheme.glassBorder,
  },
  dockInner: {
    alignItems: "center",
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    gap: tokens.space.md,
  },
  hintCol: {
    flex: 1,
    gap: tokens.space.xs,
  },
  hintText: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textMuted,
  },
  micBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  micPressed: {
    transform: [{ scale: 0.96 }],
  },
  aiPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  chipPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
});
