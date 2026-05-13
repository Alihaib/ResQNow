/**
 * Top-of-screen header with optional back button + eyebrow + title.
 *
 * Used by every responder dashboard so the back affordance, status-bar
 * inset, eyebrow chip and title line up byte-for-byte across screens.
 *
 * If `onBack` is provided we call it directly; otherwise the header falls
 * back to `router.back()` and, if that's not available, replaces with
 * `fallbackRoute` (defaults to the tab root). This mirrors the existing
 * behaviour every dashboard implemented inline.
 */

import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { tokens } from "../../src/ui/tokens";

type Props = {
  title: string;
  /** Small uppercase eyebrow shown above the title (role label, eyebrow icon…). */
  eyebrow?: string;
  /** When false, no back button is rendered (root tab screens). */
  showBack?: boolean;
  onBack?: () => void;
  /** Where to go if `router.canGoBack()` is false. */
  fallbackRoute?: string;
  /** Optional element rendered on the right of the header. */
  trailing?: React.ReactNode;
};

export default function ScreenHeader({
  title,
  eyebrow,
  showBack = true,
  onBack,
  fallbackRoute = "/(tabs)",
  trailing,
}: Props) {
  const router = useRouter();

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
    <View style={styles.bar}>
      {showBack ? (
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.spacer} />
      )}
      <View style={styles.textCol}>
        {eyebrow ? (
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={styles.trailing}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: tokens.space.xl,
    paddingBottom: tokens.space.lg,
    backgroundColor: tokens.color.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.bgPage,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 24,
    color: tokens.color.textPrimary,
    fontWeight: "800",
    lineHeight: 26,
  },
  spacer: { width: 40, height: 40 },
  textCol: { flex: 1, marginLeft: tokens.space.md },
  eyebrow: {
    fontSize: tokens.font.overline,
    fontWeight: "800",
    color: tokens.color.textFaint,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    fontSize: tokens.font.h2,
    fontWeight: "900",
    color: tokens.color.textPrimary,
    letterSpacing: -0.3,
  },
  trailing: { marginLeft: tokens.space.md, minWidth: 40, alignItems: "flex-end" },
});
