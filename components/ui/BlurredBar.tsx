/**
 * Soft translucent bar — blur on iOS/web, frosted fallback on Android.
 */

import { BlurView } from "expo-blur";
import React from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";

export type BlurredBarProps = {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
};

export default function BlurredBar({
  children,
  style,
  intensity = 72,
}: BlurredBarProps) {
  return (
    <View style={[styles.shell, style]}>
      {Platform.OS === "android" ? (
        <View style={styles.androidFrost} />
      ) : (
        <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
      )}
      <View style={styles.frostTint} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
    borderBottomWidth: tokens.hairline,
    borderBottomColor: tokens.color.border,
  },
  androidFrost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
  },
  frostTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(246, 248, 251, 0.35)",
  },
});
