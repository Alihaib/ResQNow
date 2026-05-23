/**
 * Settings / profile menu row — icon in soft pill, RTL-aware chevron.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { tokens } from "../../src/ui/tokens";
import { useUiDirection } from "./layout";

export type ListRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
  style?: ViewStyle;
};

export default function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
  destructive,
  style,
}: ListRowProps) {
  const { row, chevronIcon, marginHorizontal } = useUiDirection();

  const body = (
    <View style={[styles.row, row, style]}>
      <View style={[styles.iconWrap, destructive && styles.iconWrapDanger]}>
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? tokens.color.danger : tokens.color.primary}
        />
      </View>
      <View style={[styles.textCol, marginHorizontal(tokens.space.md, 0)]}>
        <Text
          style={[styles.title, destructive && styles.titleDanger]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        onPress ? (
          <Ionicons
            name={chevronIcon("forward")}
            size={20}
            color={tokens.color.textFaint}
          />
        ) : null
      )}
    </View>
  );

  if (!onPress) {
    return <View style={styles.card}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.xl,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    marginBottom: tokens.space.md,
    overflow: "hidden",
  },
  pressed: { opacity: 0.98 },
  row: {
    alignItems: "center",
    paddingVertical: tokens.space.lg,
    paddingHorizontal: tokens.space.lg,
    minHeight: tokens.hitSlop + 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.primaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapDanger: {
    backgroundColor: tokens.color.dangerBg,
  },
  textCol: { flex: 1 },
  title: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
  },
  titleDanger: { color: tokens.color.danger },
  subtitle: {
    marginTop: 2,
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
    lineHeight: 16,
  },
});
