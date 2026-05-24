import type { LiveEmergency } from "../emergency/types";

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export function isValidCoord(
  c: { latitude: number; longitude: number } | null | undefined,
): c is { latitude: number; longitude: number } {
  return c != null && isValidLatLng(c.latitude, c.longitude);
}

/** Stable string for skipping redundant `setLiveEmergency` updates. */
export function liveEmergencyFingerprint(e: LiveEmergency | null): string {
  if (!e) return "";
  const snap = e.currentSnapshot;
  return [
    e.id,
    e.sessionStatus,
    e.status,
    e.updatedAt ?? "",
    e.assignedAmbulanceId ?? "",
    e.victimType,
    JSON.stringify(e.patientLocation ?? null),
    JSON.stringify(e.ambulanceLocation ?? null),
    snap?.eta ?? "",
    snap?.ambulanceStatus ?? "",
  ].join("|");
}
