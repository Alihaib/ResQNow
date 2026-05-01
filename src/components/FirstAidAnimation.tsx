import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// ── CPR ───────────────────────────────────────────────────────────────────────
function CPRScene() {
  const heartScale = useSharedValue(1);
  const handsY = useSharedValue(0);
  const r1Scale = useSharedValue(1);
  const r1Op = useSharedValue(0);
  const r2Scale = useSharedValue(1);
  const r2Op = useSharedValue(0);

  useEffect(() => {
    const BEAT = 520;
    heartScale.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: BEAT * 0.35, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: BEAT * 0.65, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
    handsY.value = withRepeat(
      withSequence(
        withTiming(20, { duration: BEAT * 0.35 }),
        withTiming(0, { duration: BEAT * 0.65 })
      ),
      -1,
      false
    );
    const ripple = (scale: any, opacity: any, delay = 0) => {
      scale.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1 }),
            withTiming(2.8, { duration: 1000, easing: Easing.out(Easing.ease) })
          ),
          -1,
          false
        )
      );
      opacity.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0.6, { duration: 1 }),
            withTiming(0, { duration: 1000 })
          ),
          -1,
          false
        )
      );
    };
    ripple(r1Scale, r1Op, 0);
    ripple(r2Scale, r2Op, 500);
  }, []);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));
  const handsStyle = useAnimatedStyle(() => ({ transform: [{ translateY: handsY.value }] }));
  const r1Style = useAnimatedStyle(() => ({ transform: [{ scale: r1Scale.value }], opacity: r1Op.value }));
  const r2Style = useAnimatedStyle(() => ({ transform: [{ scale: r2Scale.value }], opacity: r2Op.value }));

  return (
    <View style={[s.scene, { backgroundColor: "#1A0508" }]}>
      <View style={{ position: "relative", width: 110, height: 110, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={[s.ring, { borderColor: "#EF4444" }, r1Style]} />
        <Animated.View style={[s.ring, { borderColor: "#F87171" }, r2Style]} />
        <Animated.View style={heartStyle}>
          <Text style={{ fontSize: 64 }}>❤️</Text>
        </Animated.View>
      </View>
      <Animated.View style={[{ marginTop: -6 }, handsStyle]}>
        <Text style={{ fontSize: 48 }}>🙌</Text>
      </Animated.View>
      <Text style={s.label}>30 compressions · 2 breaths · 100 bpm</Text>
    </View>
  );
}

// ── BLEEDING ─────────────────────────────────────────────────────────────────
function BleedingScene() {
  const handY = useSharedValue(-10);
  const r1Scale = useSharedValue(1);
  const r1Op = useSharedValue(0);
  const r2Scale = useSharedValue(1);
  const r2Op = useSharedValue(0);

  useEffect(() => {
    handY.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 700, easing: Easing.out(Easing.ease) }),
        withTiming(-10, { duration: 700, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
    const ripple = (scale: any, opacity: any, delay = 0) => {
      scale.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1 }),
            withTiming(3.0, { duration: 1200, easing: Easing.out(Easing.ease) })
          ),
          -1,
          false
        )
      );
      opacity.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0.55, { duration: 1 }),
            withTiming(0, { duration: 1200 })
          ),
          -1,
          false
        )
      );
    };
    ripple(r1Scale, r1Op, 0);
    ripple(r2Scale, r2Op, 600);
  }, []);

  const handStyle = useAnimatedStyle(() => ({ transform: [{ translateY: handY.value }] }));
  const r1Style = useAnimatedStyle(() => ({ transform: [{ scale: r1Scale.value }], opacity: r1Op.value }));
  const r2Style = useAnimatedStyle(() => ({ transform: [{ scale: r2Scale.value }], opacity: r2Op.value }));

  return (
    <View style={[s.scene, { backgroundColor: "#1A0000" }]}>
      <Animated.View style={[{ zIndex: 2 }, handStyle]}>
        <Text style={{ fontSize: 58 }}>🤚</Text>
      </Animated.View>
      <View style={{ position: "relative", width: 90, height: 90, alignItems: "center", justifyContent: "center", marginTop: -16, zIndex: 1 }}>
        <Animated.View style={[{ position: "absolute", width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: "#DC2626" }, r1Style]} />
        <Animated.View style={[{ position: "absolute", width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: "#EF4444" }, r2Style]} />
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#7F1D1D" }} />
      </View>
      <Text style={s.label}>Apply firm direct pressure · Do not remove cloth</Text>
    </View>
  );
}

