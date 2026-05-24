/**
 * Static AI emergency assistant backdrop — glow orbs only, no animations.
 * Render ONCE in app/_layout.tsx behind navigation. Do not mount per screen.
 */

import React, { memo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";

const ORB_STYLES = StyleSheet.create({
  orbTopRight: {
    position: "absolute",
    top: -88,
    right: -64,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(29, 78, 216, 0.08)",
  },
  orbMidLeft: {
    position: "absolute",
    top: "40%",
    left: -92,
    width: 228,
    height: 228,
    borderRadius: 114,
    backgroundColor: "rgba(59, 130, 246, 0.07)",
  },
  orbBottomRight: {
    position: "absolute",
    bottom: -72,
    right: -56,
    width: 204,
    height: 204,
    borderRadius: 102,
    backgroundColor: "rgba(96, 165, 250, 0.06)",
  },
});

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: tokens.color.aiBgSoft,
  },
});

type AiBackgroundProps = {
  style?: ViewStyle;
};

function AiBackgroundInner({ style }: AiBackgroundProps) {
  return (
    <View
      style={[styles.root, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={ORB_STYLES.orbTopRight} />
      <View style={ORB_STYLES.orbMidLeft} />
      <View style={ORB_STYLES.orbBottomRight} />
    </View>
  );
}

export const AiBackground = memo(AiBackgroundInner);

const appScreenStyles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "transparent",
  },
  /** Full-screen modal host — fills Modal window, no gaps */
  overlay: {
    flex: 1,
    width: "100%",
    backgroundColor: "transparent",
  },
});

/**
 * Full-screen shell for modals / overlays.
 * Use `overlay` inside transparent Modal; global AiBackground stays in app/_layout.tsx.
 */
export const AppScreen = memo(function AppScreen({
  children,
  style,
  overlay = false,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  overlay?: boolean;
}) {
  return (
    <View style={[overlay ? appScreenStyles.overlay : appScreenStyles.flex, style]}>
      {children}
    </View>
  );
});
