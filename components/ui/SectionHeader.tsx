/**
 * In-section heading — overline + title, optional accent dot and trailing slot.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../../src/ui/tokens";
import { useUiDirection } from "./layout";

export type SectionHeaderProps = {
  overline?: string;
  title: string;
  accent?: string;
  trailing?: React.ReactNode;
  dense?: boolean;
};

export default function SectionHeader({
  overline,
  title,
  accent,
  trailing,
  dense,
}: SectionHeaderProps) {
  const { row, textAlign } = useUiDirection();

  return (
    <View style={[styles.wrap, row, dense && styles.wrapDense]}>
      <View style={[styles.left, row]}>
        {accent ? (
          <View style={[styles.dot, { backgroundColor: accent }]} />
        ) : null}
        <View style={styles.textCol}>
          {overline ? (
            <Text style={[styles.overline, { textAlign }]} numberOfLines={1}>
              {overline.toUpperCase()}
            </Text>
          ) : null}
          <Text style={[styles.title, { textAlign }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.space.md,
  },
  wrapDense: { marginBottom: tokens.space.sm },
  left: {
    alignItems: "center",
    flex: 1,
    gap: tokens.space.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textCol: { flex: 1 },
  overline: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.bold,
    color: tokens.color.textFaint,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    letterSpacing: -0.2,
  },
  trailing: { marginStart: tokens.space.sm },
});
