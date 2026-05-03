/**
 * Map helpers for `emergencies/{id}` location fields (Firestore snapshot shapes only).
 * Keeps lat/lng parsing in one place for patient + doctor live maps.
 */
export function parseLatLng(
  loc: { latitude?: unknown; longitude?: unknown } | null | undefined,
): { latitude: number; longitude: number } | null {
  if (!loc || typeof loc !== "object") return null;
  const lat = (loc as { latitude?: unknown }).latitude;
  const lng = (loc as { longitude?: unknown }).longitude;
  if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng };
  }
  return null;
}
