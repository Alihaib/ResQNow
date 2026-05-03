import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { AppState } from "react-native";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "./AuthContext";
import { normalizeLifecycleStatus, type SessionStatus } from "../emergency/stateMachine";
import { snapshotFromFirestore } from "../emergency/patientSnapshot";
import type { CurrentEmergency, LiveEmergency, VictimType } from "../emergency/types";

export type StartEmergencyErrorReason =
  | "already_active"
  | "not_logged_in"
  | "in_progress"
  | "location_permission_denied"
  | "location_not_available"
  | "invalid_payload"
  | "firestore_permission_denied"
  | "network_error"
  | "unknown_error";

type EmergencyContextType = {
  /** Minimal projection — derived from Firestore snapshot */
  currentEmergency: CurrentEmergency | null;
  /** Full doc for active emergency UI (single subscription in this provider) */
  liveEmergency: LiveEmergency | null;
  setCurrentEmergency: (emergency: CurrentEmergency | null) => Promise<void>;
  isEmergencyActive: boolean;
  startingEmergency: boolean;
  navigateToActiveEmergency: () => void;
  startEmergency: (input: {
    victimType: VictimType;
    location: { latitude: number; longitude: number; address?: string | null };
    timestamp?: string;
    locationPermissionStatus?: "granted" | "denied" | "undetermined" | string;
  }) => Promise<
    | { ok: true; id: string }
    | { ok: false; reason: StartEmergencyErrorReason; message?: string }
  >;
  /** Re-query Firestore for an active doc (foreground / recovery) */
  refreshActiveEmergencyFromFirestore: (reason: string) => Promise<void>;
};

const EmergencyContext = createContext<EmergencyContextType>({
  currentEmergency: null,
  liveEmergency: null,
  setCurrentEmergency: async () => {},
  isEmergencyActive: false,
  startingEmergency: false,
  navigateToActiveEmergency: () => {},
  startEmergency: async () => ({ ok: false, reason: "not_logged_in", message: "Not logged in" }),
  refreshActiveEmergencyFromFirestore: async () => {},
});

const STORAGE_KEY_PREFIX = "emergency_";

function storageKeyForUser(uid: string) {
  return `${STORAGE_KEY_PREFIX}${uid}`;
}

function mapSnapToLive(id: string, data: Record<string, unknown>): LiveEmergency {
  const sessionStatus = (data.sessionStatus as SessionStatus) || "active";
  const status = normalizeLifecycleStatus(data.status);
  return {
    id,
    userId: String(data.userId ?? ""),
    sessionStatus,
    status,
    victimType: data.victimType === "other" ? "other" : "me",
    location: data.location as LiveEmergency["location"],
    patientLocation: data.patientLocation as LiveEmergency["patientLocation"],
    assignedAmbulanceId: (data.assignedAmbulanceId as string | null | undefined) ?? null,
    ambulanceLocation: (data.ambulanceLocation as LiveEmergency["ambulanceLocation"]) ?? null,
    currentSnapshot: snapshotFromFirestore(data.currentSnapshot),
    timestamp: typeof data.timestamp === "string" ? data.timestamp : undefined,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
  };
}

