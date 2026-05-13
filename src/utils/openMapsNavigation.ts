/**
 * Cross-platform "open turn-by-turn navigation" helper.
 *
 * Rules baked into this utility (codebase-wide invariants):
 *
 *  1. The `maps://` (Apple Maps) URL scheme is ONLY ever attempted when
 *     `Platform.OS === "ios"` AND `Linking.canOpenURL("maps://")` returns
 *     true. On any other code path (Android, web, Expo Go without the
 *     entitlement, simulator) we never touch it — eliminating the
 *     "Unable to open URL" runtime error.
 *
 *  2. The Google Maps HTTPS URL is the universal fallback. It is plain
 *     HTTPS so it always opens (native maps app on iOS / Android when
 *     installed, system browser otherwise). We intentionally do NOT call
 *     `canOpenURL` on it — HTTPS is always safe to open.
 *
 *  3. The legacy `google.navigation:` Android deep link is NOT used
 *     anywhere. It fails on devices that don't ship Google Maps (some
 *     OEMs, web, certain emulators).
 *
 *  4. If `openURL(appleUrl)` ever rejects (extremely unlikely once gated
 *     by `canOpenURL`), we fall back to the Google Maps HTTPS URL exactly
 *     once. We never retry the Apple Maps URL.
 */

import { Linking, Platform } from "react-native";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type OpenNavigationResult =
  | { ok: true; opened: "apple" | "google" }
  | { ok: false; reason: "invalid_coords" | "failed" };

/** Build the universal Google Maps HTTPS URL for driving directions. */
function buildGoogleMapsUrl(coords: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}`;
}

/** Build the Apple Maps deep-link URL (iOS only). */
function buildAppleMapsUrl(coords: Coordinates): string {
  return `maps://maps.apple.com/?daddr=${coords.latitude},${coords.longitude}`;
}

/**
 * Open external navigation to the given coordinates.
 *
 * Returns a tagged result so the caller can decide whether to alert the
 * user. This function never throws.
 */
export async function openMapsNavigation(
  coords: Coordinates | null | undefined,
): Promise<OpenNavigationResult> {
  if (
    !coords ||
    typeof coords.latitude !== "number" ||
    typeof coords.longitude !== "number" ||
    !Number.isFinite(coords.latitude) ||
    !Number.isFinite(coords.longitude)
  ) {
    return { ok: false, reason: "invalid_coords" };
  }

  const googleUrl = buildGoogleMapsUrl(coords);

  // Apple Maps is gated behind BOTH an iOS check AND a successful canOpenURL
  // probe. Outside iOS we never even build the URL into the open path.
  let canOpenAppleMaps = false;
  if (Platform.OS === "ios") {
    try {
      canOpenAppleMaps = await Linking.canOpenURL("maps://");
    } catch (err) {
      console.warn("[openMapsNavigation] canOpenURL(maps://) failed:", err);
      canOpenAppleMaps = false;
    }
  }

  const primaryUrl =
    Platform.OS === "ios" && canOpenAppleMaps
      ? buildAppleMapsUrl(coords)
      : googleUrl;
  const usedApple = primaryUrl !== googleUrl;

  try {
    await Linking.openURL(primaryUrl);
    return { ok: true, opened: usedApple ? "apple" : "google" };
  } catch (err) {
    console.warn(
      "[openMapsNavigation] primary openURL failed:",
      primaryUrl,
      err,
    );
    // Fall back to the HTTPS Google Maps URL exactly once. Never retry the
    // Apple Maps URL — that is the whole point of this guard.
    if (usedApple) {
      try {
        await Linking.openURL(googleUrl);
        return { ok: true, opened: "google" };
      } catch (fallbackErr) {
        console.error(
          "[openMapsNavigation] google fallback failed:",
          fallbackErr,
        );
      }
    }
    return { ok: false, reason: "failed" };
  }
}
