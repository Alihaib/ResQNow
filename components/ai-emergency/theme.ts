import { Platform, type ViewStyle } from "react-native";
import { elevatedShadow, tokens } from "../../src/ui/tokens";

export const AI_RADIUS = {
  card: 28,
  sheet: 32,
  chip: 999,
  dock: 28,
} as const;

export const aiEmergencyTheme = {
  bg: tokens.color.aiBgSoft,
  primary: tokens.color.aiBlue,
  primarySoft: tokens.color.aiBlueSoft,
  glass: tokens.color.aiGlass,
  glassBorder: tokens.color.aiGlassBorder,
  glow: tokens.color.aiGlow,
  danger: tokens.color.danger,
  text: tokens.color.textPrimary,
  textMuted: tokens.color.textMuted,
  motionMs: tokens.motion.normal,
} as const;

export const glassCardShadow: ViewStyle = {
  ...elevatedShadow,
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: Platform.OS === "android" ? 4 : 3,
};
