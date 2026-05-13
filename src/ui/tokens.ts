/**
 * Design tokens — single source of truth for the ResQNow UI system.
 *
 * Spacing is on an 8-point base scale (4 / 8 / 12 / 16 / 24 / 32) so every
 * screen aligns to the same vertical rhythm. Colours, radii, font sizes and
 * shadows are centralised here so we never reinvent them in screen-level
 * StyleSheets again.
 *
 * Anything that is used in more than one screen MUST live here.
 */

import { type ViewStyle } from "react-native";

export const tokens = {
  /** 8-point spacing scale. */
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
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

  /** Semantic colour tokens. */
  color: {
    // Page surfaces
    bgPage: "#F1F5F9",
    bgSurface: "#FFFFFF",
    bgSubtle: "#F8FAFC",

    // Borders / dividers
    border: "#E2E8F0",
    borderStrong: "#CBD5E1",

    // Text
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
    textFaint: "#94A3B8",
    textOnDanger: "#FFFFFF",

    // Brand / accent (red = emergency)
    danger: "#DC2626",
    dangerDark: "#B91C1C",
    dangerBg: "#FEE2E2",

    // Status semantics
    success: "#16A34A",
    successBg: "#ECFDF5",
    successText: "#065F46",
    warning: "#F59E0B",
    warningBg: "#FEF3C7",
    warningText: "#92400E",
    info: "#1D4ED8",
    infoBg: "#DBEAFE",

    // Neutral solid (used for "navigate", "open", quiet primary buttons)
    primarySolid: "#0F172A",
  },

  /** Typography sizes. Weights are left to the consumer ("700" / "800" / "900"). */
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

/** Card-level drop shadow — subtle, used on every white card. */
export const cardShadow: ViewStyle = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 2,
};

/** Elevated shadow — used on the SOS button and the live alert banner only. */
export const elevatedShadow: ViewStyle = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.18,
  shadowRadius: 12,
  elevation: 6,
};
