import type { LifecycleStatus } from "./stateMachine";
import { stripUndefinedDeep } from "../utils/firestoreSanitize";

export type ConditionLevel = "stable" | "moderate" | "critical";

/** Live view on `emergencies/{id}.currentSnapshot` — maintained by ambulance only. */
export type PatientSnapshot = {
  conditionLevel: ConditionLevel;
  symptoms: string[];
  vitals?: {
    heartRate?: number;
    oxygen?: number;
    bloodPressure?: string;
  };
  ambulanceStatus: string;
  /** ETA to scene in minutes (approximate). */
  eta?: number;
  lastUpdate: number;
};

/** Only while on scene — transport phases must not persist clinical fields on snapshot. */
export function allowsMedicalSnapshotFields(status: LifecycleStatus): boolean {
  return status === "arrived";
}

export function normalizeConditionLevel(raw: unknown): ConditionLevel {
  if (raw === "stable" || raw === "moderate" || raw === "critical") return raw;
  return "moderate";
}

export function snapshotFromFirestore(raw: unknown): PatientSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const symptoms = Array.isArray(o.symptoms)
    ? (o.symptoms as unknown[]).map((s) => String(s)).filter((s) => s.length > 0)
    : [];

  let vitals: PatientSnapshot["vitals"];
  if (o.vitals && typeof o.vitals === "object") {
    const v = o.vitals as Record<string, unknown>;
    vitals = {};
    if (typeof v.heartRate === "number" && Number.isFinite(v.heartRate)) vitals.heartRate = v.heartRate;
    if (typeof v.oxygen === "number" && Number.isFinite(v.oxygen)) vitals.oxygen = v.oxygen;
    if (typeof v.bloodPressure === "string" && v.bloodPressure.trim()) vitals.bloodPressure = v.bloodPressure;
    if (Object.keys(vitals).length === 0) vitals = undefined;
  }

  const base: PatientSnapshot = {
    conditionLevel: normalizeConditionLevel(o.conditionLevel),
    symptoms,
    ambulanceStatus: typeof o.ambulanceStatus === "string" ? o.ambulanceStatus : "",
    lastUpdate:
      typeof o.lastUpdate === "number" && Number.isFinite(o.lastUpdate) ? o.lastUpdate : Date.now(),
  };

  if (vitals) base.vitals = vitals;
  if (typeof o.eta === "number" && Number.isFinite(o.eta)) base.eta = o.eta;

  return base;
}

export function ambulanceStatusLabel(status: LifecycleStatus): string {
  switch (status) {
    case "dispatched":
      return "Dispatched — awaiting ambulance";
    case "enRoute":
      return "En route to patient";
    case "arrived":
      return "Arrived at scene";
    case "completed":
      return "Transport / handoff completed";
    case "cancelled":
      return "Cancelled";
    default:
      return String(status);
  }
}

function mergePatientSnapshotMedical(
  prev: Record<string, unknown> | PatientSnapshot | null | undefined,
  patch: Partial<PatientSnapshot>,
): Record<string, unknown> {
  const p = prev && typeof prev === "object" ? snapshotFromFirestore(prev) : null;

  const symptoms =
    patch.symptoms !== undefined
      ? patch.symptoms.filter((s) => String(s).trim().length > 0).map((s) => String(s).trim())
      : p?.symptoms?.length
        ? p.symptoms
        : [];

  let vitalsOut: Record<string, number | string> | undefined;
  if (patch.vitals !== undefined) {
    const merged = { ...(p?.vitals ?? {}), ...patch.vitals };
    vitalsOut = {};
    for (const [k, val] of Object.entries(merged)) {
      if (val === undefined || val === null) continue;
      vitalsOut[k] = val as number | string;
    }
    if (Object.keys(vitalsOut).length === 0) vitalsOut = undefined;
  } else if (p?.vitals && typeof p.vitals === "object") {
    vitalsOut = {};
    for (const [k, val] of Object.entries(p.vitals)) {
      if (val === undefined || val === null) continue;
      vitalsOut[k] = val as number | string;
    }
    if (Object.keys(vitalsOut).length === 0) vitalsOut = undefined;
  }

  const etaCandidate = patch.eta !== undefined ? patch.eta : p?.eta;
  const hasEta = typeof etaCandidate === "number" && Number.isFinite(etaCandidate);

  const base: Record<string, unknown> = {
    conditionLevel: patch.conditionLevel ?? p?.conditionLevel ?? "moderate",
    symptoms,
    ambulanceStatus: patch.ambulanceStatus ?? p?.ambulanceStatus ?? "",
    lastUpdate: Date.now(),
  };

  if (vitalsOut !== undefined) {
    base.vitals = vitalsOut;
  }
  if (hasEta) {
    base.eta = etaCandidate;
  }

  return stripUndefinedDeep(base) as Record<string, unknown>;
}

/**
 * Merge snapshot patch. Enforces lifecycle phase:
 * - `dispatched` | `enRoute` | `completed` | `cancelled`: only operational fields
 *   (`ambulanceStatus`, `eta`, `lastUpdate`) — no symptoms/vitals/conditionLevel.
 * - `arrived`: full clinical + operational merge.
 */
export function mergePatientSnapshot(
  prev: Record<string, unknown> | PatientSnapshot | null | undefined,
  patch: Partial<PatientSnapshot>,
  lifecycleStatus: LifecycleStatus,
): Record<string, unknown> {
  if (allowsMedicalSnapshotFields(lifecycleStatus)) {
    return mergePatientSnapshotMedical(prev, patch);
  }

  const p = prev && typeof prev === "object" ? snapshotFromFirestore(prev) : null;
  const etaCandidate = patch.eta !== undefined ? patch.eta : p?.eta;
  const hasEta = typeof etaCandidate === "number" && Number.isFinite(etaCandidate);

  const base: Record<string, unknown> = {
    ambulanceStatus: patch.ambulanceStatus ?? p?.ambulanceStatus ?? "",
    lastUpdate: Date.now(),
  };
  if (hasEta) {
    base.eta = etaCandidate;
  }

  return stripUndefinedDeep(base) as Record<string, unknown>;
}

/**
 * Defense-in-depth before Firestore writes: strip clinical keys unless lifecycle is `arrived`.
 * Use after `mergePatientSnapshot` so tampered/partial payloads cannot persist symptoms off-scene.
 */
export function snapshotPayloadForLifecycle(
  lifecycleStatus: LifecycleStatus,
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  if (allowsMedicalSnapshotFields(lifecycleStatus)) {
    return stripUndefinedDeep(snapshot) as Record<string, unknown>;
  }
  const out: Record<string, unknown> = { ...snapshot };
  delete out.symptoms;
  delete out.conditionLevel;
  delete out.vitals;
  return stripUndefinedDeep(out) as Record<string, unknown>;
}

/** Rough ETA minutes from distance (m) at 40 km/h average — matches doctor UI heuristic. */
export function etaMinutesFromDistanceMeters(distanceMeters: number | null): number | undefined {
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) return undefined;
  const speedKmh = 40;
  const speedMPerMin = (speedKmh * 1000) / 60;
  const mins = Math.max(1, Math.round(distanceMeters / speedMPerMin));
  return mins;
}
