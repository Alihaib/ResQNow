/**
 * ResQNow design tokens — single source of truth.
 *
 * Visual direction: calm medical product. Soft page background, white cards,
 * medical blue for primary actions, red reserved for SOS / destructive only.
 */

import { DefaultTheme, type Theme } from "@react-navigation/native";
import { type TextStyle, type ViewStyle } from "react-native";

export const tokens = {
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    huge: 40,
  },

  radius: {
    xs: 8,
    sm: 12,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 28,
    pill: 999,
  },

  hairline: 1,

  color: {
    bgPage: "#F6F8FB",
    bgSurface: "#FFFFFF",
    bgSubtle: "#F1F5F9",

    border: "#E2E8F0",
    borderStrong: "#CBD5E1",

    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
    textFaint: "#94A3B8",
    textOnPrimary: "#FFFFFF",
    textOnDanger: "#FFFFFF",

    /** Medical blue — default primary actions, links, mission accent */
    primary: "#1D4ED8",
    primaryDark: "#1E3A8A",
    primaryBg: "#EFF6FF",
    primaryBorder: "#BFDBFE",
    primarySurface: "#F8FAFF",

    /** Legacy alias used by buttons */
    primarySolid: "#1D4ED8",

    /** AI emergency assistant — calm medical command center */
    aiBlue: "#2563EB",
    aiBlueSoft: "#60A5FA",
    aiBgSoft: "#F4F8FF",
    aiGlass: "rgba(255, 255, 255, 0.72)",
    aiGlassBorder: "rgba(255, 255, 255, 0.85)",
    aiGlow: "rgba(37, 99, 235, 0.28)",

    /** Emergency / destructive only */
    danger: "#DC2626",
    dangerDark: "#B91C1C",
    dangerBg: "#FEF2F2",
    dangerSurface: "#FFFBFB",
    dangerBorder: "#FECACA",

    success: "#16A34A",
    successBg: "#F0FDF4",
    successText: "#166534",
    successBorder: "#BBF7D0",

    warning: "#D97706",
    warningBg: "#FFFBEB",
    warningText: "#92400E",
    warningBorder: "#FDE68A",

    info: "#1D4ED8",
    infoBg: "#EFF6FF",
    infoBorder: "#BFDBFE",

    neutralBg: "#F1F5F9",
    neutralText: "#475569",

    /** Secondary solid actions (end session, quiet confirm) */
    slate: "#475569",
  },

  font: {
    overline: 11,
    caption: 12,
    body: 13,
    bodyLg: 14,
    label: 15,
    title: 16,
    h3: 18,
    h2: 20,
    h1: 24,
    display: 28,
    metric: 32,
    /** Mission ETA — large, calm, scannable */
    eta: 40,
  },

  /** Calm UI motion (ms) */
  motion: {
    fast: 120,
    normal: 180,
    slow: 220,
  },

  fontWeight: {
    medium: "600" as const,
    semibold: "700" as const,
    bold: "800" as const,
    heavy: "900" as const,
  },

  hitSlop: 44,
} as const;

export const cardShadow: ViewStyle = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.03,
  shadowRadius: 3,
  elevation: 1,
};

/** SOS hero and live alert only */
export const elevatedShadow: ViewStyle = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 3,
};

export const textStyles = {
  overline: {
    fontSize: tokens.font.overline,
    fontWeight: tokens.fontWeight.bold,
    color: tokens.color.textFaint,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
  h1: {
    fontSize: tokens.font.h1,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: tokens.font.h2,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: tokens.font.h3,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textSecondary,
    lineHeight: 20,
  },
  caption: {
    fontSize: tokens.font.caption,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textMuted,
    lineHeight: 16,
  },
  metric: {
    fontSize: tokens.font.metric,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    letterSpacing: -0.5,
  },
  eta: {
    fontSize: tokens.font.eta,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.primary,
    letterSpacing: -0.6,
  },
} satisfies Record<string, TextStyle>;

/** Standard page shell — transparent so global AiBackground shows through */
export const pageStyles = {
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  } satisfies ViewStyle,
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "transparent",
  } satisfies ViewStyle,
  content: {
    paddingBottom: tokens.space.xxl,
    backgroundColor: "transparent",
  } satisfies ViewStyle,
  /** Vertical rhythm between major blocks on mission / emergency screens */
  sectionGap: {
    marginBottom: tokens.space.xl,
  } satisfies ViewStyle,
} as const;

/** Navigation stacks / tabs — keep scene content transparent for global backdrop */
export const transparentScreenContent = {
  backgroundColor: "transparent",
} satisfies ViewStyle;

export const stackScreenDefaults = {
  headerShown: false,
  contentStyle: transparentScreenContent,
  cardStyle: transparentScreenContent,
} as const;

export const tabsSceneDefaults = {
  sceneContainerStyle: transparentScreenContent,
  sceneStyle: transparentScreenContent,
} as const;

/** React Navigation default theme paints opaque white — override for global AiBackground */
export const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "transparent",
    card: "transparent",
  },
};
