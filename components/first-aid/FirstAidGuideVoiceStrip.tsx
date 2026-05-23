import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { VoiceWaveform } from "../ai-emergency";
import { getFlexDirection, isRTL, textAlignStyle } from "../../src/utils/rtl";
import { tokens } from "../../src/ui/tokens";
import { firstAidTheme } from "./theme";
import {
  GUIDE_VOICE_HEIGHT,
  GUIDE_VOICE_HEIGHT_COMPACT,
} from "./guideLayout";

export default function FirstAidGuideVoiceStrip({
  onPlay,
  onStop,
  autoPlay,
  onAutoPlayChange,
  lang,
  playLabel,
  stopLabel,
  autoLabel,
  compact = false,
}: {
  onPlay: () => void;
  onStop: () => void;
  autoPlay: boolean;
  onAutoPlayChange: (v: boolean) => void;
  lang: string;
  playLabel: string;
  stopLabel: string;
  autoLabel: string;
  compact?: boolean;
}) {
  const rowDir = getFlexDirection(lang);
  const rtl = isRTL(lang);
  const shellHeight = compact ? GUIDE_VOICE_HEIGHT_COMPACT : GUIDE_VOICE_HEIGHT;

  return (
    <View style={[styles.shell, { height: shellHeight }]}>
      <View style={[styles.strip, { flexDirection: rowDir }]}>
        <Pressable
          onPress={onPlay}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={playLabel}
        >
          <Ionicons name="play" size={compact ? 16 : 18} color={firstAidTheme.primary} />
        </Pressable>
        <Pressable
          onPress={onStop}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={stopLabel}
        >
          <Ionicons name="stop" size={compact ? 16 : 18} color={tokens.color.textMuted} />
        </Pressable>
        <View style={[styles.autoRow, { flexDirection: rowDir }]}>
          <Text style={[styles.autoLabel, textAlignStyle(lang)]}>{autoLabel}</Text>
          <Switch
            value={autoPlay}
            onValueChange={onAutoPlayChange}
            trackColor={{
              true: firstAidTheme.primary,
              false: tokens.color.border,
            }}
            style={styles.switch}
          />
        </View>
        {autoPlay ? (
          <View
            style={[styles.waveOverlay, rtl ? styles.waveOverlayRtl : styles.waveOverlayLtr]}
            pointerEvents="none"
          >
            <VoiceWaveform active compact />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexShrink: 0,
  },
  strip: {
    flex: 1,
    alignItems: "center",
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.lg,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
    position: "relative",
    overflow: "hidden",
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.85 },
  autoRow: {
    alignItems: "center",
    gap: 4,
    marginStart: "auto",
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  autoLabel: {
    fontSize: 10,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textFaint,
  },
  waveOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "center",
    opacity: 0.45,
    maxWidth: 64,
  },
  waveOverlayLtr: {
    right: 12,
  },
  waveOverlayRtl: {
    left: 12,
  },
});
