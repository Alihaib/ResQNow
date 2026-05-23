/**
 * Consistent top bar — blurred surface, back, eyebrow, title, trailing action.
 */

import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../src/context/LanguageContext";
import { tokens } from "../../src/ui/tokens";
import BlurredBar from "./BlurredBar";
import { useUiDirection } from "./layout";

export type ScreenHeaderProps = {
  title: string;
  eyebrow?: string;
  showBack?: boolean;
  onBack?: () => void;
  fallbackRoute?: string;
  trailing?: React.ReactNode;
};

export default function ScreenHeader({
  title,
  eyebrow,
  showBack = true,
  onBack,
  fallbackRoute = "/(tabs)",
  trailing,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { row, textAlign, chevronBack, marginHorizontal } = useUiDirection();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute as never);
    }
  };

  return (
    <BlurredBar style={{ borderBottomWidth: 0 }}>
      <View
        style={[
          styles.bar,
          row,
          { paddingTop: insets.top + tokens.space.sm },
        ]}
      >
        {showBack ? (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("goBack")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backText}>{chevronBack}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}
        <View
          style={[styles.textCol, marginHorizontal(tokens.space.md, 0)]}
        >
          {eyebrow ? (
            <Text style={[styles.eyebrow, { textAlign }]} numberOfLines={1}>
              {eyebrow}
            </Text>
          ) : null}
          <Text style={[styles.title, { textAlign }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.trailing}>{trailing}</View>
      </View>
    </BlurredBar>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 22,
    color: tokens.color.textPrimary,
    fontWeight: tokens.fontWeight.heavy,
    lineHeight: 24,
  },
  spacer: { width: 40, height: 40 },
  textCol: { flex: 1 },
  eyebrow: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.bold,
    color: tokens.color.textFaint,
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.heavy,
    color: tokens.color.textPrimary,
    letterSpacing: -0.2,
  },
  trailing: {
    minWidth: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