// ── CHOKING ──────────────────────────────────────────────────────────────────
function ChokingScene() {
  const fistX = useSharedValue(50);
  const arrowY = useSharedValue(0);
  const arrowOp = useSharedValue(1);

  useEffect(() => {
    fistX.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 550, easing: Easing.out(Easing.ease) }),
        withTiming(50, { duration: 350, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
    arrowY.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: 500 }),
        withTiming(0, { duration: 500 })
      ),
      -1,
      false
    );
    arrowOp.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      false
    );
  }, []);

  const fistStyle = useAnimatedStyle(() => ({ transform: [{ translateX: fistX.value }] }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateY: arrowY.value }], opacity: arrowOp.value }));

  return (
    <View style={[s.scene, { backgroundColor: "#1A0E00" }]}>
      <Text style={{ fontSize: 54, zIndex: 2 }}>🧍</Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: -18, zIndex: 3, gap: 6 }}>
        <Animated.View style={fistStyle}>
          <Text style={{ fontSize: 42 }}>🤜</Text>
        </Animated.View>
        <Animated.View style={arrowStyle}>
          <Text style={{ fontSize: 32 }}>⬆️</Text>
        </Animated.View>
      </View>
      <Text style={s.label}>Abdominal thrusts (Heimlich) · 5 back blows</Text>
    </View>
  );
}

// ── BURNS ────────────────────────────────────────────────────────────────────
function BurnsScene() {
  const fireScale = useSharedValue(1);
  const fireOp = useSharedValue(1);
  const d1Y = useSharedValue(-80);
  const d2Y = useSharedValue(-80);
  const d3Y = useSharedValue(-80);
  const dropsOp = useSharedValue(0);

  useEffect(() => {
    fireScale.value = withRepeat(
      withSequence(
        withTiming(0.1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 300 })
      ),
      -1,
      false
    );
    fireOp.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2200 }),
        withTiming(1, { duration: 300 })
      ),
      -1,
      false
    );
    dropsOp.value = withTiming(1, { duration: 400 });
    const drop = (val: any, delay: number) =>
      (val.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-80, { duration: 1 }),
            withTiming(80, { duration: 1100, easing: Easing.in(Easing.ease) })
          ),
          -1,
          false
        )
      ));
    drop(d1Y, 0);
    drop(d2Y, 370);
    drop(d3Y, 740);
  }, []);

  const fireStyle = useAnimatedStyle(() => ({ transform: [{ scale: fireScale.value }], opacity: fireOp.value }));
  const d1Style = useAnimatedStyle(() => ({ transform: [{ translateY: d1Y.value }], opacity: dropsOp.value }));
  const d2Style = useAnimatedStyle(() => ({ transform: [{ translateY: d2Y.value }], opacity: dropsOp.value }));
  const d3Style = useAnimatedStyle(() => ({ transform: [{ translateY: d3Y.value }], opacity: dropsOp.value }));

  return (
    <View style={[s.scene, { backgroundColor: "#001A1A" }]}>
      <Animated.View style={fireStyle}>
        <Text style={{ fontSize: 64 }}>🔥</Text>
      </Animated.View>
      <View style={{ flexDirection: "row", gap: 20, marginTop: -24 }}>
        <Animated.View style={d1Style}><Text style={{ fontSize: 30 }}>💧</Text></Animated.View>
        <Animated.View style={d2Style}><Text style={{ fontSize: 30 }}>💧</Text></Animated.View>
        <Animated.View style={d3Style}><Text style={{ fontSize: 30 }}>💧</Text></Animated.View>
      </View>
      <Text style={s.label}>Cool with running water · 20 minutes · No ice</Text>
    </View>
  );
}

