import { StyleSheet, Text, View } from "react-native";
import { getTextAlign, textAlignStyle } from "../../src/utils/rtl";
import {
  GUIDE_CALM_FONT_SIZE,
  GUIDE_CALM_LINE_HEIGHT,
  GUIDE_CALM_HEIGHT,
} from "./guideLayout";

export default function FirstAidGuideCalmStrip({
  message,
  lang,
}: {
  message: string;
  lang: string;
}) {
  const textAlign = getTextAlign(lang);

  return (
    <View style={styles.strip}>
      <Text style={[styles.text, { textAlign }, textAlignStyle(lang)]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    minHeight: GUIDE_CALM_HEIGHT,
    justifyContent: "center",
    flexShrink: 0,
    opacity: 0.75,
  },
  text: {
    fontSize: GUIDE_CALM_FONT_SIZE,
    lineHeight: GUIDE_CALM_LINE_HEIGHT,
    fontWeight: "500",
    color: "rgba(100, 116, 139, 0.85)",
    textAlign: "center",
  },
});
