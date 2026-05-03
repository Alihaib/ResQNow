/**
 * Mission-level ambulance GPS: one watchPositionAsync per app session, survives navigation.
 * Stops only on mission end, manual stop, unassign, or reassignment — not on screen unmount.
 */
import * as Location from "expo-location";
import { doc, getDoc, onSnapshot, updateDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  ambulanceStatusLabel,
  etaMinutesFromDistanceMeters,
  mergePatientSnapshot,
  snapshotPayloadForLifecycle,
  snapshotFromFirestore,
  type PatientSnapshot,
} from "../emergency/patientSnapshot";
import { normalizeLifecycleStatus, type LifecycleStatus } from "../emergency/stateMachine";
import { stripUndefinedDeep } from "../utils/firestoreSanitize";
import { claimEmergencyTransaction } from "./emergencyAssignment";

type AmbulanceGpsSnapshot = {
  isGpsActive: boolean;
  activeEmergencyId: string | null;
  /** Latest coords from the active watch (for UI when attached to this mission). */
  lastCoords: { latitude: number; longitude: number } | null;
  isBootstrapping: boolean;
};

const MIN_WRITE_MS = 3500;

let subscription: Location.LocationSubscription | null = null;
let missionUnsub: Unsubscribe | null = null;
let activeEmergencyId: string | null = null;
let userUid: string | null = null;
let lastWriteAt = 0;

/** Parsed emergency fields needed for Firestore merge writes */
interface EmergencyGpsSource {
  id: string;
  userId?: string;
  location?: { latitude?: number; longitude?: number; address?: string | null };
  patientLocation?: { latitude?: number; longitude?: number; address?: string | null };
  status: LifecycleStatus | string;
  sessionStatus?: "active" | "resolved" | "cancelled";
  assignedAmbulanceId?: string | null;
  currentSnapshot?: PatientSnapshot | null;
}

let latestEmergency: EmergencyGpsSource | null = null;

const listeners = new Set<() => void>();

let snapshot: AmbulanceGpsSnapshot = {
  isGpsActive: false,
  activeEmergencyId: null,
  lastCoords: null,
  isBootstrapping: false,
};

