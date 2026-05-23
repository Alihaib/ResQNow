/**
 * Frosted background for bottom tab bar.
 */

import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";
import { tokens } from "../../src/ui/tokens";

export default function TabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={88} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderTopWidth: tokens.hairline,
    borderTopColor: tokens.color.border,
  },
});
