/**
 * Design tokens — single source of truth for the ResQNow UI system.
 *
 * Spacing is on an 8-point base scale (4 / 8 / 12 / 16 / 20 / 24 / 32). Every
 * screen aligns to the same vertical rhythm so the UI feels exact and calm.
 *
 * Borders are deliberately light and shadows are deliberately subtle. This
 * is a medical control system — emphasis comes from typography hierarchy
 * and meaningful colour, not heavy outlines or drop shadows.
 *
 * Anything that is used in more than one screen MUST live here.
 */

import { type ViewStyle } from "react-native";

export const tokens = {
  /**
   * 8-point spacing scale.
   *
   * Use these names everywhere — never inline `12`, `16`, `24` numbers in
   * StyleSheets. NEVER use arithmetic (`+ 2`, `+ 4`) on these tokens: pick
   * the nearest semantic step. If a layout needs an off-grid value, that's
   * a signal that the design is reaching for a value the system doesn't
   * support yet — extend the scale here instead of patching at the call
   * site.
   */
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    huge: 40,
  },

  /** Border radii. */
  radius: {
    xs: 6,
    sm: 10,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },

  /** Hairline border width — keep dividers light. */
  hairline: 1,

  /** Semantic colour tokens. */
  color: {
    // Page surfaces
    bgPage: "#F4F6F9",
    bgSurface: "#FFFFFF",
    bgSubtle: "#F8FAFC",

    // Borders / dividers (use these by default — kept light on purpose)
    border: "#E5E8EE",
    borderStrong: "#CBD5E1",

    // Text — tuned for high readability on white surfaces.
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
    textFaint: "#94A3B8",
    textOnDanger: "#FFFFFF",

    // Brand / accent (red = emergency)
    danger: "#DC2626",
    dangerDark: "#B91C1C",
    dangerBg: "#FEE2E2",
    /** Tinted surface used as the "live mission" card background — calm, not loud. */
    dangerSurface: "#FFF7F7",
    dangerBorder: "#FECACA",

    // Status semantics
    success: "#16A34A",
    successBg: "#ECFDF5",
    successText: "#065F46",
    successBorder: "#A7F3D0",
    warning: "#F59E0B",
    warningBg: "#FEF3C7",
    warningText: "#92400E",
    info: "#1D4ED8",
    infoBg: "#DBEAFE",
    infoBorder: "#BFDBFE",

    // Neutral solid (used for "navigate", "open", quiet primary buttons)
    primarySolid: "#0F172A",
    /** Slate used for the "End emergency" / non-destructive heavy buttons. */
    slate: "#475569",
  },

  /** Typography sizes. Weights are inline strings ("700" / "800" / "900"). */
  font: {
    overline: 11,
    caption: 12,
    body: 13,
    bodyLg: 14,
    label: 15,
    title: 16,
    h3: 18,
    h2: 22,
    h1: 28,
    display: 32,
  },

  /** Minimum touch target — keep all tap surfaces at or above this. */
  hitSlop: 44,
} as const;

/**
 * Card-level drop shadow — very subtle. Used on every white card so that
 * cards float above the page surface without competing for attention.
 */
export const cardShadow: ViewStyle = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 4,
  elevation: 1,
};

/**
 * Elevated shadow — used sparingly: the SOS button and the live alert
 * banner. NEVER use this for ambient cards.
 */
export const elevatedShadow: ViewStyle = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.14,
  shadowRadius: 12,
  elevation: 5,
};
