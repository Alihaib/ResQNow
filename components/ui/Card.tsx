/**
 * Universal white card.
 *
 * Used everywhere a section needs a contained surface (search section,
 * patient info, chat block, emergency case, AI triage row…). Centralising
 * its visual style here guarantees corner radii, border colours, padding
 * and elevation stay in lock-step across every screen.
 *
 * Tone variants:
 *  - "default" : standard white card with a near-invisible hairline border.
 *  - "danger"  : faint red-tinted surface with a soft red border. Used for
 *                "your active mission" / "selected critical patient". The
 *                accent is intentionally restrained — emphasis comes from
 *                a status chip and a left bar, not from a thick red box.
 *  - "subtle"  : muted background used for nested/secondary blocks.
 *
 * `accentLeft` / `accentTop` add a 3px coloured edge bar — for "this is
 * your mission" style emphasis. Pick a single side; both is intentionally
 * not supported.
 *
 * `compact` removes the inner padding when the consumer needs to render
 * its own layout (lists, custom rows, full-bleed media).
 *
 * `elevated` adds the very-subtle drop shadow defined by the token system.
 * Use sparingly — only the most-prominent cards on a screen should be
 * elevated.
 */

import React from "react";
import { StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { cardShadow, tokens } from "../../src/ui/tokens";

type Tone = "default" | "danger" | "subtle";

type Props = ViewProps & {
  tone?: Tone;
  /** Drop inner padding (useful when the card contains custom rows). */
  compact?: boolean;
  /** Coloured 3px left stripe (defaults to the danger colour). */
  accentLeft?: boolean | string;
  /** Coloured 3px top stripe (defaults to the danger colour). */
  accentTop?: boolean | string;
  /** Add a soft elevation (only on the most prominent cards). */
  elevated?: boolean;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
};

const ACCENT_THICKNESS = 3;

export default function Card({
  tone = "default",
  compact,
  accentLeft,
  accentTop,
  elevated,
  style,
  children,
  ...rest
}: Props) {
  const leftColor =
    typeof accentLeft === "string" ? accentLeft : tokens.color.danger;
  const topColor =
    typeof accentTop === "string" ? accentTop : tokens.color.danger;

  return (
    <View
      style={[
        styles.base,
        !compact && styles.padded,
        tone === "danger" && styles.danger,
        tone === "subtle" && styles.subtle,
        accentLeft
          ? { borderLeftWidth: ACCENT_THICKNESS, borderLeftColor: leftColor }
          : null,
        accentTop
          ? { borderTopWidth: ACCENT_THICKNESS, borderTopColor: topColor }
          : null,
        elevated && cardShadow,
        style as ViewStyle,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.lg,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
  },
  padded: { padding: tokens.space.lg },
  danger: {
    backgroundColor: tokens.color.dangerSurface,
    borderColor: tokens.color.dangerBorder,
    borderWidth: tokens.hairline,
  },
  subtle: { backgroundColor: tokens.color.bgSubtle },
});
