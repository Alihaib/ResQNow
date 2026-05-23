import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GlassSurface } from "../ai-emergency";
import { tokens } from "../../src/ui/tokens";
import { getChevronIconName, getFlexDirection, getTextAlign, textAlignStyle } from "../../src/utils/rtl";
import { firstAidShadow, firstAidTheme } from "./theme";

export default function FirstAidGuideListRow({
  title,
  meta,
  accent,
  onPress,
  lang,
}: {
  title: string;
  meta: string;
  accent: string;
  onPress: () => void;
  lang: string;
}) {
  const rowDir = getFlexDirection(lang);
  const textAlign = getTextAlign(lang);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <GlassSurface radius={firstAidTheme.radius} style={firstAidShadow}>
        <View style={[styles.row, { flexDirection: rowDir }]}>
          <View style={[styles.icon, { backgroundColor: `${accent}14` }]}>
            <Ionicons name="document-text-outline" size={22} color={accent} />
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.title, { textAlign }]} numberOfLines={2}>
              {title}
            </Text>
            <Text style={[styles.meta, textAlignStyle(lang)]}>{meta}</Text>
          </View>
          <Ionicons
            name={getChevronIconName(lang, "forward")}
            size={20}
            color={tokens.color.textFaint}
          />
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: tokens.space.sm,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  row: {
    alignItems: "center",
    gap: tokens.space.md,
    padding: tokens.space.lg,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    lineHeight: 22,
  },
  meta: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
  },
});
