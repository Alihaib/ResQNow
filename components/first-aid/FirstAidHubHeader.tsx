import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BlurredBar from "../ui/BlurredBar";
import { useUiDirection } from "../ui/layout";
import { tokens } from "../../src/ui/tokens";
import { firstAidTheme } from "./theme";

export default function FirstAidHubHeader({
  subtitle,
  statusLabel,
  lang,
}: {
  subtitle: string;
  statusLabel?: string;
  lang: string;
}) {
  const insets = useSafeAreaInsets();
  const { row, textAlign, text } = useUiDirection();

  return (
    <BlurredBar style={styles.bar} intensity={80}>
      <View style={[styles.inner, { paddingTop: insets.top + tokens.space.md }]}>
        <Text style={[styles.brand, { textAlign }]}>ResQNow</Text>
        <Text style={[styles.subtitle, { textAlign }]} numberOfLines={1}>
          {subtitle}
        </Text>
        {statusLabel ? (
          <View style={[styles.statusRow, row]}>
            <View style={styles.statusDot} />
            <Text style={[styles.statusText, text]}>
              {statusLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </BlurredBar>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: firstAidTheme.sheetRadius,
    marginBottom: tokens.space.xl,
    borderWidth: 1,
    borderColor: firstAidTheme.glassBorder,
    overflow: "hidden",
  },
  inner: {
    paddingHorizontal: tokens.space.lg,
    paddingBottom: tokens.space.lg,
    gap: tokens.space.xs,
  },
  brand: {
    fontSize: tokens.font.h2,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
    marginTop: 2,
  },
  statusRow: {
    alignItems: "center",
    gap: 6,
    marginTop: tokens.space.sm,
    alignSelf: "flex-start",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: firstAidTheme.primary,
  },
  statusText: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.semibold,
    color: firstAidTheme.primary,
  },
});
