/**
 * Canonical emergency lifecycle — Firestore `status` + `sessionStatus` must stay aligned.
 */

export type SessionStatus = "active" | "resolved" | "cancelled";

/** Lifecycle while session is active or terminal completion */
export type LifecycleStatus = "dispatched" | "enRoute" | "arrived" | "completed" | "cancelled";

const LEGACY_MAP: Record<string, LifecycleStatus> = {
  dispatched: "dispatched",
  enRoute: "enRoute",
  arrived: "arrived",
  completed: "completed",
  cancelled: "cancelled",
  en_route: "enRoute",
  en_route_to_scene: "enRoute",
  arrived_patient: "arrived",
  patient_picked: "arrived",
  en_route_hospital: "enRoute",
  assigned: "dispatched",
  unassigned: "dispatched",
  assigned_ambulance: "dispatched",
  accepted: "dispatched",
  ambulance_accepted: "dispatched",
};

/** Firestore `status` string for lifecycle writes (legacy snake_case where needed). */
export function lifecycleStatusToFirestore(lc: LifecycleStatus): string {
  if (lc === "enRoute") return "en_route_to_scene";
  return lc;
}

/** True when ambulance may auto-set en_route_to_scene (does not override terminal / en-route states). */
export function rawStatusAllowsEnRouteToScene(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower === "arrived" ||
    lower === "completed" ||
    lower === "cancelled" ||
    lower === "enroute" ||
    lower === "en_route" ||
    lower === "en_route_to_scene" ||
    lower === "en_route_hospital" ||
    lower === "arrived_patient"
  ) {
    return false;
  }
  if (lower === "dispatched" || lower === "accepted" || lower === "ambulance_accepted") {
    return true;
  }
  return normalizeLifecycleStatus(trimmed) === "dispatched";
}

/** Patient screen may promote to en_route_to_scene only from post-accept states. */
export function shouldMarkEnRouteOnPatientScreenOpen(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const lower = raw.trim().toLowerCase();
  return lower === "accepted" || lower === "ambulance_accepted" || lower === "dispatched";
}

/** Normalize stored Firestore status (supports legacy snake_case values). */
export function normalizeLifecycleStatus(raw: unknown): LifecycleStatus {
  if (typeof raw !== "string") return "dispatched";
  const trimmed = raw.trim();
  if (trimmed in LEGACY_MAP) return LEGACY_MAP[trimmed];
  if (
    trimmed === "dispatched" ||
    trimmed === "enRoute" ||
    trimmed === "arrived" ||
    trimmed === "completed" ||
    trimmed === "cancelled"
  ) {
    return trimmed as LifecycleStatus;
  }
  return "dispatched";
}

export function sessionStatusForLifecycle(lifecycle: LifecycleStatus): SessionStatus {
  if (lifecycle === "completed") return "resolved";
  if (lifecycle === "cancelled") return "cancelled";
  return "active";
}

/** Ordered progression while session is active (no skipping). */
export const LIFECYCLE_ORDER: LifecycleStatus[] = ["dispatched", "enRoute", "arrived", "completed"];

export function lifecycleIndex(s: LifecycleStatus): number {
  const i = LIFECYCLE_ORDER.indexOf(s);
  return i >= 0 ? i : -1;
}

export function canTransitionLifecycle(from: LifecycleStatus, to: LifecycleStatus): boolean {
  if (to === "cancelled") return from !== "completed" && from !== "cancelled";
  if (from === "cancelled" || from === "completed") return false;
  const iFrom = lifecycleIndex(from);
  const iTo = lifecycleIndex(to);
  if (iFrom < 0 || iTo < 0) return false;
  // Only forward by one step, except dispatched already allowed at start
  return iTo === iFrom + 1 || (from === "dispatched" && to === "enRoute" && iTo === 1);
}
