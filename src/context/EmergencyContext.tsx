import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { AppState } from "react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "./AuthContext";

export type EmergencyStatus = "active" | "resolved" | "cancelled";
export type VictimType = "me" | "other";

export type CurrentEmergency = {
  id: string;
  sessionStatus: EmergencyStatus;
  victimType: VictimType;
  status?: string; // lifecycle status (dispatched/en_route/...)
};

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
  currentEmergency: CurrentEmergency | null;
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
};

const EmergencyContext = createContext<EmergencyContextType>({
  currentEmergency: null,
  setCurrentEmergency: async () => {},
  isEmergencyActive: false,
  startingEmergency: false,
  navigateToActiveEmergency: () => {},
  startEmergency: async () => ({ ok: false, reason: "not_logged_in", message: "Not logged in" }),
});

const STORAGE_KEY_PREFIX = "emergency_";

function storageKeyForUser(uid: string) {
  return `${STORAGE_KEY_PREFIX}${uid}`;
}

export function EmergencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [currentEmergency, setCurrentEmergencyState] = useState<CurrentEmergency | null>(null);
  const unsubscribeRef = useRef<null | (() => void)>(null);
  const restoringRef = useRef(false);
  const startingRef = useRef(false);
  const [startingEmergency, setStartingEmergency] = useState(false);
  const lastSyncAtRef = useRef<number>(0);
  const lastUserIdRef = useRef<string | null>(null);

  const stopListening = () => {
    if (unsubscribeRef.current) {
      console.log("[EmergencyContext] listener detach");
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  };

  /**
   * Firestore is the source of truth.
   * Sync current emergency by querying: userId == uid AND sessionStatus == "active".
   * This is safe to call on app foreground / bootstrap.
   */
  const syncActiveEmergencyFromFirestore = async (reason: string) => {
    if (!user?.uid) return;

    // Lightweight debounce to avoid spamming reads on rapid AppState toggles
    const now = Date.now();
    if (now - lastSyncAtRef.current < 1500) return;
    lastSyncAtRef.current = now;

    try {
      console.log("[EmergencyContext] syncActiveEmergencyFromFirestore:", reason);
      const emergenciesRef = collection(db, "emergencies");
      const q = query(
        emergenciesRef,
        where("userId", "==", user.uid),
        where("sessionStatus", "==", "active")
      );
      const snap = await getDocs(q);
      const first = snap.docs[0];

      if (!first) {
        // No active emergency in Firestore → clear local state + storage.
        if (currentEmergency?.sessionStatus === "active") {
          console.log("[EmergencyContext] no active emergency found in Firestore; clearing local state");
        }
        await setCurrentEmergency(null);
        return;
      }

      const data = first.data() as any;
      const restored: CurrentEmergency = {
        id: first.id,
        sessionStatus: "active",
        victimType: (data.victimType as VictimType) || "me",
        status: typeof data.status === "string" ? data.status : undefined,
      };

      console.log("[EmergencyContext] restored active emergency:", restored.id);
      setCurrentEmergencyState(restored);
      await SecureStore.setItemAsync(storageKeyForUser(user.uid), restored.id).catch(() => {});
    } catch (e) {
      console.error("[EmergencyContext] syncActiveEmergencyFromFirestore error:", e);
    }
  };

  const setCurrentEmergency: EmergencyContextType["setCurrentEmergency"] = async (emergency) => {
    setCurrentEmergencyState(emergency);

    if (!emergency) {
      stopListening();
      if (user?.uid) {
        await SecureStore.deleteItemAsync(storageKeyForUser(user.uid)).catch(() => {});
      }
      return;
    }

    if (user?.uid) {
      await SecureStore.setItemAsync(storageKeyForUser(user.uid), emergency.id).catch(() => {});
    }
  };

  const isEmergencyActive = currentEmergency?.sessionStatus === "active";

  const navigateToActiveEmergency = () => {
    router.push("/(tabs)/emergency/active");
  };

  const startEmergency: EmergencyContextType["startEmergency"] = async ({
    victimType,
    location,
    timestamp,
    locationPermissionStatus,
  }) => {
    console.log("[SOS][0] user.uid exists?", !!user?.uid, "uid=", user?.uid ?? null);
    if (startingRef.current) return { ok: false, reason: "in_progress", message: "IN_PROGRESS" };
    if (!user?.uid) return { ok: false, reason: "not_logged_in", message: "NOT_LOGGED_IN" };
    if (currentEmergency?.sessionStatus === "active") return { ok: false, reason: "already_active", message: "ALREADY_ACTIVE" };

    startingRef.current = true;
    setStartingEmergency(true);
    try {
      const id = `${user.uid}_${Date.now()}`;
      console.log("[SOS][1] startEmergency begin:", { id, victimType, uid: user.uid });
      console.log("[SOS][2] locationPermissionStatus:", locationPermissionStatus ?? "unknown");
      console.log("[SOS][3] location input:", location);

      if (locationPermissionStatus && locationPermissionStatus !== "granted") {
        console.warn("[SOS] location permission not granted:", locationPermissionStatus);
        return { ok: false, reason: "location_permission_denied", message: "LOCATION_FAILED" };
      }

      // Explicit null/invalid location guard (do not treat 0 as invalid)
      if (
        !location ||
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number" ||
        !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude)
      ) {
        console.error("[SOS][3] LOCATION_NOT_AVAILABLE:", location);
        return { ok: false, reason: "location_not_available", message: "LOCATION_NOT_AVAILABLE" };
      }

      const payload = {
        userId: user.uid,
        victimType,
        // keep legacy `location` for existing screens, plus explicit `patientLocation`
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
        // lifecycle status
        status: "dispatched",
        // session status for app-wide "is emergency active?"
        sessionStatus: "active",
        timestamp: timestamp ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [{ status: "dispatched", timestamp: timestamp ?? new Date().toISOString() }],
      };
      console.log("[SOS][4] payload before write:", payload);

      // Validation (debug-only): prevent undefined critical fields
      if (
        !payload.patientLocation ||
        typeof payload.patientLocation.latitude !== "number" ||
        typeof payload.patientLocation.longitude !== "number" ||
        !Number.isFinite(payload.patientLocation.latitude) ||
        !Number.isFinite(payload.patientLocation.longitude) ||
        typeof payload.sessionStatus !== "string" ||
        typeof payload.status !== "string" ||
        typeof payload.updatedAt !== "string"
      ) {
        console.error("[SOS] Invalid emergency payload (critical fields missing):", payload);
        return { ok: false, reason: "invalid_payload", message: "INVALID_PAYLOAD" };
      }

      console.log("[SOS][5] Firestore setDoc start");
      try {
        await setDoc(doc(db, "emergencies", id), payload);
      } catch (e: any) {
        // Detailed Firestore error logging
        console.error("[SOS][5] Firestore setDoc FAILED (raw):", e);
        console.error("[SOS][5] Firestore setDoc FAILED details:", {
          name: e?.name,
          code: e?.code,
          message: e?.message,
          stack: e?.stack,
        });

        const code = String(e?.code || "").toLowerCase();
        if (code.includes("permission-denied") || code.includes("permission_denied")) {
          return { ok: false, reason: "firestore_permission_denied", message: "FIRESTORE_PERMISSION_DENIED" };
        }
        if (code.includes("unavailable") || code.includes("network") || code.includes("deadline-exceeded")) {
          return { ok: false, reason: "network_error", message: "NETWORK_ERROR" };
        }
        return { ok: false, reason: "unknown_error", message: e?.message || "UNKNOWN_ERROR" };
      }

      console.log("[SOS][6] Firestore setDoc success:", { id });

      await setCurrentEmergency({
        id,
        sessionStatus: "active",
        victimType,
        status: "dispatched",
      });
      console.log("[SOS][7] context updated after Firestore success:", { id });

      return { ok: true, id };
    } catch (e) {
      console.error("[SOS] startEmergency unexpected error:", e);
      return { ok: false, reason: "unknown_error", message: "Unexpected error" };
    } finally {
      startingRef.current = false;
      setStartingEmergency(false);
    }
  };

  // Attach / refresh listener whenever currentEmergency.id changes.
  useEffect(() => {
    if (!currentEmergency?.id) {
      stopListening();
      return;
    }

    stopListening();

    const ref = doc(db, "emergencies", currentEmergency.id);
    console.log("[EmergencyContext] listener attach:", currentEmergency.id);
    unsubscribeRef.current = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          // Don't immediately clear on transient missing snapshot.
          // Re-sync from Firestore first (e.g. app background/resume, cached state, etc).
          console.warn("[EmergencyContext] current emergency doc missing; resyncing from Firestore");
          await syncActiveEmergencyFromFirestore("doc_missing");
          return;
        }
        const data = snap.data() as any;
        const next: CurrentEmergency = {
          id: snap.id,
          sessionStatus: (data.sessionStatus as EmergencyStatus) || "active",
          victimType: (data.victimType as VictimType) || "me",
          status: typeof data.status === "string" ? data.status : undefined,
        };
        setCurrentEmergencyState(next);

        // Only clear when Firestore explicitly ends the session.
        if (next.sessionStatus === "cancelled" || next.sessionStatus === "resolved") {
          console.log("[EmergencyContext] emergency ended in Firestore:", next.id, next.sessionStatus);
          await setCurrentEmergency(null);
        }
      },
      (err) => {
        console.error("Emergency listener error:", err);
      }
    );

    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmergency?.id]);

  // Restore on app start / auth change:
  // 1) Try stored emergency id
  // 2) Otherwise query any active emergency for this user (avoid composite indexes)
  useEffect(() => {
    if (!user?.uid) {
      restoringRef.current = false;
      setCurrentEmergencyState(null);
      stopListening();
      return;
    }

    if (restoringRef.current) return;
    restoringRef.current = true;

    (async () => {
      try {
        const storedId = await SecureStore.getItemAsync(storageKeyForUser(user.uid));
        if (storedId) {
          const storedRef = doc(db, "emergencies", storedId);
          const storedSnap = await getDoc(storedRef);
          if (storedSnap.exists()) {
            const data = storedSnap.data() as any;
            if (data.userId === user.uid && data.sessionStatus === "active") {
              console.log("[EmergencyContext] restored from SecureStore id:", storedSnap.id);
              setCurrentEmergencyState({
                id: storedSnap.id,
                sessionStatus: "active",
                victimType: (data.victimType as VictimType) || "me",
                status: typeof data.status === "string" ? data.status : undefined,
              });
              return;
            }
          }
        }

        // Firestore source-of-truth restore
        await syncActiveEmergencyFromFirestore("bootstrap");
      } catch (e) {
        console.error("Emergency restore error:", e);
      } finally {
        restoringRef.current = false;
      }
    })();
  }, [user?.uid]);

  // Auth user change isolation:
  // - stop listener immediately
  // - clear local state
  // - clear previous user's persisted emergency key
  useEffect(() => {
    const nextUid = user?.uid ?? null;
    const prevUid = lastUserIdRef.current;
    if (prevUid === nextUid) return;

    console.log("[EmergencyContext] auth user changed:", prevUid, "->", nextUid);

    // Stop listening to previous user's doc
    stopListening();
    setCurrentEmergencyState(null);
    restoringRef.current = false;
    startingRef.current = false;

    if (prevUid) {
      SecureStore.deleteItemAsync(storageKeyForUser(prevUid)).catch(() => {});
    }

    lastUserIdRef.current = nextUid;
  }, [user?.uid]);

  // Foreground/background: when app returns to foreground, re-sync from Firestore.
  useEffect(() => {
    if (!user?.uid) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncActiveEmergencyFromFirestore("app_foreground");
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const value = useMemo(
    () => ({
      currentEmergency,
      setCurrentEmergency,
      isEmergencyActive,
      startingEmergency,
      navigateToActiveEmergency,
      startEmergency,
    }),
    [currentEmergency, isEmergencyActive, startingEmergency]
  );

  return <EmergencyContext.Provider value={value}>{children}</EmergencyContext.Provider>;
}

export function useEmergency() {
  return useContext(EmergencyContext);
}

