import { I18nManager } from "react-native";

/**
 * Comprehensive RTL utility functions for full application RTL support
 * Works with I18nManager.forceRTL() which requires app reload
 */

export const isRTL = (lang: string): boolean => {
  return lang === "he";
};

/**
 * Returns flexDirection based on language or current RTL state
 */
export const getFlexDirection = (lang?: string): "row" | "row-reverse" => {
  if (lang) {
    return isRTL(lang) ? "row-reverse" : "row";
  }
  return I18nManager.isRTL ? "row-reverse" : "row";
};

/**
 * Returns textAlign based on language or current RTL state
 */
export const getTextAlign = (lang?: string): "left" | "right" | "center" => {
  if (lang) {
    return isRTL(lang) ? "right" : "left";
  }
  return I18nManager.isRTL ? "right" : "left";
};

/**
 * Returns margin values swapped for RTL
 */
export const getRTLMargin = (lang: string | undefined, left: number, right: number) => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  if (rtl) {
    return { marginLeft: right, marginRight: left };
  }
  return { marginLeft: left, marginRight: right };
};

/**
 * Returns padding values swapped for RTL
 */
export const getRTLPadding = (lang: string | undefined, left: number, right: number) => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  if (rtl) {
    return { paddingLeft: right, paddingRight: left };
  }
  return { paddingLeft: left, paddingRight: right };
};

/**
 * Returns position values swapped for RTL
 */
export const getRTLPosition = (lang: string | undefined, left?: number, right?: number) => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  if (rtl) {
    return { left: right, right: left };
  }
  return { left, right };
};

/**
 * Returns border radius values for RTL-aware corners
 */
export const getRTLBorderRadius = (
  lang: string | undefined,
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number
) => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  if (rtl) {
    return {
      borderTopLeftRadius: topRight,
      borderTopRightRadius: topLeft,
      borderBottomRightRadius: bottomLeft,
      borderBottomLeftRadius: bottomRight,
    };
  }
  return {
    borderTopLeftRadius: topLeft,
    borderTopRightRadius: topRight,
    borderBottomRightRadius: bottomRight,
    borderBottomLeftRadius: bottomLeft,
  };
};

/**
 * Returns transform scaleX for RTL mirroring
 */
export const getRTLTransform = (lang?: string) => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  return rtl ? [{ scaleX: -1 }] : [];
};

/**
 * Returns navigation chevron/arrow direction
 */
export const getRTLChevron = (lang?: string): string => {
  const rtl = lang ? isRTL(lang) : I18nManager.isRTL;
  return rtl ? "‹" : "›";
};

/**
 * Initialize RTL support - call this when language changes
 */
export const setupRTL = (lang: string) => {
  const rtl = isRTL(lang);
  I18nManager.allowRTL(true);
  I18nManager.swapLeftAndRightInRTL(rtl);
  // Note: I18nManager.forceRTL() is called in LanguageContext and requires app reload
};

