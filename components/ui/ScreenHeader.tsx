/**
 * Top-of-screen header with optional back button + eyebrow + title.
 *
 * Used by every responder dashboard so the back affordance, status-bar
 * inset, eyebrow chip and title line up byte-for-byte across screens.
 *
 * Visual approach: a clean white surface with a hairline divider at the
 * bottom — no heavy shadow, no large title block. Title size is moderate
 * (h2) so it does not dwarf the dashboard content immediately below it.
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
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.md,
    backgroundColor: tokens.color.bgSurface,
    borderBottomWidth: tokens.hairline,
    borderBottomColor: tokens.color.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.color.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 22,
    color: tokens.color.textPrimary,
    fontWeight: "800",
    lineHeight: 24,
  },
  spacer: { width: 38, height: 38 },
  textCol: { flex: 1, marginLeft: tokens.space.md },
  eyebrow: {
    fontSize: tokens.font.overline,
    fontWeight: "800",
    color: tokens.color.textFaint,
    letterSpacing: 0.9,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: tokens.font.h3,
    fontWeight: "900",
    color: tokens.color.textPrimary,
    letterSpacing: -0.2,
  },
  trailing: { marginLeft: tokens.space.md, minWidth: 38, alignItems: "flex-end" },
});
