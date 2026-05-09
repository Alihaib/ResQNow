/**
 * TYPE 4 — Edge Case & Boundary Tests
 *
 * Targets null / undefined inputs, non-finite numbers, invalid strings,
 * illegal state-machine transitions, and minimum / maximum boundary values.
 * These tests confirm defensive logic works under hostile or unexpected data.
 */

import {
  normalizeLifecycleStatus,
  canTransitionLifecycle,
  lifecycleIndex,
  sessionStatusForLifecycle,
} from "../src/emergency/stateMachine";

import { stripUndefinedDeep } from "../src/utils/firestoreSanitize";
import { parseLatLng } from "../src/utils/emergencyMapCoords";
import {
  etaMinutesFromDistanceMeters,
  normalizeConditionLevel,
  snapshotFromFirestore,
} from "../src/emergency/patientSnapshot";

// ─── normalizeLifecycleStatus — hostile / unexpected inputs ───────────────────

describe("normalizeLifecycleStatus — hostile inputs", () => {
  test("null → 'dispatched'", () => {
    expect(normalizeLifecycleStatus(null)).toBe("dispatched");
  });

  test("undefined → 'dispatched'", () => {
    expect(normalizeLifecycleStatus(undefined)).toBe("dispatched");
  });

  test("number → 'dispatched'", () => {
    expect(normalizeLifecycleStatus(42)).toBe("dispatched");
  });

  test("empty string → 'dispatched'", () => {
    expect(normalizeLifecycleStatus("")).toBe("dispatched");
  });

  test("completely unknown string → 'dispatched'", () => {
    expect(normalizeLifecycleStatus("ACTIVE")).toBe("dispatched");
  });

  test("whitespace-padded canonical value is still recognised", () => {
    expect(normalizeLifecycleStatus("  enRoute  ")).toBe("enRoute");
  });

  test("whitespace-padded legacy alias is still recognised", () => {
    expect(normalizeLifecycleStatus("  en_route  ")).toBe("enRoute");
  });

  test("object input → 'dispatched'", () => {
    expect(normalizeLifecycleStatus({ status: "arrived" })).toBe("dispatched");
  });
});

// ─── canTransitionLifecycle — blocked / illegal transitions ──────────────────

describe("canTransitionLifecycle — illegal transitions", () => {
  test("dispatched → arrived (skip) is blocked", () => {
    expect(canTransitionLifecycle("dispatched", "arrived")).toBe(false);
  });

  test("dispatched → completed (skip) is blocked", () => {
    expect(canTransitionLifecycle("dispatched", "completed")).toBe(false);
  });

  test("enRoute → dispatched (backwards) is blocked", () => {
    expect(canTransitionLifecycle("enRoute", "dispatched")).toBe(false);
  });

  test("arrived → enRoute (backwards) is blocked", () => {
    expect(canTransitionLifecycle("arrived", "enRoute")).toBe(false);
  });

  test("completed → cancelled is blocked (terminal)", () => {
    expect(canTransitionLifecycle("completed", "cancelled")).toBe(false);
  });

  test("completed → enRoute is blocked", () => {
    expect(canTransitionLifecycle("completed", "enRoute")).toBe(false);
  });

  test("completed → dispatched is blocked", () => {
    expect(canTransitionLifecycle("completed", "dispatched")).toBe(false);
  });

  test("cancelled → enRoute is blocked", () => {
    expect(canTransitionLifecycle("cancelled", "enRoute")).toBe(false);
  });

  test("cancelled → cancelled is blocked (already cancelled)", () => {
    expect(canTransitionLifecycle("cancelled", "cancelled")).toBe(false);
  });

  test("dispatched → dispatched (same-state) is blocked", () => {
    expect(canTransitionLifecycle("dispatched", "dispatched")).toBe(false);
  });

  test("arrived → arrived (same-state) is blocked", () => {
    expect(canTransitionLifecycle("arrived", "arrived")).toBe(false);
  });
});

// ─── lifecycleIndex — out-of-range values ────────────────────────────────────

describe("lifecycleIndex — values outside LIFECYCLE_ORDER", () => {
  test("'cancelled' returns -1", () => {
    expect(lifecycleIndex("cancelled")).toBe(-1);
  });
});

// ─── sessionStatusForLifecycle — all statuses covered ────────────────────────

describe("sessionStatusForLifecycle — exhaustive coverage", () => {
  test("every status in LIFECYCLE_ORDER except 'completed' maps to 'active'", () => {
    const activeStatuses = ["dispatched", "enRoute", "arrived"] as const;
    for (const s of activeStatuses) {
      expect(sessionStatusForLifecycle(s)).toBe("active");
    }
  });
});

// ─── parseLatLng — invalid inputs ────────────────────────────────────────────

