/**
 * Compact section header used across responder dashboards.
 *
 * Renders a small uppercase overline ("ACTIVE", "DIRECTORY", "MISSION"…)
 * and a strong title with consistent spacing. Pure presentation — no logic.
 *
 * The title is sized as `h3` (18pt) — large enough to anchor a section
 * but never so large that it competes with status content or buttons. An
 * optional `accent` dot lets a section subtly signal urgency (red for
 * "live active emergencies", info blue for "dispatched", etc.) without
 * adding a coloured background.
 */

import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../../src/ui/tokens";

type Props = {
  /** Small uppercase tag shown above the title. */
  overline?: string;
  /** Main heading. */
  title: string;
  /** Optional small accent dot (e.g. red for active sections). */
  accent?: string;
  /** Optional element rendered on the right (badge, count, etc.). */
  trailing?: React.ReactNode;
  /** Reduce bottom margin when the header sits inside a card (vs above a list). */
  dense?: boolean;
};

export default function SectionHeader({
  overline,
  title,
  accent,
  trailing,
  dense,
}: Props) {
  return (
    <View style={[styles.wrap, dense && styles.wrapDense]}>
      <View style={styles.left}>
        {accent ? (
          <View style={[styles.dot, { backgroundColor: accent }]} />
        ) : null}
        <View style={styles.textCol}>
          {overline ? (
            <Text style={styles.overline} numberOfLines={1}>
              {overline.toUpperCase()}
            </Text>
          ) : null}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.space.md,
  },
  wrapDense: { marginBottom: tokens.space.sm },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: tokens.space.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textCol: { flex: 1 },
  overline: {
    fontSize: tokens.font.overline,
    fontWeight: "800",
    color: tokens.color.textFaint,
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  title: {
    fontSize: tokens.font.h3,
    fontWeight: "900",
    color: tokens.color.textPrimary,
    letterSpacing: -0.2,
  },
  trailing: { marginLeft: tokens.space.sm },
});
