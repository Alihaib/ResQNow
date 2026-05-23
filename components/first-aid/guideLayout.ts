import { Platform, type TextStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";

export const GUIDE_TAB_BAR_HEIGHT = Platform.OS === "ios" ? 84 : 68;

export const GUIDE_NAV_ROW_HEIGHT = 56;
export const GUIDE_NAV_VERTICAL_PAD = 10;
export const GUIDE_HEADER_ROW_HEIGHT = 40;
export const GUIDE_HEADER_PROGRESS_HEIGHT = 3;
export const GUIDE_HEADER_ROW_GAP = 6;
export const GUIDE_HEADER_VERTICAL_PAD = 8;

export const GUIDE_VOICE_HEIGHT = 44;
export const GUIDE_VOICE_HEIGHT_COMPACT = 36;
export const GUIDE_CALM_HEIGHT = 22;

export const GUIDE_INSTRUCTION_FONT_SIZE = 25;
export const GUIDE_INSTRUCTION_LINE_HEIGHT = 34;
export const GUIDE_INSTRUCTION_FONT_SIZE_LARGE = 26;
export const GUIDE_INSTRUCTION_LINE_HEIGHT_LARGE = 36;

/** Soft cap — card grows naturally up to this height */
export const GUIDE_CARD_MAX_HEIGHT_RATIO = 0.88;

const COMPACT_WINDOW = 680;
const HIDE_CALM_WINDOW = 640;

export type GuideInstructionTypography = {
  fontSize: number;
  lineHeight: number;
  style: TextStyle;
};

export type GuideLayoutMetrics = {
  instructionMaxHeight: number;
  showCalmLine: boolean;
  voiceCompact: boolean;
  typography: GuideInstructionTypography;
};

export function getGuideInstructionTypography(
  windowHeight: number,
): GuideInstructionTypography {
  const large = windowHeight >= COMPACT_WINDOW;
  const fontSize = large
    ? GUIDE_INSTRUCTION_FONT_SIZE_LARGE
    : GUIDE_INSTRUCTION_FONT_SIZE;
  const lineHeight = large
    ? GUIDE_INSTRUCTION_LINE_HEIGHT_LARGE
    : GUIDE_INSTRUCTION_LINE_HEIGHT;

  return {
    fontSize,
    lineHeight,
    style: {
      fontSize,
      lineHeight,
      fontWeight: tokens.fontWeight.semibold,
    },
  };
}

/**
 * Balanced layout: reserve nav/header, soft max for card, responsive secondary UI.
 */
export function computeGuideLayoutMetrics(
  windowHeight: number,
  topInset: number,
  bottomInset: number,
  hasVoice: boolean,
): GuideLayoutMetrics {
  const typography = getGuideInstructionTypography(windowHeight);

  const headerChrome =
    topInset +
    GUIDE_HEADER_ROW_HEIGHT +
    GUIDE_HEADER_ROW_GAP +
    GUIDE_HEADER_PROGRESS_HEIGHT +
    GUIDE_HEADER_VERTICAL_PAD;

  const navChrome =
    GUIDE_NAV_ROW_HEIGHT +
    GUIDE_NAV_VERTICAL_PAD +
    GUIDE_TAB_BAR_HEIGHT +
    bottomInset;

  const showCalmLine = windowHeight >= HIDE_CALM_WINDOW;
  const voiceCompact = windowHeight < COMPACT_WINDOW;

  const voiceHeight = hasVoice
    ? voiceCompact
      ? GUIDE_VOICE_HEIGHT_COMPACT
      : GUIDE_VOICE_HEIGHT
    : 0;
  const calmHeight = showCalmLine ? GUIDE_CALM_HEIGHT : 0;
  const bodyBreathing = 40;

  const middleSpace = Math.max(
    120,
    windowHeight - headerChrome - navChrome - voiceHeight - calmHeight - bodyBreathing,
  );

  const instructionMaxHeight = Math.floor(middleSpace * GUIDE_CARD_MAX_HEIGHT_RATIO);

  return {
    instructionMaxHeight,
    showCalmLine,
    voiceCompact,
    typography,
  };
}

/** @deprecated */
export function computeGuideInstructionPanelHeight(
  windowHeight: number,
  topInset: number,
  bottomInset: number,
  hasVoice: boolean,
): number {
  return computeGuideLayoutMetrics(windowHeight, topInset, bottomInset, hasVoice)
    .instructionMaxHeight;
}
