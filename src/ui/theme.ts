/**
 * @deprecated Import from `src/ui/tokens` for new code.
 * Compatibility layer so legacy screens pick up the unified palette without
 * per-screen edits in this pass.
 */

import { cardShadow, elevatedShadow, tokens } from "./tokens";

export const theme = {
  colors: {
    bg: tokens.color.bgPage,
    surface: tokens.color.bgSurface,
    text: tokens.color.textPrimary,
    textMuted: tokens.color.textMuted,
    textFaint: tokens.color.textFaint,
    border: tokens.color.border,
    danger: tokens.color.danger,
    dangerDark: tokens.color.dangerDark,
    primary: tokens.color.primary,
    primaryDark: tokens.color.primaryDark,
    warningBg: tokens.color.warningBg,
    warningText: tokens.color.warningText,
    successBg: tokens.color.successBg,
    successText: tokens.color.successText,
  },
  radius: {
    sm: tokens.radius.sm,
    md: tokens.radius.md,
    lg: tokens.radius.lg,
    xl: tokens.radius.xl,
    pill: tokens.radius.pill,
  },
  spacing: {
    xs: tokens.space.xs,
    sm: tokens.space.sm,
    md: tokens.space.md,
    lg: tokens.space.lg,
    xl: tokens.space.xl,
    xxl: tokens.space.xxl,
  },
  typography: {
    title: {
      fontSize: tokens.font.display,
      fontWeight: tokens.fontWeight.heavy,
      letterSpacing: -0.4,
    },
    h1: {
      fontSize: tokens.font.h1,
      fontWeight: tokens.fontWeight.heavy,
      letterSpacing: -0.3,
    },
    h2: {
      fontSize: tokens.font.h2,
      fontWeight: tokens.fontWeight.heavy,
    },
    body: {
      fontSize: tokens.font.bodyLg,
      fontWeight: tokens.fontWeight.medium,
    },
    caption: {
      fontSize: tokens.font.caption,
      fontWeight: tokens.fontWeight.medium,
    },
  },
  shadow: {
    card: cardShadow,
    primary: {
      shadowColor: tokens.color.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 2,
    },
  },
};
