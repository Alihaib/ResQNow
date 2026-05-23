import { Pressable, StyleSheet, Text, View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { getFlexDirection, textAlignStyle } from "../../src/utils/rtl";
import { tokens } from "../../src/ui/tokens";
import { firstAidTheme } from "./theme";
import {
  GUIDE_NAV_ROW_HEIGHT,
  GUIDE_NAV_VERTICAL_PAD,
  GUIDE_TAB_BAR_HEIGHT,
} from "./guideLayout";

const PRIMARY_BLUE = "#2563EB";

export default function FirstAidGuideNavBar({
  canBack,
  canNext,
  onBack,
  onNext,
  backLabel,
  nextLabel,
  lang,
}: {
  canBack: boolean;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  backLabel: string;
  nextLabel: string;
  lang: string;
}) {
  const insets = useSafeAreaInsets();
  const rowDir = getFlexDirection(lang);

  return (
    <View
      style={[
        styles.shell,
        { marginBottom: GUIDE_TAB_BAR_HEIGHT, paddingBottom: insets.bottom > 0 ? 0 : 8 },
      ]}
    >
      {Platform.OS === "android" ? (
        <View style={styles.androidFrost} />
      ) : (
        <BlurView intensity={76} tint="light" style={StyleSheet.absoluteFill} />
      )}
      <View style={[styles.row, { flexDirection: rowDir }]}>
        <Pressable
          onPress={onBack}
          disabled={!canBack}
          style={({ pressed }) => [
            styles.backBtn,
            !canBack && styles.disabled,
            pressed && canBack && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <Text
            style={[
              styles.backText,
              textAlignStyle(lang),
              !canBack && styles.disabledText,
            ]}
          >
            {backLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={onNext}
          disabled={!canNext}
          style={({ pressed }) => [
            styles.nextBtn,
            !canNext && styles.nextDisabled,
            pressed && canNext && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={nextLabel}
        >
          <Text style={[styles.nextText, textAlignStyle(lang)]}>{nextLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexShrink: 0,
    zIndex: 2,
    borderTopWidth: 1,
    borderTopColor: firstAidTheme.glassBorder,
    overflow: "hidden",
  },
  androidFrost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
  },
  row: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: GUIDE_NAV_VERTICAL_PAD,
    gap: tokens.space.sm,
    alignItems: "stretch",
  },
  backBtn: {
    flex: 0.34,
    height: GUIDE_NAV_ROW_HEIGHT,
    borderRadius: tokens.radius.lg,
    backgroundColor: "rgba(248, 250, 252, 0.95)",
    borderWidth: 1,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textSecondary,
  },
  nextBtn: {
    flex: 0.66,
    height: GUIDE_NAV_ROW_HEIGHT,
    borderRadius: tokens.radius.lg,
    backgroundColor: PRIMARY_BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  nextDisabled: {
    backgroundColor: "rgba(37, 99, 235, 0.35)",
  },
  nextText: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textOnPrimary,
  },
  disabled: { opacity: 0.45 },
  disabledText: { color: tokens.color.textFaint },
  pressed: { opacity: 0.92 },
});
