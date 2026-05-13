/**
 * Universal white card.
 *
 * Used everywhere a section needs a contained surface (search section,
 * patient info, chat block, emergency case, AI triage row…). Centralising
 * its visual style here guarantees corner radii, border colours, padding
 * and shadows stay in lock-step across every screen.
 *
 * Tone variants:
 *  - "default" : standard white card with subtle border.
 *  - "danger"  : red-bordered surface for active/critical cases.
 *  - "subtle"  : muted background used for nested/secondary blocks.
 *
 * `accentLeft` adds a 4px coloured left bar — for "this is your mission"
 * style emphasis. `compact` removes the inner padding when the consumer
 * needs to render its own layout (lists, custom rows).
 */

import React from "react";
import { StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { cardShadow, tokens } from "../../src/ui/tokens";

type Tone = "default" | "danger" | "subtle";

type Props = ViewProps & {
  tone?: Tone;
  /** Drop inner padding (useful when the card contains custom rows). */
  compact?: boolean;
  /** Show a coloured 4px left stripe — defaults to the danger colour. */
  accentLeft?: boolean | string;
  /** Add a soft elevation (used for the most prominent cards). */
  elevated?: boolean;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
};

export default function Card({
  tone = "default",
  compact,
  accentLeft,
  elevated,
  style,
  children,
  ...rest
}: Props) {
  const accentColor =
    typeof accentLeft === "string" ? accentLeft : tokens.color.danger;
  return (
    <View
      style={[
        styles.base,
        !compact && styles.padded,
        tone === "danger" && styles.danger,
        tone === "subtle" && styles.subtle,
        accentLeft ? { borderLeftWidth: 4, borderLeftColor: accentColor } : null,
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
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  padded: { padding: tokens.space.lg },
  danger: { borderColor: tokens.color.danger, borderWidth: 1.5 },
  subtle: { backgroundColor: tokens.color.bgSubtle },
});
