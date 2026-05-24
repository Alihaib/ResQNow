/**
 * Real-time activity feed derived from `emergencies[].timeline` entries.
 *
 * The hook returns the data already grouped **per emergency** (not per event):
 *
 *   [
 *     {
 *       emergencyId: "abc123",
 *       latestTimestamp: 1747600000000,   // ms — newest event in this group
 *       events: [ ActivityFeedItem, ... ] // newest → oldest
 *     },
 *     ...
 *   ]
 *
 * Queries (aligned with `firestore.rules`):
 *  - Approved doctor / ambulance / admin → `emergencies` ordered by `updatedAt`
 *    desc (operational picture across all cases).
 *  - Everyone else → `emergencies` where `userId == uid`, ordered by
 *    `timestamp` desc (the caller's own history).
 *
 * Grouping happens **after** each `onSnapshot` payload, so realtime updates
 * still flow through unchanged: every doc change (new SOS, accept, release,
 * lifecycle update, cancel, complete) refires the listener and produces a
 * fresh grouped snapshot. No writes — pure read-only aggregation.
 */

import {
  collection,
  limit as firestoreLimit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Query,
  type QuerySnapshot,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase/config";
import { isFirestoreIndexError } from "../utils/firestoreErrors";

export type ActivityFeedItem = {
  /** Stable key for FlatList / map renders. */
  id: string;
  emergencyId: string;
  /** Raw timeline `status` string (lifecycle value or semantic token). */
  eventType: string;
  timestampIso: string;
  ambulanceId?: string;
  noteText?: string;
};

export type ActivityFeedGroup = {
  emergencyId: string;
  /** Newest event timestamp for this group, in ms since epoch (NaN-safe). */
  latestTimestamp: number;
  /** Events for this emergency, sorted newest → oldest. Always ≥ 1. */
  events: ActivityFeedItem[];
};

const DEFAULT_MAX_GROUPS = 20;
const RESPONDER_DOC_LIMIT = 40;
const PATIENT_DOC_LIMIT = 20;

function isApprovedResponder(role: string | undefined, approved: boolean | undefined) {
  return (
    (role === "doctor" && approved === true) ||
    (role === "ambulance" && approved === true) ||
    role === "admin"
  );
}

function buildQuery(
  uid: string | undefined,
  role: string | undefined,
  approved: boolean | undefined,
): Query | null {
  if (!uid) return null;
  const ref = collection(db, "emergencies");
  if (isApprovedResponder(role, approved)) {
    return query(ref, orderBy("updatedAt", "desc"), firestoreLimit(RESPONDER_DOC_LIMIT));
  }
  return query(
    ref,
    where("userId", "==", uid),
    orderBy("timestamp", "desc"),
    firestoreLimit(PATIENT_DOC_LIMIT),
  );
}

/**
 * Parse + group a Firestore snapshot into per-emergency activity groups.
 *
 * 1. For each emergency doc, flatten every well-formed `timeline` entry into
 *    an `ActivityFeedItem` (skip malformed/timestamp-less entries).
 * 2. Bucket items by `emergencyId`. Drop emergencies that contributed zero
 *    valid events — they would render as empty cards.
 * 3. Sort each bucket's events newest → oldest.
 * 4. Sort groups newest → oldest by their newest event.
 * 5. Cap to `maxGroups` (default 20 emergencies, NOT 20 events).
 */
function parseAndGroupTimeline(
  snap: QuerySnapshot,
  maxGroups: number,
): ActivityFeedGroup[] {
  const byEmergency = new Map<string, ActivityFeedItem[]>();

  snap.docs.forEach((docSnap) => {
    const emergencyId = docSnap.id;
    const data = docSnap.data() as Record<string, unknown>;
    const timeline = Array.isArray(data.timeline) ? data.timeline : [];

    timeline.forEach((entry: unknown, ti: number) => {
      if (!entry || typeof entry !== "object") return;
      const e = entry as Record<string, unknown>;
      const status = typeof e.status === "string" ? e.status : "unknown";
      const ts = typeof e.timestamp === "string" ? e.timestamp : "";
      if (!ts) return;
      const ambulanceId = typeof e.ambulanceId === "string" ? e.ambulanceId : undefined;
      const text = typeof e.text === "string" ? e.text : undefined;

      const item: ActivityFeedItem = {
        id: `${emergencyId}:${ti}:${ts}:${status}:${ambulanceId ?? ""}`,
        emergencyId,
        eventType: status,
        timestampIso: ts,
        ambulanceId,
        noteText: text,
      };

      const bucket = byEmergency.get(emergencyId);
      if (bucket) bucket.push(item);
      else byEmergency.set(emergencyId, [item]);
    });
  });

  const groups: ActivityFeedGroup[] = [];

  byEmergency.forEach((events, emergencyId) => {
    if (events.length === 0) return;
    // Newest → oldest within the group.
    events.sort((a, b) => compareIsoDesc(a.timestampIso, b.timestampIso));
    const latestMs = Date.parse(events[0].timestampIso);
    groups.push({
      emergencyId,
      latestTimestamp: Number.isFinite(latestMs) ? latestMs : 0,
      events,
    });
  });

  // Newest emergency first, by its newest event.
  groups.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

  return groups.slice(0, maxGroups);
}

function compareIsoDesc(a: string, b: string) {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isFinite(tb) && Number.isFinite(ta)) return tb - ta;
  // Fallback: ISO strings sort lexicographically the same way they sort
  // chronologically when both are valid ISO-8601, which is what the
  // emergency timeline writes everywhere in the codebase.
  return String(b).localeCompare(String(a));
}

export function useEmergencyActivityFeed(
  uid: string | undefined,
  role: string | undefined,
  approved: boolean | undefined,
  maxGroups: number = DEFAULT_MAX_GROUPS,
) {
  const [groups, setGroups] = useState<ActivityFeedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const q = useMemo(() => buildQuery(uid, role, approved), [uid, role, approved]);

  useEffect(() => {
    if (!q) {
      setGroups([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      q,
      (snap) => {
        try {
          setGroups(parseAndGroupTimeline(snap, maxGroups));
        } catch (e) {
          console.error("[useEmergencyActivityFeed] parse error:", e);
          setGroups([]);
          setError("parse_failed");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        if (isFirestoreIndexError(err)) {
          console.warn("[useEmergencyActivityFeed] Firestore index not ready:", err);
          setError("firestore_index");
        } else {
          console.error("[useEmergencyActivityFeed] listener error:", err);
          setError((err as { message?: string })?.message || "listener_failed");
        }
        setGroups([]);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [q, maxGroups]);

  return { groups, loading, error };
}
