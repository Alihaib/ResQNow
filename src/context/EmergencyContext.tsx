import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
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
  }) => Promise<{ ok: true; id: string } | { ok: false; reason: "already_active" | "not_logged_in" | "in_progress" }>;
};

const EmergencyContext = createContext<EmergencyContextType>({
  currentEmergency: null,
  setCurrentEmergency: async () => {},
  isEmergencyActive: false,
  startingEmergency: false,
  navigateToActiveEmergency: () => {},
  startEmergency: async () => ({ ok: false, reason: "not_logged_in" }),
});

const STORAGE_KEY = "current_emergency_id";

export function EmergencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [currentEmergency, setCurrentEmergencyState] = useState<CurrentEmergency | null>(null);
  const unsubscribeRef = useRef<null | (() => void)>(null);
  const restoringRef = useRef(false);
  const startingRef = useRef(false);
  const [startingEmergency, setStartingEmergency] = useState(false);

  const stopListening = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  };

  const setCurrentEmergency: EmergencyContextType["setCurrentEmergency"] = async (emergency) => {
    setCurrentEmergencyState(emergency);

    if (!emergency) {
      stopListening();
      await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
      return;
    }

    await SecureStore.setItemAsync(STORAGE_KEY, emergency.id).catch(() => {});
  };

  const isEmergencyActive = currentEmergency?.sessionStatus === "active";

  const navigateToActiveEmergency = () => {
    router.push("/(tabs)/emergency/active");
  };

  const startEmergency: EmergencyContextType["startEmergency"] = async ({
    victimType,
    location,
    timestamp,
  }) => {
    if (startingRef.current) return { ok: false, reason: "in_progress" };
    if (!user?.uid) return { ok: false, reason: "not_logged_in" };
    if (currentEmergency?.sessionStatus === "active") return { ok: false, reason: "already_active" };

    startingRef.current = true;
    setStartingEmergency(true);
    try {
      const id = `${user.uid}_${Date.now()}`;
      console.log("[SOS] Creating emergency doc:", id);
      await setDoc(doc(db, "emergencies", id), {
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
      });
      console.log("[SOS] Emergency doc created:", id);

      await setCurrentEmergency({
        id,
        sessionStatus: "active",
        victimType,
        status: "dispatched",
      });

      return { ok: true, id };
    } catch (e) {
      console.error("startEmergency error:", e);
      throw e;
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
    unsubscribeRef.current = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          await setCurrentEmergency(null);
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

        // If emergency is no longer active, clear persisted state.
        if (next.sessionStatus !== "active") {
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
      SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
      return;
    }

    if (restoringRef.current) return;
    restoringRef.current = true;

    (async () => {
      try {
        const storedId = await SecureStore.getItemAsync(STORAGE_KEY);
        if (storedId) {
          const storedRef = doc(db, "emergencies", storedId);
          const storedSnap = await getDoc(storedRef);
          if (storedSnap.exists()) {
            const data = storedSnap.data() as any;
            if (data.userId === user.uid && data.sessionStatus === "active") {
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

        // No stored active emergency: find any active emergency by this user.
        // We intentionally avoid `orderBy(timestamp)` here to prevent requiring a composite index.
        const emergenciesRef = collection(db, "emergencies");
        const q = query(
          emergenciesRef,
          where("userId", "==", user.uid),
          where("sessionStatus", "==", "active")
        );

        // Read one matching doc (any) and then rely on per-doc onSnapshot for realtime.
        const { getDocs } = await import("firebase/firestore");
        const snap = await getDocs(q);
        const first = snap.docs[0];
        if (!first) return;
        const data = first.data() as any;
        await SecureStore.setItemAsync(STORAGE_KEY, first.id).catch(() => {});
        setCurrentEmergencyState({
          id: first.id,
          sessionStatus: "active",
          victimType: (data.victimType as VictimType) || "me",
          status: typeof data.status === "string" ? data.status : undefined,
        });
      } catch (e) {
        console.error("Emergency restore error:", e);
      } finally {
        restoringRef.current = false;
      }
    })();
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

