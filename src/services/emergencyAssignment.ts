import { arrayUnion, doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  ambulanceStatusLabel,
  mergePatientSnapshot,
  snapshotPayloadForLifecycle,
} from "../emergency/patientSnapshot";
import {
  canTransitionLifecycle,
  normalizeLifecycleStatus,
  sessionStatusForLifecycle,
  type LifecycleStatus,
} from "../emergency/stateMachine";

/**
 * Single-winner claim: only one ambulance can set assignedAmbulanceId.
 */
export async function claimEmergencyTransaction(emergencyId: string, ambulanceUid: string) {
  const emergencyRef = doc(db, "emergencies", emergencyId);
  const nowIso = new Date().toISOString();

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(emergencyRef);
    if (!snap.exists()) {
      return { ok: false as const, reason: "missing_emergency" as const };
    }
    const data = snap.data() as Record<string, unknown>;
    if (data.sessionStatus !== "active") {
      return { ok: false as const, reason: "session_not_active" as const };
    }
    const existing = data.assignedAmbulanceId as string | null | undefined;
    if (existing) {
      return {
        ok: false as const,
        reason: "already_claimed" as const,
        assignedAmbulanceId: existing,
      };
    }

    const lc = normalizeLifecycleStatus(data.status);
    const snapshot = mergePatientSnapshot(
      data.currentSnapshot as Record<string, unknown> | undefined,
      {
        ambulanceStatus: "Ambulance assigned — en route pending",
      },
      lc,
    );

    tx.update(emergencyRef, {
      assignedAmbulanceId: ambulanceUid,
      assignedAt: nowIso,
      updatedAt: nowIso,
      currentSnapshot: snapshotPayloadForLifecycle(lc, snapshot),
      timeline: arrayUnion({
        status: "claim_ambulance",
        ambulanceId: ambulanceUid,
        timestamp: nowIso,
      }),
    });

    return { ok: true as const, assignedAmbulanceId: ambulanceUid };
  });
}

/**
 * Ambulance-only lifecycle update with transition validation (client-side; rules enforce role).
 */
export async function updateLifecycleTransaction(
  emergencyId: string,
  ambulanceUid: string,
  nextStatus: LifecycleStatus,
) {
  const emergencyRef = doc(db, "emergencies", emergencyId);
  const nowIso = new Date().toISOString();

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(emergencyRef);
    if (!snap.exists()) {
      return { ok: false as const, reason: "missing_emergency" as const };
    }
    const data = snap.data() as Record<string, unknown>;
    if (data.sessionStatus !== "active" && nextStatus !== "completed") {
      return { ok: false as const, reason: "session_not_active" as const };
    }

    const assigned = data.assignedAmbulanceId as string | null | undefined;
    if (!assigned || assigned !== ambulanceUid) {
      return { ok: false as const, reason: "not_assigned_ambulance" as const };
    }

    const current = normalizeLifecycleStatus(data.status);
    if (!canTransitionLifecycle(current, nextStatus)) {
      return { ok: false as const, reason: "invalid_transition" as const, current, attempted: nextStatus };
    }

    const nextSession = sessionStatusForLifecycle(nextStatus);
    const snapshot = mergePatientSnapshot(
      data.currentSnapshot as Record<string, unknown> | undefined,
      {
        ambulanceStatus: ambulanceStatusLabel(nextStatus),
      },
      nextStatus,
    );

    const patch: Record<string, unknown> = {
      status: nextStatus,
      sessionStatus: nextSession,
      updatedAt: nowIso,
      currentSnapshot: snapshotPayloadForLifecycle(nextStatus, snapshot),
      timeline: arrayUnion({
        status: nextStatus,
        ambulanceId: ambulanceUid,
        timestamp: nowIso,
      }),
    };

    tx.update(emergencyRef, patch);
    return { ok: true as const };
  });
}
