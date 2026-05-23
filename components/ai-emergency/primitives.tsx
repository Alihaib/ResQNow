import { BlurView } from "expo-blur";
import { useEffect } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import MapView from "react-native-maps";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useUiDirection } from "../ui/layout";
import { tokens } from "../../src/ui/tokens";
import { AI_RADIUS, aiEmergencyTheme, glassCardShadow } from "./theme";

/* -------------------------------------------------------------------------- */
/* Glass surface                                                              */
/* -------------------------------------------------------------------------- */

export function GlassSurface({
  children,
  style,
  radius = AI_RADIUS.card,
  noBorder,
  fill,
}: {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  noBorder?: boolean;
  /** Stretch inner content to fill the surface (for flex layouts). */
  fill?: boolean;
}) {
  return (
    <View
      style={[
        styles.glassShell,
        glassCardShadow,
        { borderRadius: radius },
        !noBorder && styles.glassBorder,
        fill && styles.glassShellFill,
        style,
      ]}
    >
      {Platform.OS === "android" ? (
        <View style={[styles.androidFrost, { borderRadius: radius }]} />
      ) : (
        <BlurView
          intensity={64}
          tint="light"
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      )}
      <View style={[styles.glassTint, { borderRadius: radius }]} />
      <View style={[styles.glassContent, fill && styles.glassContentFill]}>
        {children}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* AI orb + pulse rings                                                       */
/* -------------------------------------------------------------------------- */

export function AiOrb({
  size = 120,
  active = false,
  listening = false,
}: {
  size?: number;
  active?: boolean;
  listening?: boolean;
}) {
  const breathe = useSharedValue(1);
  const ring = useSharedValue(0.85);

  useEffect(() => {
    const dur = tokens.motion.slow;
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: dur, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    ring.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: dur + 80, easing: Easing.out(Easing.ease) }),
        withTiming(0.9, { duration: dur, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [breathe, ring]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: active || listening ? breathe.value : 1 }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ring.value }],
    opacity: listening ? 0.55 : active ? 0.35 : 0.2,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring.value * 1.12 }],
    opacity: listening ? 0.3 : 0.12,
  }));

  return (
    <View style={[styles.orbWrap, { width: size * 1.5, height: size * 1.5 }]}>
      <Animated.View
        style={[
          styles.pulseRing,
          ringStyle,
          {
            width: size * 1.35,
            height: size * 1.35,
            borderRadius: size * 0.675,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.pulseRing,
          ring2Style,
          {
            width: size * 1.55,
            height: size * 1.55,
            borderRadius: size * 0.775,
            borderColor: aiEmergencyTheme.primarySoft,
          },
        ]}
      />
      <Animated.View style={[orbStyle, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.orbCore, { width: size, height: size, borderRadius: size / 2 }]}>
          <View
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: size / 2, backgroundColor: aiEmergencyTheme.primary },
            ]}
          />
          <View style={[styles.orbGradientTop, { borderRadius: size / 2 }]} />
          <View style={styles.orbHighlight} />
          <View style={styles.orbInnerDot} />
        </View>
      </Animated.View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Voice waveform                                                           */
/* -------------------------------------------------------------------------- */

const BAR_COUNT = 5;

function WaveBar({ index, active }: { index: number; active: boolean }) {
  const h = useSharedValue(6);

  useEffect(() => {
    if (!active) {
      h.value = withTiming(6, { duration: tokens.motion.fast });
      return;
    }
    const delay = index * 40;
    const loop = () =>
      withSequence(
        withTiming(14 + (index % 3) * 6, { duration: 160 + delay, easing: Easing.inOut(Easing.ease) }),
        withTiming(5, { duration: 140, easing: Easing.inOut(Easing.ease) }),
      );
    h.value = withRepeat(loop(), -1, false);
  }, [active, h, index]);

  const barStyle = useAnimatedStyle(() => ({
    height: h.value,
  }));

  return <Animated.View style={[styles.waveBar, barStyle]} />;
}

export function VoiceWaveform({
  active = false,
  compact,
}: {
  active?: boolean;
  compact?: boolean;
}) {
  const { row } = useUiDirection();
  return (
    <View style={[styles.waveRow, row, compact && styles.waveRowCompact]}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <WaveBar key={i} index={i} active={active} />
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Ambient map background                                                     */
/* -------------------------------------------------------------------------- */

type MapAnchor = { latitude: number; longitude: number };

export function AmbientMapBackground({
  patientAnchor,
  style,
}: {
  patientAnchor: MapAnchor | null;
  style?: ViewStyle;
}) {
  if (!patientAnchor) {
    return (
      <View style={[styles.ambientFallback, style]}>
        <View style={styles.ambientGlowA} />
        <View style={styles.ambientGlowB} />
      </View>
    );
  }

  return (
    <View style={[styles.ambientMapWrap, style]} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: patientAnchor.latitude,
          longitude: patientAnchor.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        liteMode={Platform.OS === "android"}
      />
      <View style={styles.ambientMapBlur} />
      <View style={styles.ambientMapVeil} />
      <View style={styles.ambientGlowA} />
      <View style={styles.ambientGlowB} />
    </View>
  );
}

const styles = StyleSheet.create({
  glassShell: {
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  glassShellFill: {
    flex: 1,
    minHeight: 0,
    alignSelf: "stretch",
  },
  glassBorder: {
    borderWidth: 1,
    borderColor: aiEmergencyTheme.glassBorder,
  },
  androidFrost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
  },
  glassContent: {
    position: "relative",
    zIndex: 2,
  },
  glassContentFill: {
    flex: 1,
    minHeight: 0,
  },

  orbWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: aiEmergencyTheme.primary,
  },
  orbCore: {
    overflow: "hidden",
    shadowColor: aiEmergencyTheme.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  orbGradientTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(96, 165, 250, 0.45)",
    opacity: 0.85,
  },
  orbHighlight: {
    position: "absolute",
    top: "12%",
    left: "18%",
    width: "38%",
    height: "28%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  orbInnerDot: {
    position: "absolute",
    alignSelf: "center",
    top: "38%",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.9)",
    shadowColor: "#fff",
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },

  waveRow: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 28,
  },
  waveRowCompact: {
    height: 20,
    gap: 3,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: aiEmergencyTheme.primary,
    minHeight: 4,
  },

  ambientFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: aiEmergencyTheme.bg,
  },
  ambientMapWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  ambientMapBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(244, 248, 255, 0.45)",
  },
  ambientMapVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(244, 248, 255, 0.82)",
  },
  ambientGlowA: {
    position: "absolute",
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(96, 165, 250, 0.18)",
  },
  ambientGlowB: {
    position: "absolute",
    bottom: 120,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
  },
});
