import { useEffect, useRef, type ReactNode } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";

type FadeInViewProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
};

/** Lightweight mount fade — uses RN Animated only. */
export default function FadeInView({
  children,
  style,
  delay = 0,
  duration = tokens.motion.slow,
}: FadeInViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;
  const didAnimateRef = useRef(false);

  useEffect(() => {
    if (didAnimateRef.current) return;
    didAnimateRef.current = true;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, duration, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
