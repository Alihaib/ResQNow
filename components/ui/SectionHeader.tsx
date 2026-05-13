/**
 * Compact section header used across responder dashboards.
 * Renders an overline ("ACTIVE", "DIRECTORY", "MISSION"…) and a strong title
 * with consistent spacing. Pure presentation — no logic.
 */

import { StyleSheet, Text, View } from "react-native";

type Props = {
  /** Small uppercase tag shown above the title. */
  overline?: string;
  /** Main heading. */
  title: string;
  /** Optional small accent dot (e.g. red for active sections). */
  accent?: string;
  /** Optional element rendered on the right (badge, count, etc.). */
  trailing?: React.ReactNode;
};

export default function SectionHeader({ overline, title, accent, trailing }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        {accent ? <View style={[styles.dot, { backgroundColor: accent }]} /> : null}
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
    marginBottom: 14,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textCol: { flex: 1 },
  overline: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  trailing: { marginLeft: 10 },
});