function emit(next: Partial<AmbulanceGpsSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

export function subscribeAmbulanceGps(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAmbulanceGpsSnapshot(): AmbulanceGpsSnapshot {
  return snapshot;
}

function parseEmergencyFromFirestore(id: string, data: Record<string, unknown>): EmergencyGpsSource {
  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : undefined,
    location: data.location as EmergencyGpsSource["location"],
    patientLocation: data.patientLocation as EmergencyGpsSource["patientLocation"],
    status: normalizeLifecycleStatus(data.status),
    sessionStatus: data.sessionStatus as EmergencyGpsSource["sessionStatus"],
    assignedAmbulanceId:
      typeof data.assignedAmbulanceId === "string" ? data.assignedAmbulanceId : null,
    currentSnapshot: snapshotFromFirestore(data.currentSnapshot),
  };
}

function shouldStopTracking(data: Record<string, unknown>, uid: string): boolean {
  const lc = normalizeLifecycleStatus(data.status);
  if (lc === "completed" || lc === "cancelled") return true;
  const ss = data.sessionStatus;
  if (ss === "resolved" || ss === "cancelled") return true;
  const assigned = data.assignedAmbulanceId as string | null | undefined;
  if (!assigned || assigned !== uid) return true;
  return false;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function pushLocationToFirestore(latitude: number, longitude: number) {
  const latest = latestEmergency;
  const latestUid = userUid;
  if (!latest?.id || !latestUid) return;
  const assigned = latest.assignedAmbulanceId;
  if (assigned && assigned !== latestUid) {
    console.log("[ambulanceGpsService] skip GPS write: assigned to another ambulance", assigned);
    return;
  }

  const pat = latest.patientLocation ?? latest.location;
  let distM: number | null = null;
  if (pat && typeof pat.latitude === "number" && typeof pat.longitude === "number") {
    const km = calculateDistance(latitude, longitude, pat.latitude, pat.longitude);
    distM = km * 1000;
  }
  const eta = etaMinutesFromDistanceMeters(distM);
  const lc = normalizeLifecycleStatus(String(latest.status));
  const merged = mergePatientSnapshot(
    latest.currentSnapshot as Record<string, unknown> | undefined,
    {
      eta,
      ambulanceStatus: ambulanceStatusLabel(lc),
    },
    lc,
  );

  await updateDoc(
    doc(db, "emergencies", latest.id),
    stripUndefinedDeep({
      assignedAmbulanceId: assigned ?? latestUid,
      ambulanceLocation: { latitude, longitude },
      updatedAt: new Date().toISOString(),
      currentSnapshot: snapshotPayloadForLifecycle(lc, merged),
    }),
  );

  updateDoc(doc(db, "users", latestUid), {
    lastKnownLocation: { latitude, longitude },
    lastKnownLocationUpdatedAt: new Date().toISOString(),
  }).catch(() => {});
}

async function setGpsActiveFlag(emergencyId: string, active: boolean) {
  try {
    await updateDoc(
      doc(db, "emergencies", emergencyId),
      stripUndefinedDeep({
        gpsActive: active,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch (e) {
    console.warn("[ambulanceGpsService] setGpsActiveFlag:", e);
  }
}

function attachMissionListener(emergencyId: string, uid: string) {
  missionUnsub?.();
  missionUnsub = onSnapshot(
    doc(db, "emergencies", emergencyId),
    (snap) => {
      if (!snap.exists()) {
        void stopAmbulanceGpsTracking("emergency_deleted");
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      latestEmergency = parseEmergencyFromFirestore(snap.id, data);
      if (shouldStopTracking(data, uid)) {
        void stopAmbulanceGpsTracking("mission_end");
      }
    },
    (err) => console.error("[ambulanceGpsService] mission onSnapshot:", err),
  );
}

async function claimIfUnassigned(emergencyId: string, uid: string) {
  const snap = await getDoc(doc(db, "emergencies", emergencyId));
  if (!snap.exists()) return;
  const data = snap.data() as Record<string, unknown>;
  if (data.assignedAmbulanceId) return;
  const res = await claimEmergencyTransaction(emergencyId, uid);
  if (!res.ok && res.reason !== "already_claimed") {
    console.warn("[ambulanceGpsService] claim failed:", res);
  }
}

/**
 * Starts GPS for this mission. No-op if already watching this emergency.
 * If another emergency was active, stops it first.
 */
export async function startAmbulanceGpsTracking(emergencyId: string, uid: string) {
  if (subscription && activeEmergencyId === emergencyId) {
    return;
  }

  if (subscription && activeEmergencyId !== emergencyId) {
    await stopAmbulanceGpsTracking("switch_mission");
  }

  emit({ isBootstrapping: true });

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      emit({ isBootstrapping: false });
      throw new Error("location_permission_denied");
    }

    await claimIfUnassigned(emergencyId, uid);

    const initialSnap = await getDoc(doc(db, "emergencies", emergencyId));
    if (!initialSnap.exists()) {
      emit({ isBootstrapping: false });
      throw new Error("emergency_missing");
    }
    const initData = initialSnap.data() as Record<string, unknown>;
    latestEmergency = parseEmergencyFromFirestore(emergencyId, initData);
    if (shouldStopTracking(initData, uid)) {
      emit({ isBootstrapping: false });
      return;
    }

    userUid = uid;
    activeEmergencyId = emergencyId;

    attachMissionListener(emergencyId, uid);

    try {
      const cur = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (activeEmergencyId !== emergencyId || userUid !== uid) {
        emit({ isBootstrapping: false });
        return;
      }
      const lat = cur.coords.latitude;
      const lng = cur.coords.longitude;
      emit({ lastCoords: { latitude: lat, longitude: lng } });
      const now = Date.now();
      if (now - lastWriteAt >= MIN_WRITE_MS) {
        lastWriteAt = now;
        await pushLocationToFirestore(lat, lng).catch((err) =>
          console.error("[ambulanceGpsService] initial GPS Firestore write:", err),
        );
      }
    } catch (posErr) {
      console.warn("[ambulanceGpsService] getCurrentPositionAsync:", posErr);
    }

    if (activeEmergencyId !== emergencyId || userUid !== uid) {
      emit({ isBootstrapping: false });
      return;
    }

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 4000,
        distanceInterval: 8,
      },
      async (loc) => {
        if (activeEmergencyId !== emergencyId || userUid !== uid) return;
        const latitude = loc.coords.latitude;
        const longitude = loc.coords.longitude;
        emit({ lastCoords: { latitude, longitude } });

        const now = Date.now();
        if (now - lastWriteAt < MIN_WRITE_MS) return;
        lastWriteAt = now;

        try {
          await pushLocationToFirestore(latitude, longitude);
        } catch (writeErr) {
          console.error("[ambulanceGpsService] Firestore location update:", writeErr);
        }
      },
    );

    if (activeEmergencyId !== emergencyId || userUid !== uid) {
      sub.remove();
      emit({ isBootstrapping: false });
      return;
    }

    subscription = sub;
    await setGpsActiveFlag(emergencyId, true);
    emit({
      isGpsActive: true,
      activeEmergencyId: emergencyId,
      isBootstrapping: false,
    });
  } catch (err) {
    console.error("[ambulanceGpsService] startAmbulanceGpsTracking:", err);
    subscription?.remove();
    subscription = null;
    missionUnsub?.();
    missionUnsub = null;
    activeEmergencyId = null;
    userUid = null;
    latestEmergency = null;
    emit({
      isGpsActive: false,
      activeEmergencyId: null,
      lastCoords: null,
      isBootstrapping: false,
    });
    throw err;
  }
}

/**
 * Stops the mission GPS watch and clears global state. Safe to call multiple times.
 */
export async function stopAmbulanceGpsTracking(reason?: string) {
  if (reason) {
    console.log("[ambulanceGpsService] stop:", reason);
  }
  const id = activeEmergencyId;
  subscription?.remove();
  subscription = null;
  missionUnsub?.();
  missionUnsub = null;
  activeEmergencyId = null;
  userUid = null;
  latestEmergency = null;
  lastWriteAt = 0;

  if (id) {
    await setGpsActiveFlag(id, false);
  }

  emit({
    isGpsActive: false,
    activeEmergencyId: null,
    lastCoords: null,
    isBootstrapping: false,
  });
}