// ── FRACTURES ────────────────────────────────────────────────────────────────
function FracturesScene() {
  const leftX = useSharedValue(50);
  const rightX = useSharedValue(-50);
  const bandScale = useSharedValue(0);
  const boneOp = useSharedValue(0);

  useEffect(() => {
    boneOp.value = withTiming(1, { duration: 400 });
    leftX.value = withDelay(400, withSpring(0, { damping: 12, stiffness: 120 }));
    rightX.value = withDelay(400, withSpring(0, { damping: 12, stiffness: 120 }));
    bandScale.value = withDelay(950, withSpring(1, { damping: 10, stiffness: 100 }));
  }, []);

  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: leftX.value }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rightX.value }] }));
  const bandStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: bandScale.value }] }));
  const boneStyle = useAnimatedStyle(() => ({ opacity: boneOp.value }));

  return (
    <View style={[s.scene, { backgroundColor: "#0D0D1A" }]}>
      <Animated.View style={boneStyle}>
        <Text style={{ fontSize: 58 }}>🦴</Text>
      </Animated.View>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16, gap: 3 }}>
        <Animated.View style={leftStyle}>
          <View style={{ width: 52, height: 16, backgroundColor: "#92400E", borderRadius: 8 }} />
        </Animated.View>
        <Animated.View style={bandStyle}>
          <View style={{ width: 76, height: 16, backgroundColor: "#FCD34D", borderRadius: 8 }} />
        </Animated.View>
        <Animated.View style={rightStyle}>
          <View style={{ width: 52, height: 16, backgroundColor: "#92400E", borderRadius: 8 }} />
        </Animated.View>
      </View>
      <Text style={s.label}>Immobilize · Do not realign · Apply splint</Text>
    </View>
  );
}

// ── POISONING ────────────────────────────────────────────────────────────────
function PoisoningScene() {
  const skullScale = useSharedValue(1);
  const phoneScale = useSharedValue(0);
  const phoneRotate = useSharedValue(0);
  const xOp = useSharedValue(0);

  useEffect(() => {
    skullScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      false
    );
    xOp.value = withDelay(300, withTiming(1, { duration: 400 }));
    phoneScale.value = withDelay(700, withSpring(1, { damping: 10, stiffness: 120 }));
    phoneRotate.value = withDelay(1200, withRepeat(
      withSequence(
        withTiming(-12, { duration: 120 }),
        withTiming(12, { duration: 120 }),
        withTiming(-12, { duration: 120 }),
        withTiming(12, { duration: 120 }),
        withTiming(0, { duration: 120 }),
        withTiming(0, { duration: 800 })
      ),
      -1,
      false
    ));
  }, []);

  const skullStyle = useAnimatedStyle(() => ({ transform: [{ scale: skullScale.value }] }));
  const phoneStyle = useAnimatedStyle(() => ({
    transform: [{ scale: phoneScale.value }, { rotate: phoneRotate.value + "deg" }],
  }));
  const xStyle = useAnimatedStyle(() => ({ opacity: xOp.value }));

  return (
    <View style={[s.scene, { backgroundColor: "#0D001A" }]}>
      <View style={{ alignItems: "center" }}>
        <Animated.View style={skullStyle}>
          <Text style={{ fontSize: 54 }}>☠️</Text>
        </Animated.View>
        <Animated.View style={[{ marginTop: -20, zIndex: 2 }, xStyle]}>
          <Text style={{ fontSize: 32, color: "#EF4444", fontWeight: "900" }}>✖</Text>
        </Animated.View>
        <Animated.View style={[{ marginTop: 6 }, phoneStyle]}>
          <Text style={{ fontSize: 52 }}>📞</Text>
        </Animated.View>
      </View>
      <Text style={s.label}>Do not induce vomiting · Call poison control</Text>
    </View>
  );
}

