/**
 * Shared form / detail sub-screen styles (profile, settings nested routes).
 */

import { StyleSheet } from "react-native";
import { pageStyles, tokens } from "../../src/ui/tokens";

export const subScreenStyles = StyleSheet.create({
  screen: pageStyles.screen,
  scroll: {
    ...pageStyles.scrollContent,
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.sm,
    paddingBottom: tokens.space.xxl,
    gap: tokens.space.sm,
  },
  section: {
    marginBottom: tokens.space.xl,
    gap: tokens.space.sm,
  },
  card: {
    marginBottom: tokens.space.lg,
  },
  label: {
    fontSize: tokens.font.label,
    fontWeight: tokens.fontWeight.semibold,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.sm,
  },
  input: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.lg,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    fontSize: tokens.font.title,
    color: tokens.color.textPrimary,
    borderWidth: tokens.hairline,
    borderColor: tokens.color.border,
  },
  body: {
    fontSize: tokens.font.bodyLg,
    fontWeight: tokens.fontWeight.medium,
    color: tokens.color.textSecondary,
    lineHeight: 22,
  },
});
