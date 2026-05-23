/**
 * Approval-pending / hold screens — centered premium card (doctor, ambulance).
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DangerButton } from "./Button";
import Card from "./Card";
import { pageStyles, tokens } from "../../src/ui/tokens";

export type StatusHoldScreenProps = {
  ionIcon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  message: string;
  logoutLabel: string;
  onLogout: () => void;
};

export default function StatusHoldScreen({
  ionIcon,
  title,
  subtitle,
  message,
  logoutLabel,
  onLogout,
}: StatusHoldScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        pageStyles.screen,
        styles.wrap,
        { paddingTop: insets.top + tokens.space.xl },
      ]}
    >
      <View style={styles.brandBadge}>
        <Ionicons name={ionIcon} size={32} color={tokens.color.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Card style={styles.card}>
        <Text style={styles.message}>{message}</Text>
        <DangerButton label={logoutLabel} onPress={onLogout} fullWidth />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.xxl,
    alignItems: "center",
  },
  brandBadge: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.xxl,
    backgroundColor: tokens.color.primaryBg,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.space.md,
  },
  title: {
    fontSize: tokens.font.h1,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    textAlign: "center",
    marginBottom: tokens.space.sm,
  },
  subtitle: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textMuted,
    textAlign: "center",
    marginBottom: tokens.space.xl,
    lineHeight: 22,
    maxWidth: 320,
  },
  card: {
    alignSelf: "stretch",
    gap: tokens.space.lg,
  },
  message: {
    fontSize: tokens.font.bodyLg,
    color: tokens.color.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: tokens.fontWeight.medium,
  },
});