export function EmergencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [liveEmergency, setLiveEmergency] = useState<LiveEmergency | null>(null);
  const [subscribedEmergencyId, setSubscribedEmergencyId] = useState<string | null>(null);
  const unsubscribeRef = useRef<null | (() => void)>(null);
  const startingRef = useRef(false);
  const [startingEmergency, setStartingEmergency] = useState(false);
  const lastSyncAtRef = useRef<number>(0);
  const lastUserIdRef = useRef<string | null>(null);

  const stopListening = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  };

  const setCurrentEmergency: EmergencyContextType["setCurrentEmergency"] = async (emergency) => {
    if (!emergency) {
      stopListening();
      setSubscribedEmergencyId(null);
      setLiveEmergency(null);
      if (user?.uid) {
        await SecureStore.deleteItemAsync(storageKeyForUser(user.uid)).catch(() => {});
      }
      return;
    }
    setSubscribedEmergencyId(emergency.id);
    if (user?.uid) {
      await SecureStore.setItemAsync(storageKeyForUser(user.uid), emergency.id).catch(() => {});
    }
  };

  /**
   * Single source of truth: query Firestore for active emergency, subscribe by id.
   */
  const refreshActiveEmergencyFromFirestore = useCallback(
    async (reason: string) => {
      if (!user?.uid) return;

      const now = Date.now();
      const skipDebounce =
        reason === "bootstrap" || reason === "post_create" || reason === "doc_missing";
      if (!skipDebounce && now - lastSyncAtRef.current < 800) {
        return;
      }
      lastSyncAtRef.current = now;

      try {
        const emergenciesRef = collection(db, "emergencies");
        const q = query(
          emergenciesRef,
          where("userId", "==", user.uid),
          where("sessionStatus", "==", "active")
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          stopListening();
          setSubscribedEmergencyId(null);
          setLiveEmergency(null);
          await SecureStore.deleteItemAsync(storageKeyForUser(user.uid)).catch(() => {});
          return;
        }

        if (snap.docs.length > 1) {
          console.warn("[EmergencyContext] multiple active emergencies for user — using newest timestamp");
        }

        const sorted = [...snap.docs].sort((a, b) => {
          const ta = String((a.data() as any).timestamp ?? "");
          const tb = String((b.data() as any).timestamp ?? "");
          return tb.localeCompare(ta);
        });
        const chosen = sorted[0];
        const id = chosen.id;

        setSubscribedEmergencyId(id);
        setLiveEmergency(mapSnapToLive(id, chosen.data() as Record<string, unknown>));
        await SecureStore.setItemAsync(storageKeyForUser(user.uid), id).catch(() => {});
      } catch (e) {
        console.error("[EmergencyContext] refreshActiveEmergencyFromFirestore:", reason, e);
      }
    },
    [user?.uid]
  );

  // Doc listener — only Firestore drives liveEmergency body
  useEffect(() => {
    if (!subscribedEmergencyId) {
      stopListening();
      return;
    }

    stopListening();
    const ref = doc(db, "emergencies", subscribedEmergencyId);
    unsubscribeRef.current = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          await refreshActiveEmergencyFromFirestore("doc_missing");
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        const mapped = mapSnapToLive(snap.id, data);
        setLiveEmergency(mapped);

        if (mapped.sessionStatus === "cancelled" || mapped.sessionStatus === "resolved") {
          stopListening();
          setSubscribedEmergencyId(null);
          setLiveEmergency(null);
          if (user?.uid) {
            await SecureStore.deleteItemAsync(storageKeyForUser(user.uid)).catch(() => {});
          }
        }
      },
      (err) => console.error("[EmergencyContext] emergency listener error:", err)
    );

    return () => stopListening();
  }, [subscribedEmergencyId, user?.uid, refreshActiveEmergencyFromFirestore]);

  const currentEmergency = useMemo((): CurrentEmergency | null => {
    if (!liveEmergency) return null;
    return {
      id: liveEmergency.id,
      sessionStatus: liveEmergency.sessionStatus,
      victimType: liveEmergency.victimType,
      status: liveEmergency.status,
    };
  }, [liveEmergency]);

  const isEmergencyActive = liveEmergency?.sessionStatus === "active";

  const navigateToActiveEmergency = () => {
    router.push("/(tabs)/emergency/active");
  };

  const startEmergency: EmergencyContextType["startEmergency"] = async ({
    victimType,
    location,
    timestamp,
    locationPermissionStatus,
  }) => {
    if (startingRef.current) return { ok: false, reason: "in_progress", message: "IN_PROGRESS" };
    if (!user?.uid) return { ok: false, reason: "not_logged_in", message: "NOT_LOGGED_IN" };

    startingRef.current = true;
    setStartingEmergency(true);
    try {
      // 1) Firestore duplicate guard — never create a second active emergency
      const emergenciesRef = collection(db, "emergencies");
      const activeQ = query(
        emergenciesRef,
        where("userId", "==", user.uid),
        where("sessionStatus", "==", "active")
      );
      const existingSnap = await getDocs(activeQ);
      if (!existingSnap.empty) {
        const sorted = [...existingSnap.docs].sort((a, b) => {
          const ta = String((a.data() as any).timestamp ?? "");
          const tb = String((b.data() as any).timestamp ?? "");
          return tb.localeCompare(ta);
        });
        const existing = sorted[0];
        const id = existing.id;
        setSubscribedEmergencyId(id);
        setLiveEmergency(mapSnapToLive(id, existing.data() as Record<string, unknown>));
        await SecureStore.setItemAsync(storageKeyForUser(user.uid), id).catch(() => {});
        return { ok: true, id };
      }

      if (locationPermissionStatus && locationPermissionStatus !== "granted") {
        return { ok: false, reason: "location_permission_denied", message: "LOCATION_FAILED" };
      }

      if (
        !location ||
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number" ||
        !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude)
      ) {
        return { ok: false, reason: "location_not_available", message: "LOCATION_NOT_AVAILABLE" };
      }

      const id = `${user.uid}_${Date.now()}`;
      const ts = timestamp ?? new Date().toISOString();
      const payload = {
        userId: user.uid,
        victimType,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address ?? null,
        },
        patientLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address ?? null,
        },
        status: "dispatched",
        sessionStatus: "active",
        timestamp: ts,
        updatedAt: new Date().toISOString(),
        timeline: [{ status: "dispatched", timestamp: ts }],
      };

      try {
        await setDoc(doc(db, "emergencies", id), payload);
      } catch (e: any) {
        const code = String(e?.code || "").toLowerCase();
        if (code.includes("permission-denied") || code.includes("permission_denied")) {
          return { ok: false, reason: "firestore_permission_denied", message: "FIRESTORE_PERMISSION_DENIED" };
        }
        if (code.includes("unavailable") || code.includes("network") || code.includes("deadline-exceeded")) {
          return { ok: false, reason: "network_error", message: "NETWORK_ERROR" };
        }
        return { ok: false, reason: "unknown_error", message: e?.message || "UNKNOWN_ERROR" };
      }

      await refreshActiveEmergencyFromFirestore("post_create");
      return { ok: true, id };
    } catch (e) {
      console.error("[EmergencyContext] startEmergency:", e);
      return { ok: false, reason: "unknown_error", message: "Unexpected error" };
    } finally {
      startingRef.current = false;
      setStartingEmergency(false);
    }
  };

  // Bootstrap: SecureStore hint → validate with Firestore query
  useEffect(() => {
    if (!user?.uid) {
      stopListening();
      setSubscribedEmergencyId(null);
      setLiveEmergency(null);
      return;
    }

    (async () => {
      await refreshActiveEmergencyFromFirestore("bootstrap");
    })();
  }, [user?.uid, refreshActiveEmergencyFromFirestore]);

  // Auth user switch cleanup
  useEffect(() => {
    const nextUid = user?.uid ?? null;
    const prevUid = lastUserIdRef.current;
    if (prevUid === nextUid) return;

    stopListening();
    setSubscribedEmergencyId(null);
    setLiveEmergency(null);
    startingRef.current = false;

    if (prevUid) {
      SecureStore.deleteItemAsync(storageKeyForUser(prevUid)).catch(() => {});
    }

    lastUserIdRef.current = nextUid;
  }, [user?.uid]);

  // Foreground refresh
  useEffect(() => {
    if (!user?.uid) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshActiveEmergencyFromFirestore("app_foreground");
      }
    });
    return () => sub.remove();
  }, [user?.uid, refreshActiveEmergencyFromFirestore]);

  const value = useMemo(
    () => ({
      currentEmergency,
      liveEmergency,
      setCurrentEmergency,
      isEmergencyActive,
      startingEmergency,
      navigateToActiveEmergency,
      startEmergency,
      refreshActiveEmergencyFromFirestore,
    }),
    [
      currentEmergency,
      liveEmergency,
      setCurrentEmergency,
      isEmergencyActive,
      startingEmergency,
      startEmergency,
      refreshActiveEmergencyFromFirestore,
    ]
  );

  return <EmergencyContext.Provider value={value}>{children}</EmergencyContext.Provider>;
}

export function useEmergency() {
  return useContext(EmergencyContext);
}

// Legacy exports for files importing types from context
export type { CurrentEmergency, VictimType } from "../emergency/types";
export type EmergencyStatus = "active" | "resolved" | "cancelled";
