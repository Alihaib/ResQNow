import type { LifecycleStatus, SessionStatus } from "./stateMachine";
import type { PatientSnapshot } from "./patientSnapshot";

export type VictimType = "me" | "other";

/** Caller-facing projection (backward compatible). */
export type CurrentEmergency = {
  id: string;
  sessionStatus: SessionStatus;
  victimType: VictimType;
  status?: LifecycleStatus;
};

/** Full Firestore-aligned snapshot for UI (caller + active screen). */
export type LiveEmergency = {
  id: string;
  userId: string;
  sessionStatus: SessionStatus;
  status: LifecycleStatus;
  victimType: VictimType;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string | null;
  };
  patientLocation?: {
    latitude?: number;
    longitude?: number;
    address?: string | null;
  };
  assignedAmbulanceId?: string | null;
  ambulanceLocation?: { latitude?: number; longitude?: number } | null;
  /** Ambulance-maintained live view; optional until first write. */
  currentSnapshot?: PatientSnapshot | null;
  timestamp?: string;
  updatedAt?: string;
};
