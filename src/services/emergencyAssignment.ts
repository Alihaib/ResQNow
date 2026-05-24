import { arrayUnion, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  ambulanceStatusLabel,
  mergePatientSnapshot,
  snapshotPayloadForLifecycle,
} from "../emergency/patientSnapshot";
import {
  canTransitionLifecycle,
  lifecycleStatusToFirestore,
  normalizeLifecycleStatus,
  rawStatusAllowsEnRouteToScene,
  sessionStatusForLifecycle,
  type LifecycleStatus,
} from "../emergency/stateMachine";

/**
 * Single-winner accept: only one ambulance can set assignedAmbulanceId.
 *
 * This is the only way an emergency is ever assigned to an ambulance — the
 * app does NOT auto-dispatch the closest unit. After SOS is created the
 * emergency is broadcast (visible to every approved ambulance) and remains
 * unassigned until one human responder taps Accept, which runs this
 * transaction.
 *
 * Idempotency / race safety: the transaction re-reads `assignedAmbulanceId`
 * inside the tx, so if a different ambulance accepted first, this call
 * returns `{ ok: false, reason: "already_claimed", assignedAmbulanceId }`
 * and the caller can show a "case already assigned" message.
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
        ambulanceStatus: "Ambulance accepted — en route pending",
      },
      lc,
    );

    const claimPatch: Record<string, unknown> = {
      assignedAmbulanceId: ambulanceUid,
      assignedAt: nowIso,
      updatedAt: nowIso,
      currentSnapshot: snapshotPayloadForLifecycle(lc, snapshot),
      timeline: arrayUnion({
        status: "ambulance_accepted",
        ambulanceId: ambulanceUid,
        timestamp: nowIso,
      }),
    };
    if (rawStatusAllowsEnRouteToScene(data.status)) {
      claimPatch.status = "accepted";
    }

    tx.update(emergencyRef, claimPatch);

    return { ok: true as const, assignedAmbulanceId: ambulanceUid };
  });
}

/**
 * Release a previously-accepted emergency back to the dispatch pool.
 *
 * Only the ambulance currently holding the case can release it, and only
 * while still in the `dispatched` phase (before the ambulance has marked
 * itself as enRoute). After release the case is back to "available" — it
 * is NOT auto-reassigned to anyone; any approved ambulance can pick it up
 * by tapping Accept.
 *
 * Refuses with:
 *  - "missing_emergency"   — the doc no longer exists
 *  - "session_not_active"  — the caller resolved/cancelled the SOS
 *  - "not_assigned_to_me"  — the caller isn't the current assignee
 *  - "already_in_progress" — case is past `dispatched` (en route / arrived / completed)
 */
export async function releaseEmergencyTransaction(
  emergencyId: string,
  ambulanceUid: string,
) {
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
    if ((data.assignedAmbulanceId as string | null | undefined) !== ambulanceUid) {
      return { ok: false as const, reason: "not_assigned_to_me" as const };
    }
    const lc = normalizeLifecycleStatus(data.status);
    if (lc !== "dispatched") {
      return {
        ok: false as const,
        reason: "already_in_progress" as const,
        current: lc,
      };
    }

    const snapshot = mergePatientSnapshot(
      data.currentSnapshot as Record<string, unknown> | undefined,
      { ambulanceStatus: "Awaiting ambulance" },
      lc,
    );

    tx.update(emergencyRef, {
      assignedAmbulanceId: null,
      assignedAt: null,
      updatedAt: nowIso,
      currentSnapshot: snapshotPayloadForLifecycle(lc, snapshot),
      timeline: arrayUnion({
        status: "ambulance_released",
        ambulanceId: ambulanceUid,
        timestamp: nowIso,
      }),
    });

    return { ok: true as const };
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
      status: lifecycleStatusToFirestore(nextStatus),
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

/**
 * After accept / opening patient screen: mark crew en route to scene.
 * Idempotent if already en route. Never downgrades arrived / completed / cancelled.
 */
export async function markEnRouteToSceneTransaction(
  emergencyId: string,
  ambulanceUid: string,
) {
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

    const assigned = data.assignedAmbulanceId as string | null | undefined;
    if (!assigned || assigned !== ambulanceUid) {
      return { ok: false as const, reason: "not_assigned_ambulance" as const };
    }

    const currentLc = normalizeLifecycleStatus(data.status);
    if (currentLc === "enRoute") {
      return { ok: true as const, skipped: true as const };
    }
    if (currentLc === "arrived" || currentLc === "completed" || currentLc === "cancelled") {
      return {
        ok: false as const,
        reason: "status_not_eligible" as const,
        current: currentLc,
      };
    }

    if (!rawStatusAllowsEnRouteToScene(data.status)) {
      return {
        ok: false as const,
        reason: "status_not_eligible" as const,
        current: currentLc,
      };
    }

    const nextLc: LifecycleStatus = "enRoute";
    const snapshot = mergePatientSnapshot(
      data.currentSnapshot as Record<string, unknown> | undefined,
      {
        ambulanceStatus: ambulanceStatusLabel(nextLc),
      },
      nextLc,
    );

    tx.update(emergencyRef, {
      status: lifecycleStatusToFirestore(nextLc),
      sessionStatus: "active",
      updatedAt: serverTimestamp(),
      currentSnapshot: snapshotPayloadForLifecycle(nextLc, snapshot),
      timeline: arrayUnion({
        status: "en_route_to_scene",
        ambulanceId: ambulanceUid,
        timestamp: nowIso,
      }),
    });

    return { ok: true as const };
  });
}
