import { AI_RADIUS, aiEmergencyTheme } from "../ai-emergency/theme";
import { elevatedShadow, tokens } from "../../src/ui/tokens";

export { AI_RADIUS, aiEmergencyTheme };

export const firstAidTheme = {
  /** Transparent — global AiBackground provides the page backdrop */
  bg: "transparent" as const,
  primary: tokens.color.aiBlue,
  surface: tokens.color.bgSurface,
  glass: tokens.color.aiGlass,
  glassBorder: tokens.color.aiGlassBorder,
  danger: tokens.color.danger,
  text: tokens.color.textPrimary,
  textMuted: tokens.color.textMuted,
  radius: AI_RADIUS.card,
  sheetRadius: AI_RADIUS.sheet,
} as const;

export const firstAidShadow = {
  ...elevatedShadow,
  shadowOpacity: 0.05,
  shadowRadius: 14,
} as const;