describe("parseLatLng — hostile inputs", () => {
  test("null → null", () => {
    expect(parseLatLng(null)).toBeNull();
  });

  test("undefined → null", () => {
    expect(parseLatLng(undefined)).toBeNull();
  });

  test("Infinity latitude → null (non-finite)", () => {
    expect(parseLatLng({ latitude: Infinity, longitude: 35.2 })).toBeNull();
  });

  test("NaN longitude → null (non-finite)", () => {
    expect(parseLatLng({ latitude: 31.7, longitude: NaN })).toBeNull();
  });

  test("string latitude (e.g. from malformed JSON) → null", () => {
    expect(parseLatLng({ latitude: "31.7", longitude: 35.2 })).toBeNull();
  });

  test("missing longitude field → null", () => {
    expect(parseLatLng({ latitude: 31.7 })).toBeNull();
  });

  test("missing latitude field → null", () => {
    expect(parseLatLng({ longitude: 35.2 })).toBeNull();
  });

  test("both coordinates absent → null", () => {
    expect(parseLatLng({})).toBeNull();
  });

  test("non-object primitive input → null", () => {
    // Type assertion needed because the parameter type only accepts objects/null
    expect(parseLatLng(31.7 as unknown as null)).toBeNull();
  });
});

// ─── etaMinutesFromDistanceMeters — boundary values ──────────────────────────

describe("etaMinutesFromDistanceMeters — boundaries", () => {
  test("null distance → undefined", () => {
    expect(etaMinutesFromDistanceMeters(null)).toBeUndefined();
  });

  test("NaN → undefined", () => {
    expect(etaMinutesFromDistanceMeters(NaN)).toBeUndefined();
  });

  test("Infinity → undefined", () => {
    expect(etaMinutesFromDistanceMeters(Infinity)).toBeUndefined();
  });

  test("-Infinity → undefined", () => {
    expect(etaMinutesFromDistanceMeters(-Infinity)).toBeUndefined();
  });

  test("0 metres → minimum 1 minute", () => {
    expect(etaMinutesFromDistanceMeters(0)).toBe(1);
  });

  test("1 metre → minimum 1 minute (rounds down then clamps)", () => {
    expect(etaMinutesFromDistanceMeters(1)).toBe(1);
  });

  test("large distance → proportionally large ETA", () => {
    // 40 km at 40 km/h = exactly 60 minutes
    expect(etaMinutesFromDistanceMeters(40_000)).toBe(60);
  });
});

// ─── normalizeConditionLevel — invalid / unexpected inputs ────────────────────

describe("normalizeConditionLevel — invalid inputs default to 'moderate'", () => {
  test("null → 'moderate'", () => {
    expect(normalizeConditionLevel(null)).toBe("moderate");
  });

  test("undefined → 'moderate'", () => {
    expect(normalizeConditionLevel(undefined)).toBe("moderate");
  });

  test("random string → 'moderate'", () => {
    expect(normalizeConditionLevel("severe")).toBe("moderate");
  });

  test("number → 'moderate'", () => {
    expect(normalizeConditionLevel(2)).toBe("moderate");
  });

  test("object → 'moderate'", () => {
    expect(normalizeConditionLevel({ level: "critical" })).toBe("moderate");
  });
});

// ─── stripUndefinedDeep — complex nested structures ──────────────────────────

describe("stripUndefinedDeep — nested and array edge cases", () => {
  test("removes undefined from a nested object", () => {
    const input = { a: { b: 1, c: undefined }, d: "ok" };
    expect(stripUndefinedDeep(input)).toEqual({ a: { b: 1 }, d: "ok" });
  });

  test("filters undefined out of an array", () => {
    expect(stripUndefinedDeep([1, undefined, 2, undefined, 3])).toEqual([1, 2, 3]);
  });

  test("handles three levels of nesting", () => {
    const input = { a: { b: { c: { deep: undefined, kept: "yes" } } } };
    expect(stripUndefinedDeep(input)).toEqual({ a: { b: { c: { kept: "yes" } } } });
  });

  test("handles arrays inside objects", () => {
    const input = { items: [1, undefined, 3], name: "test" };
    expect(stripUndefinedDeep(input)).toEqual({ items: [1, 3], name: "test" });
  });

  test("root undefined passes through as-is", () => {
    expect(stripUndefinedDeep(undefined)).toBeUndefined();
  });

  test("empty object returns empty object", () => {
    expect(stripUndefinedDeep({})).toEqual({});
  });

  test("empty array returns empty array", () => {
    expect(stripUndefinedDeep([])).toEqual([]);
  });
});

// ─── snapshotFromFirestore — edge case inputs ─────────────────────────────────

describe("snapshotFromFirestore — edge case inputs", () => {
  test("returns null for a number", () => {
    expect(snapshotFromFirestore(42)).toBeNull();
  });

  test("returns null for a boolean", () => {
    expect(snapshotFromFirestore(true)).toBeNull();
  });

  test("empty vitals object is dropped (no keys survive)", () => {
    const raw = {
      ambulanceStatus: "",
      lastUpdate: 0,
      vitals: { heartRate: Infinity, oxygen: NaN },
    };
    const result = snapshotFromFirestore(raw);
    // All vitals were non-finite so vitals should be undefined
    expect(result?.vitals).toBeUndefined();
  });

  test("non-numeric lastUpdate falls back to a recent timestamp", () => {
    const before = Date.now();
    const result = snapshotFromFirestore({ ambulanceStatus: "", lastUpdate: "bad" });
    const after = Date.now();
    expect(result?.lastUpdate).toBeGreaterThanOrEqual(before);
    expect(result?.lastUpdate).toBeLessThanOrEqual(after);
  });
});
