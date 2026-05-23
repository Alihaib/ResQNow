import { I18nManager, Platform, type TextStyle, type ViewStyle } from "react-native";

/** Languages that use right-to-left layout */
export const RTL_LANGUAGES = ["he", "ar"] as const;
export type RtlLanguage = (typeof RTL_LANGUAGES)[number];

export type LayoutDirection = "ltr" | "rtl";

/** Single source of truth for RTL — extend when adding Arabic UI. */
export const isRTL = (lang: string): boolean =>
  RTL_LANGUAGES.includes(lang as RtlLanguage);

export const getLayoutDirection = (lang: string): LayoutDirection =>
  isRTL(lang) ? "rtl" : "ltr";

/**
 * Updates native RTL flags only when direction actually changes.
 * Does NOT reload the app — UI mirrors on the next React render via lang-aware helpers.
 */
export function applyDirectionChange(lang: string): boolean {
  const shouldBeRTL = isRTL(lang);
  applyWebDocumentDirection(lang);
  if (shouldBeRTL === I18nManager.isRTL) return false;
  I18nManager.allowRTL(true);
  I18nManager.swapLeftAndRightInRTL(true);
  I18nManager.forceRTL(shouldBeRTL);
  return true;
}

/** @deprecated Use applyDirectionChange */
export const setupAppDirection = applyDirectionChange;
export const setupRTL = applyDirectionChange;

/** Web document direction (Expo web) */
export function applyWebDocumentDirection(lang: string): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const rtl = isRTL(lang);
  document.documentElement.dir = rtl ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

/** Row — mirrors in RTL (context-driven, no app reload). */
export const getFlexDirection = (lang?: string): "row" | "row-reverse" => {
  if (lang) return isRTL(lang) ? "row-reverse" : "row";
  return I18nManager.isRTL ? "row-reverse" : "row";
};

/** Column — vertical stack (direction-neutral). */
export const getFlexDirectionColumn = (): "column" => "column";

export const getTextAlign = (lang?: string): "left" | "right" | "center" => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  return rtl ? "right" : "left";
};

export const getWritingDirection = (lang?: string): "ltr" | "rtl" => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  return rtl ? "rtl" : "ltr";
};

export const alignSelfStart = (): ViewStyle => ({ alignSelf: "flex-start" });
export const alignSelfEnd = (): ViewStyle => ({ alignSelf: "flex-end" });

/** Logical spacing — preferred over marginLeft/Right */
export const marginHorizontal = (start: number, end: number): ViewStyle => ({
  marginStart: start,
  marginEnd: end,
});

export const paddingHorizontal = (start: number, end: number): ViewStyle => ({
  paddingStart: start,
  paddingEnd: end,
});

export const marginVertical = (top: number, bottom: number): ViewStyle => ({
  marginTop: top,
  marginBottom: bottom,
});

/** @deprecated Prefer marginHorizontal(start, end) */
export const getRTLMargin = marginHorizontal;

/** @deprecated Prefer paddingHorizontal(start, end) */
export const getRTLPadding = paddingHorizontal;

export const getChatBubbleRadius = (
  lang: string | undefined,
  isMe: boolean,
  radius = 14,
  tail = 4,
): ViewStyle => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  if (isMe) {
    return rtl
      ? { borderRadius: radius, borderBottomLeftRadius: tail }
      : { borderRadius: radius, borderBottomRightRadius: tail };
  }
  return rtl
    ? { borderRadius: radius, borderBottomRightRadius: tail }
    : { borderRadius: radius, borderBottomLeftRadius: tail };
};

export const getRTLBorderRadius = (
  lang: string | undefined,
  topStart: number,
  topEnd: number,
  bottomEnd: number,
  bottomStart: number,
): ViewStyle => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  if (rtl) {
    return {
      borderTopStartRadius: topEnd,
      borderTopEndRadius: topStart,
      borderBottomEndRadius: bottomStart,
      borderBottomStartRadius: bottomEnd,
    };
  }
  return {
    borderTopStartRadius: topStart,
    borderTopEndRadius: topEnd,
    borderBottomEndRadius: bottomEnd,
    borderBottomStartRadius: bottomStart,
  };
};

/** Only for decorative mirror — NOT medical icons */
export const getRTLTransform = (lang?: string): ViewStyle => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  return rtl ? { transform: [{ scaleX: -1 }] } : {};
};

export const getRTLChevron = (lang?: string): string => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  return rtl ? "‹" : "›";
};

export const getRTLBackChevron = (lang?: string): string => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  return rtl ? "›" : "‹";
};

export function getChevronIconName(
  lang?: string,
  direction: "forward" | "back" = "forward",
): "chevron-forward" | "chevron-back" {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  if (direction === "forward") return rtl ? "chevron-back" : "chevron-forward";
  return rtl ? "chevron-forward" : "chevron-back";
}

export const textAlignStyle = (lang?: string): TextStyle => ({
  textAlign: getTextAlign(lang),
  writingDirection: getWritingDirection(lang),
});

/** StyleSheet helpers — pass lang from useUiDirection().lang */
export const uiRowStyle = (lang: string): ViewStyle => ({
  flexDirection: getFlexDirection(lang),
});

export const uiColumnStyle = (): ViewStyle => ({
  flexDirection: getFlexDirectionColumn(),
});
