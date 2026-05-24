import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  runTransaction,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { liveEmergencyFingerprint } from "../utils/emergencyGuards";
import {
  getFirestoreUserMessage,
  isFirestoreIndexError,
  isFirestoreNetworkError,
} from "../utils/firestoreErrors";
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
  | "firestore_index"
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
  /**
   * True after the first active-emergency Firestore sync completes for this session.
   * Prevents SOS UI from treating a transient null `liveEmergency` as “no emergency” during hydration.
   */
  activeEmergencyHydrated: boolean;
  /** True when realtime sync is offline — UI may show last-known snapshot */
  emergencySyncOffline: boolean;
  /** True while attempting to reconnect after offline / foreground */
  emergencySyncReconnecting: boolean;
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
  activeEmergencyHydrated: false,
  emergencySyncOffline: false,
  emergencySyncReconnecting: false,
});

const STORAGE_KEY_PREFIX = "emergency_";

/** Per-user slot doc — transactional create target to reduce duplicate active sessions */
function activeSlotDocId(uid: string) {
  return `${uid}_live`;
}

class SlotActiveError extends Error {
  constructor(
    readonly existingId: string,
    readonly existingData: Record<string, unknown>,
  ) {
    super("ACTIVE_SLOT_OCCUPIED");
    this.name = "SlotActiveError";
  }
}

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
  const subscribedEmergencyIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<null | (() => void)>(null);
  const startingRef = useRef(false);
  const [startingEmergency, setStartingEmergency] = useState(false);
  const lastSyncAtRef = useRef<number>(0);
  const lastUserIdRef = useRef<string | null>(null);
  const liveFingerprintRef = useRef<string>("");
  const [activeEmergencyHydrated, setActiveEmergencyHydrated] = useState(false);
  const [emergencySyncOffline, setEmergencySyncOffline] = useState(false);
  const [emergencySyncReconnecting, setEmergencySyncReconnecting] = useState(false);
  const emergencySyncOfflineRef = useRef(false);

  const applyLiveEmergency = useCallback((next: LiveEmergency | null) => {
    const fp = liveEmergencyFingerprint(next);
    if (fp === liveFingerprintRef.current) return;
    liveFingerprintRef.current = fp;
    setLiveEmergency(next);
  }, []);

  useEffect(() => {
    subscribedEmergencyIdRef.current = subscribedEmergencyId;
  }, [subscribedEmergencyId]);

  useEffect(() => {
    emergencySyncOfflineRef.current = emergencySyncOffline;
  }, [emergencySyncOffline]);

  const attachEmergencySession = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      setSubscribedEmergencyId(id);
      subscribedEmergencyIdRef.current = id;
      applyLiveEmergency(mapSnapToLive(id, data));
      setEmergencySyncOffline(false);
      setEmergencySyncReconnecting(false);
      emergencySyncOfflineRef.current = false;
      if (user?.uid) {
        await SecureStore.setItemAsync(storageKeyForUser(user.uid), id).catch(() => {});
      }
    },
    [user?.uid, applyLiveEmergency],
  );

  const pickNewestActiveDoc = useCallback(
    (docs: { id: string; data: () => Record<string, unknown> }[]) => {
      const sorted = [...docs].sort((a, b) => {
        const ta = String(a.data().timestamp ?? "");
        const tb = String(b.data().timestamp ?? "");
        return tb.localeCompare(ta);
      });
      const chosen = sorted[0];
      return { id: chosen.id, data: chosen.data() as Record<string, unknown> };
    },
    [],
  );

  const stopListening = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  const setCurrentEmergency = useCallback<EmergencyContextType["setCurrentEmergency"]>(
    async (emergency) => {
      if (!emergency) {
        stopListening();
        setSubscribedEmergencyId(null);
        applyLiveEmergency(null);
        if (user?.uid) {
          await SecureStore.deleteItemAsync(storageKeyForUser(user.uid)).catch(() => {});
        }
        return;
      }
      setSubscribedEmergencyId(emergency.id);
      if (user?.uid) {
        await SecureStore.setItemAsync(storageKeyForUser(user.uid), emergency.id).catch(() => {});
      }
    },
    [user?.uid, stopListening, applyLiveEmergency],
  );

  /**
   * Single source of truth: query Firestore for active emergency, subscribe by id.
   */
  const refreshActiveEmergencyFromFirestore = useCallback(
    async (reason: string) => {
      try {
        if (!user?.uid) return;

        if (liveFingerprintRef.current && emergencySyncOfflineRef.current) {
          setEmergencySyncReconnecting(true);
        }

        const now = Date.now();
        const skipDebounce =
          reason === "bootstrap" || reason === "post_create" || reason === "doc_missing";
        if (!skipDebounce && now - lastSyncAtRef.current < 800) {
          return;
        }
        lastSyncAtRef.current = now;

        const emergenciesRef = collection(db, "emergencies");
        const q = query(
          emergenciesRef,
          where("userId", "==", user.uid),
          where("sessionStatus", "==", "active")
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          const subscribedId = subscribedEmergencyIdRef.current;
          if (subscribedId) {
            try {
              const direct = await getDoc(doc(db, "emergencies", subscribedId));
              if (direct.exists()) {
                const data = direct.data() as Record<string, unknown>;
                if (data.sessionStatus === "active") {
                  await attachEmergencySession(direct.id, data);
                  return;
                }
              }
            } catch (directErr) {
              if (isFirestoreNetworkError(directErr)) {
                console.warn("[EmergencyContext] refresh skipped clear (offline):", reason);
                if (liveFingerprintRef.current) setEmergencySyncOffline(true);
                return;
              }
            }
          }
          stopListening();
          setSubscribedEmergencyId(null);
          applyLiveEmergency(null);
          liveFingerprintRef.current = "";
          await SecureStore.deleteItemAsync(storageKeyForUser(user.uid)).catch(() => {});
          return;
        }

        if (snap.docs.length > 1) {
          console.warn("[EmergencyContext] multiple active emergencies for user — using newest timestamp");
        }

        const { id, data } = pickNewestActiveDoc(snap.docs);
        await attachEmergencySession(id, data);
      } catch (e) {
        if (isFirestoreIndexError(e)) {
          console.warn("[EmergencyContext] Firestore index not ready:", reason, e);
        } else if (isFirestoreNetworkError(e)) {
          console.warn("[EmergencyContext] refresh failed (network), keeping last state:", reason);
          if (liveFingerprintRef.current) {
            setEmergencySyncOffline(true);
            emergencySyncOfflineRef.current = true;
          }
        } else {
          console.error("[EmergencyContext] refreshActiveEmergencyFromFirestore:", reason, e);
          if (liveFingerprintRef.current) {
            setEmergencySyncOffline(true);
            emergencySyncOfflineRef.current = true;
          }
        }
      } finally {
        setEmergencySyncReconnecting(false);
        if (user?.uid) {
          setActiveEmergencyHydrated(true);
        }
      }
    },
    [user?.uid, stopListening, applyLiveEmergency, attachEmergencySession, pickNewestActiveDoc],
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
        applyLiveEmergency(mapped);
        setEmergencySyncOffline(false);
        setEmergencySyncReconnecting(false);
        emergencySyncOfflineRef.current = false;

        if (mapped.sessionStatus === "cancelled" || mapped.sessionStatus === "resolved") {
          stopListening();
          setSubscribedEmergencyId(null);
          applyLiveEmergency(null);
          liveFingerprintRef.current = "";
          if (user?.uid) {
            await SecureStore.deleteItemAsync(storageKeyForUser(user.uid)).catch(() => {});
          }
        }
      },
      (err) => {
        if (isFirestoreNetworkError(err)) {
          console.warn("[EmergencyContext] listener offline, retaining last snapshot");
          setEmergencySyncOffline(true);
          emergencySyncOfflineRef.current = true;
          setEmergencySyncReconnecting(false);
          return;
        }
        console.error("[EmergencyContext] emergency listener error:", err);
        setEmergencySyncOffline(true);
        emergencySyncOfflineRef.current = true;
        setEmergencySyncReconnecting(false);
      },
    );

    return () => stopListening();
  }, [subscribedEmergencyId, user?.uid, refreshActiveEmergencyFromFirestore, applyLiveEmergency]);

  const currentEmergency = useMemo((): CurrentEmergency | null => {
    if (!liveEmergency?.id) return null;
    return {
      id: liveEmergency.id,
      sessionStatus: liveEmergency.sessionStatus ?? "active",
      victimType: liveEmergency.victimType === "other" ? "other" : "me",
      status: liveEmergency.status,
    };
  }, [liveEmergency]);

  const isEmergencyActive = useMemo(
    () => liveEmergency?.sessionStatus === "active",
    [liveEmergency?.sessionStatus],
  );

  const navigateToActiveEmergency = useCallback(() => {
    router.push("/(tabs)/emergency/active");
  }, [router]);

  const startEmergency = useCallback<EmergencyContextType["startEmergency"]>(async ({
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
      let existingSnap;
      try {
        existingSnap = await getDocs(activeQ);
      } catch (queryErr) {
        if (isFirestoreIndexError(queryErr)) {
          return {
            ok: false,
            reason: "firestore_index",
            message: getFirestoreUserMessage(queryErr),
          };
        }
        if (isFirestoreNetworkError(queryErr)) {
          return { ok: false, reason: "network_error", message: "NETWORK_ERROR" };
        }
        throw queryErr;
      }
      if (!existingSnap.empty) {
        const { id, data } = pickNewestActiveDoc(existingSnap.docs);
        await attachEmergencySession(id, data);
        return { ok: true, id };
      }

      // Second query — narrow race window before transactional create
      let confirmSnap;
      try {
        confirmSnap = await getDocs(activeQ);
      } catch (queryErr) {
        if (isFirestoreIndexError(queryErr)) {
          return {
            ok: false,
            reason: "firestore_index",
            message: getFirestoreUserMessage(queryErr),
          };
        }
        if (isFirestoreNetworkError(queryErr)) {
          return { ok: false, reason: "network_error", message: "NETWORK_ERROR" };
        }
        throw queryErr;
      }
      if (!confirmSnap.empty) {
        const { id, data } = pickNewestActiveDoc(confirmSnap.docs);
        await attachEmergencySession(id, data);
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

      const id = activeSlotDocId(user.uid);
      const ts = timestamp ?? new Date().toISOString();
      const payload: Record<string, unknown> = {
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

      const slotRef = doc(db, "emergencies", id);

      try {
        await runTransaction(db, async (transaction) => {
          const slotSnap = await transaction.get(slotRef);
          if (slotSnap.exists()) {
            const data = slotSnap.data() as Record<string, unknown>;
            if (data.sessionStatus === "active") {
              throw new SlotActiveError(slotSnap.id, data);
            }
          }
          transaction.set(slotRef, payload);
        });
      } catch (e: unknown) {
        if (e instanceof SlotActiveError) {
          await attachEmergencySession(e.existingId, e.existingData);
          return { ok: true, id: e.existingId };
        }
        if (isFirestoreIndexError(e)) {
          return {
            ok: false,
            reason: "firestore_index",
            message: getFirestoreUserMessage(e),
          };
        }
        const code = String((e as { code?: string })?.code || "").toLowerCase();
        if (code.includes("permission-denied") || code.includes("permission_denied")) {
          return { ok: false, reason: "firestore_permission_denied", message: "FIRESTORE_PERMISSION_DENIED" };
        }
        if (code.includes("unavailable") || code.includes("network") || code.includes("deadline-exceeded")) {
          return { ok: false, reason: "network_error", message: "NETWORK_ERROR" };
        }
        if (isFirestoreNetworkError(e)) {
          return { ok: false, reason: "network_error", message: "NETWORK_ERROR" };
        }
        return {
          ok: false,
          reason: "unknown_error",
          message: getFirestoreUserMessage(e, "UNKNOWN_ERROR"),
        };
      }

      // Attach immediately — do not rely on refresh alone
      await attachEmergencySession(id, payload);
      setActiveEmergencyHydrated(true);

      try {
        const verifySnap = await getDocs(activeQ);
        if (!verifySnap.empty) {
          const { id: newestId, data } = pickNewestActiveDoc(verifySnap.docs);
          if (newestId !== id) {
            console.warn(
              "[EmergencyContext] multiple active emergencies after create — using newest",
            );
            await attachEmergencySession(newestId, data);
            return { ok: true, id: newestId };
          }
        }
      } catch (verifyErr) {
        console.warn("[EmergencyContext] post_create verify skipped:", verifyErr);
      }

      try {
        await refreshActiveEmergencyFromFirestore("post_create");
      } catch (refreshErr) {
        console.warn("[EmergencyContext] post_create refresh failed; local session attached:", refreshErr);
        if (isFirestoreNetworkError(refreshErr)) {
          setEmergencySyncOffline(true);
        }
      }

      return { ok: true, id };
    } catch (e) {
      console.error("[EmergencyContext] startEmergency:", e);
      if (isFirestoreIndexError(e)) {
        return {
          ok: false,
          reason: "firestore_index",
          message: getFirestoreUserMessage(e),
        };
      }
      if (isFirestoreNetworkError(e)) {
        return { ok: false, reason: "network_error", message: "NETWORK_ERROR" };
      }
      return {
        ok: false,
        reason: "unknown_error",
        message: getFirestoreUserMessage(e, "Unexpected error"),
      };
    } finally {
      startingRef.current = false;
      setStartingEmergency(false);
    }
  }, [user?.uid, refreshActiveEmergencyFromFirestore, applyLiveEmergency, attachEmergencySession, pickNewestActiveDoc]);

  // Bootstrap: SecureStore hint → validate with Firestore query
  useEffect(() => {
    if (!user?.uid) {
      stopListening();
      setSubscribedEmergencyId(null);
      applyLiveEmergency(null);
      liveFingerprintRef.current = "";
      setActiveEmergencyHydrated(false);
      setEmergencySyncOffline(false);
      setEmergencySyncReconnecting(false);
      emergencySyncOfflineRef.current = false;
      return;
    }

    setActiveEmergencyHydrated(false);
    setEmergencySyncOffline(false);
    setEmergencySyncReconnecting(false);
    emergencySyncOfflineRef.current = false;
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
    applyLiveEmergency(null);
    liveFingerprintRef.current = "";
    startingRef.current = false;

    if (prevUid) {
      SecureStore.deleteItemAsync(storageKeyForUser(prevUid)).catch(() => {});
    }

    lastUserIdRef.current = nextUid;
    setActiveEmergencyHydrated(false);
    setEmergencySyncOffline(false);
    setEmergencySyncReconnecting(false);
    emergencySyncOfflineRef.current = false;
  }, [user?.uid]);

  // Foreground refresh
  useEffect(() => {
    if (!user?.uid) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (liveFingerprintRef.current && emergencySyncOfflineRef.current) {
          setEmergencySyncReconnecting(true);
        }
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
      activeEmergencyHydrated,
      emergencySyncOffline,
      emergencySyncReconnecting,
    }),
    [
      currentEmergency,
      liveEmergency,
      setCurrentEmergency,
      isEmergencyActive,
      startingEmergency,
      navigateToActiveEmergency,
      startEmergency,
      refreshActiveEmergencyFromFirestore,
      activeEmergencyHydrated,
      emergencySyncOffline,
      emergencySyncReconnecting,
    ],
  );

  return <EmergencyContext.Provider value={value}>{children}</EmergencyContext.Provider>;
}

export function useEmergency() {
  return useContext(EmergencyContext);
}

// Legacy exports for files importing types from context
export type { CurrentEmergency, VictimType } from "../emergency/types";
export type EmergencyStatus = "active" | "resolved" | "cancelled";
