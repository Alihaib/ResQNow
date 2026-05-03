import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  etaMinutesFromDistanceMeters,
  mergePatientSnapshot,
  snapshotPayloadForLifecycle,
} from "../emergency/patientSnapshot";
import type { LifecycleStatus } from "../emergency/stateMachine";
import { normalizeLifecycleStatus } from "../emergency/stateMachine";

type LatLng = { latitude: number; longitude: number };

function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const dLat = (b.latitude - a.latitude) * (Math.PI / 180);
  const dLon = (b.longitude - a.longitude) * (Math.PI / 180);
  const lat1 = a.latitude * (Math.PI / 180);
  const lat2 = b.latitude * (Math.PI / 180);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

type AutoDispatchOptions = {
  excludeAmbulanceIds?: string[];
};

/**
 * Auto-assign closest ambulance. Keeps lifecycle `dispatched` until ambulance advances status.
 */
export async function autoDispatchEmergency(input: {
  emergencyId: string;
  patientLocation: LatLng;
  options?: AutoDispatchOptions;
}) {
  const { emergencyId, patientLocation, options } = input;
  const exclude = new Set(options?.excludeAmbulanceIds ?? []);

  const usersRef = collection(db, "users");
  const q = query(usersRef, where("role", "==", "ambulance"), where("approved", "==", true));
  const snap = await getDocs(q);

  let closest: { uid: string; distanceMeters: number } | null = null;

  for (const d of snap.docs) {
    if (exclude.has(d.id)) continue;
    const data = d.data() as any;
    const loc = data.lastKnownLocation;
    const lat = loc?.latitude;
    const lng = loc?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") continue;

    const distanceMeters = haversineMeters(patientLocation, { latitude: lat, longitude: lng });
    if (!closest || distanceMeters < closest.distanceMeters) {
      closest = { uid: d.id, distanceMeters };
    }
  }

  if (!closest) {
    return { ok: true as const, assigned: false as const, reason: "no_ambulance_locations" as const };
  }

  const emergencyRef = doc(db, "emergencies", emergencyId);
  const nowIso = new Date().toISOString();

  return await runTransaction(db, async (tx) => {
    const emergencySnap = await tx.get(emergencyRef);
    if (!emergencySnap.exists()) {
      return { ok: false as const, assigned: false as const, reason: "missing_emergency" as const };
    }

    const data = emergencySnap.data() as any;
    if (data.assignedAmbulanceId) {
      return {
        ok: true as const,
        assigned: false as const,
        reason: "already_assigned" as const,
        assignedAmbulanceId: data.assignedAmbulanceId as string,
      };
    }
    if (data.sessionStatus !== "active") {
      return { ok: true as const, assigned: false as const, reason: "session_not_active" as const };
    }

    const etaMin = etaMinutesFromDistanceMeters(closest.distanceMeters);
    const dispatchPhase: LifecycleStatus = "dispatched";
    const snapshot = mergePatientSnapshot(
      data.currentSnapshot as Record<string, unknown> | undefined,
      {
        ambulanceStatus: "Nearest ambulance auto-assigned",
        eta: etaMin,
      },
      dispatchPhase,
    );

    tx.update(emergencyRef, {
      assignedAmbulanceId: closest.uid,
      assignedAt: nowIso,
      updatedAt: nowIso,
      currentSnapshot: snapshotPayloadForLifecycle(dispatchPhase, snapshot),
      timeline: arrayUnion({
        status: "auto_assigned",
        ambulanceId: closest.uid,
        timestamp: nowIso,
      }),
    });

    return {
      ok: true as const,
      assigned: true as const,
      assignedAmbulanceId: closest.uid,
      distanceMeters: closest.distanceMeters,
    };
  });
}

export async function rejectAndReassignEmergency(input: {
  emergencyId: string;
  rejectingAmbulanceId: string;
  patientLocation: LatLng;
}) {
  const { emergencyId, rejectingAmbulanceId, patientLocation } = input;
  const emergencyRef = doc(db, "emergencies", emergencyId);
  const nowIso = new Date().toISOString();

  const res = await runTransaction(db, async (tx) => {
    const snap = await tx.get(emergencyRef);
    if (!snap.exists()) return { ok: false as const, reason: "missing_emergency" as const };
    const data = snap.data() as any;

    if (data.sessionStatus !== "active") {
      return { ok: true as const, reassigned: false as const, reason: "session_not_active" as const };
    }

    const assigned = data.assignedAmbulanceId ?? null;
    if (assigned !== rejectingAmbulanceId) {
      return { ok: true as const, reassigned: false as const, reason: "assigned_to_other" as const };
    }

    const lifecycle = normalizeLifecycleStatus(data.status);
    // Only reassign while ambulance has not left "dispatched" (hasn't acknowledged enRoute).
    if (lifecycle !== "dispatched") {
      return { ok: true as const, reassigned: false as const, reason: "already_in_progress" as const };
    }

    const attempts = typeof data.assignmentAttempts === "number" ? data.assignmentAttempts : 0;
    const maxAttempts = typeof data.maxAttempts === "number" ? data.maxAttempts : 3;
    const history: string[] = Array.isArray(data.assignmentHistory) ? data.assignmentHistory : [];
    const nextAttempts = attempts + 1;
    const nextHistory = history.includes(rejectingAmbulanceId) ? history : [...history, rejectingAmbulanceId];

    if (nextAttempts >= maxAttempts) {
      tx.update(emergencyRef, {
        assignmentAttempts: nextAttempts,
        maxAttempts,
        assignmentHistory: nextHistory,
        assignedAmbulanceId: null,
        assignedAt: null,
        updatedAt: nowIso,
        timeline: arrayUnion({
          status: "dispatch_exhausted",
          ambulanceId: rejectingAmbulanceId,
          timestamp: nowIso,
        }),
      });
      return { ok: true as const, reassigned: false as const, reason: "max_attempts_reached" as const };
    }

    tx.update(emergencyRef, {
      assignmentAttempts: nextAttempts,
      maxAttempts,
      assignmentHistory: nextHistory,
      assignedAmbulanceId: null,
      assignedAt: null,
      updatedAt: nowIso,
      timeline: arrayUnion({
        status: "rejected",
        ambulanceId: rejectingAmbulanceId,
        timestamp: nowIso,
      }),
    });

    return { ok: true as const, reassigned: true as const, excludeIds: nextHistory };
  });

  if (!(res as any).ok) return res;
  if ((res as any).reason === "max_attempts_reached") return res;
  if ((res as any).reassigned !== true) return res;

  const excludeIds: string[] = (res as any).excludeIds ?? [rejectingAmbulanceId];
  return await autoDispatchEmergency({
    emergencyId,
    patientLocation,
    options: { excludeAmbulanceIds: excludeIds },
  });
}
