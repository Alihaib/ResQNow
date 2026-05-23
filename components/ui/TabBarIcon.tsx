/**
 * Bottom tab icon inside a soft rounded pill when active.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { tokens } from "../../src/ui/tokens";

export type TabBarIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  activeName: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
};

export default function TabBarIcon({
  name,
  activeName,
  color,
  focused,
}: TabBarIconProps) {
  return (
    <View style={[styles.wrap, focused && styles.wrapFocused]}>
      <Ionicons
        name={focused ? activeName : name}
        size={22}
        color={color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 32,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  wrapFocused: {
    backgroundColor: tokens.color.primaryBg,
  },
});