// ── SHOCK ────────────────────────────────────────────────────────────────────
function ShockScene() {
  const legsY = useSharedValue(0);
  const pillowOp = useSharedValue(0);
  const blanketScaleX = useSharedValue(0);

  useEffect(() => {
    legsY.value = withDelay(500, withSpring(-16, { damping: 10, stiffness: 80 }));
    pillowOp.value = withDelay(500, withTiming(1, { duration: 600 }));
    blanketScaleX.value = withDelay(1000, withSpring(1, { damping: 12, stiffness: 100 }));
  }, []);

  const legsStyle = useAnimatedStyle(() => ({ transform: [{ translateY: legsY.value }] }));
  const pillowStyle = useAnimatedStyle(() => ({ opacity: pillowOp.value }));
  const blanketStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: blanketScaleX.value }] }));

  return (
    <View style={[s.scene, { backgroundColor: "#1A0E00" }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#FDE68A" }} />
        <View style={{ width: 72, height: 24, backgroundColor: "#6B7280", borderRadius: 8 }} />
        <Animated.View style={[{ alignItems: "center" }, legsStyle]}>
          <View style={{ width: 62, height: 18, backgroundColor: "#9CA3AF", borderRadius: 8 }} />
          <Animated.View style={pillowStyle}>
            <View style={{ width: 44, height: 10, backgroundColor: "#FCD34D", borderRadius: 5, marginTop: 3 }} />
          </Animated.View>
        </Animated.View>
      </View>
      <Animated.View style={[{ marginTop: 16 }, blanketStyle]}>
        <View style={{ width: 160, height: 10, backgroundColor: "#93C5FD", borderRadius: 5 }} />
      </Animated.View>
      <Text style={s.label}>Lay flat · Elevate legs 30 cm · Keep warm</Text>
    </View>
  );
}

// ── UNCONSCIOUS ──────────────────────────────────────────────────────────────
function ABCBadge({ letter, label, animStyle }: { letter: string; label: string; animStyle: any }) {
  return (
    <Animated.View style={[{ alignItems: "center" }, animStyle]}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 17 }}>{letter}</Text>
      </View>
      <Text style={{ color: "#9CA3AF", fontSize: 10, marginTop: 3, fontWeight: "600" }}>{label}</Text>
    </Animated.View>
  );
}

function UnconsciousScene() {
  const aOp = useSharedValue(0);
  const bOp = useSharedValue(0);
  const cOp = useSharedValue(0);
  const chestY = useSharedValue(0);

  useEffect(() => {
    aOp.value = withDelay(0, withSpring(1, { damping: 10, stiffness: 120 }));
    bOp.value = withDelay(500, withSpring(1, { damping: 10, stiffness: 120 }));
    cOp.value = withDelay(1000, withSpring(1, { damping: 10, stiffness: 120 }));
    chestY.value = withDelay(1500, withRepeat(
      withSequence(
        withTiming(-7, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    ));
  }, []);

  const aStyle = useAnimatedStyle(() => ({ opacity: aOp.value, transform: [{ scale: aOp.value }] }));
  const bStyle = useAnimatedStyle(() => ({ opacity: bOp.value, transform: [{ scale: bOp.value }] }));
  const cStyle = useAnimatedStyle(() => ({ opacity: cOp.value, transform: [{ scale: cOp.value }] }));
  const chestStyle = useAnimatedStyle(() => ({ transform: [{ translateY: chestY.value }] }));

  return (
    <View style={[s.scene, { backgroundColor: "#00001A" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 4 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#FDE68A" }} />
        <Animated.View style={chestStyle}>
          <View style={{ width: 70, height: 22, backgroundColor: "#6B7280", borderRadius: 8 }} />
        </Animated.View>
        <View style={{ width: 55, height: 16, backgroundColor: "#9CA3AF", borderRadius: 8 }} />
      </View>
      <View style={{ flexDirection: "row", gap: 18 }}>
        <ABCBadge letter="A" label="Airway" animStyle={aStyle} />
        <ABCBadge letter="B" label="Breathing" animStyle={bStyle} />
        <ABCBadge letter="C" label="Circulation" animStyle={cStyle} />
      </View>
      <Text style={s.label}>Check A·B·C · Place in recovery position</Text>
    </View>
  );
}

// ── Registry ─────────────────────────────────────────────────────────────────
const SCENES: Record<string, () => JSX.Element> = {
  cpr: CPRScene,
  bleeding: BleedingScene,
  choking: ChokingScene,
  burns: BurnsScene,
  fractures: FracturesScene,
  poisoning: PoisoningScene,
  shock: ShockScene,
  unconscious: UnconsciousScene,
};

export function FirstAidAnimationScene({ category }: { category: string }) {
  const Scene = SCENES[category];
  if (!Scene) return null;
  return <Scene />;
}

const s = StyleSheet.create({
  scene: {
    width: "100%",
    height: 218,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 10,
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
  },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 10,
    letterSpacing: 0.2,
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
