/**
 * Calm accordion section — hides secondary tools until the user expands them.
 */

import { useState, type ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { tokens } from "../../src/ui/tokens";
import { useUiDirection } from "./layout";

export type CollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Start expanded (e.g. after primary CTA opens this section) */
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
  style?: ViewStyle;
};

export default function CollapsibleSection({
  title,
  subtitle,
  children,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  style,
}: CollapsibleSectionProps) {
  const { row, chevronForward } = useUiDirection();
  const [internalOpen, setInternalOpen] = useState(defaultExpanded);
  const open = controlledExpanded ?? internalOpen;

  const toggle = () => {
    const next = !open;
    if (controlledExpanded === undefined) setInternalOpen(next);
    onExpandedChange?.(next);
  };

  return (
    <View style={[styles.wrap, style]}>
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.98}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        style={[styles.header, row]}
      >
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron} accessibilityElementsHidden>
          {open ? "▾" : chevronForward}
        </Text>
      </TouchableOpacity>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: tokens.space.lg,
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.xl,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: tokens.space.lg,
    paddingHorizontal: tokens.space.lg,
    gap: tokens.space.md,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textSecondary,
  },
  subtitle: {
    fontSize: tokens.font.caption,
    color: tokens.color.textFaint,
    marginTop: tokens.space.xs,
    fontWeight: tokens.fontWeight.medium,
  },
  chevron: {
    fontSize: 18,
    color: tokens.color.textFaint,
    fontWeight: tokens.fontWeight.medium,
  },
  body: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.sm,
    paddingBottom: tokens.space.lg,
    borderTopWidth: tokens.hairline,
    borderTopColor: tokens.color.border,
    gap: tokens.space.sm,
  },
});
