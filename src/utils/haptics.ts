import * as Haptics from "expo-haptics";

/** SOS / critical tap — no-op when haptics unavailable. */
export function hapticSosPress(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/** Light confirmation (victim choice, secondary actions). */
export function hapticLight(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Status / ETA update nudge. */
export function hapticNotice(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
