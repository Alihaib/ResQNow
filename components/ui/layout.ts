import { useMemo } from "react";
import { I18nManager, type TextStyle, type ViewStyle } from "react-native";
import { useLanguage } from "../../src/context/LanguageContext";
import {
  alignSelfEnd,
  alignSelfStart,
  getChevronIconName,
  getFlexDirection,
  getFlexDirectionColumn,
  getRTLBackChevron,
  getRTLChevron,
  getTextAlign,
  getWritingDirection,
  isRTL as checkRTL,
  marginHorizontal,
  paddingHorizontal,
  textAlignStyle,
  uiColumnStyle,
  uiRowStyle,
} from "../../src/utils/rtl";

/**
 * THE ONLY UI direction hook — reads LanguageContext; re-renders when lang changes.
 * Do not use raw flexDirection / textAlign:left in feature code.
 */
export function useUiDirection() {
  const { lang, isRTL, direction, directionVersion } = useLanguage();

  return useMemo(
    () => ({
      lang,
      isRTL,
      direction,
      directionVersion,
      row: uiRowStyle(lang),
      column: uiColumnStyle(),
      textAlign: getTextAlign(lang),
      writingDirection: getWritingDirection(lang),
      text: textAlignStyle(lang) as TextStyle,
      alignStart: alignSelfStart(),
      alignEnd: alignSelfEnd(),
      marginHorizontal: (start: number, end: number) => marginHorizontal(start, end),
      paddingHorizontal: (start: number, end: number) => paddingHorizontal(start, end),
      chevronForward: getRTLChevron(lang),
      chevronBack: getRTLBackChevron(lang),
      chevronIcon: (dir: "forward" | "back" = "forward") => getChevronIconName(lang, dir),
    }),
    [lang, isRTL, direction, directionVersion],
  );
}

/** @deprecated Use useUiDirection().row */
export function uiRow(lang?: string): ViewStyle {
  return uiRowStyle(lang ?? "en");
}

/** @deprecated Use useUiDirection().column */
export function uiColumn(_lang?: string): ViewStyle {
  return uiColumnStyle();
}

export function uiMarginHorizontal(start: number, end: number): ViewStyle {
  return marginHorizontal(start, end);
}

export function uiPaddingHorizontal(start: number, end: number): ViewStyle {
  return paddingHorizontal(start, end);
}

/** @deprecated Use useUiDirection().isRTL */
export function isUiRTL(lang?: string): boolean {
  return lang ? checkRTL(lang) : I18nManager.isRTL;
}
