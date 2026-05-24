/**
 * TYPE 1 — Unit Tests
 *
 * Tests each pure function in complete isolation.
 * No mocks of project modules — only the react-native shim is needed for rtl.ts.
 */

import {
  normalizeLifecycleStatus,
  sessionStatusForLifecycle,
  lifecycleIndex,
  canTransitionLifecycle,
  LIFECYCLE_ORDER,
} from "../src/emergency/stateMachine";

import { stripUndefinedDeep } from "../src/utils/firestoreSanitize";
import { parseLatLng } from "../src/utils/emergencyMapCoords";

import {
  normalizeConditionLevel,
  ambulanceStatusLabel,
  allowsMedicalSnapshotFields,
  etaMinutesFromDistanceMeters,
} from "../src/emergency/patientSnapshot";

import { pick } from "../src/firstAid/types";
import {
  isRTL,
  getFlexDirection,
  getTextAlign,
  marginHorizontal,
  paddingHorizontal,
} from "../src/utils/rtl";

// ─── normalizeLifecycleStatus ─────────────────────────────────────────────────

describe("normalizeLifecycleStatus — canonical values", () => {
  test("'dispatched' passes through unchanged", () => {
    expect(normalizeLifecycleStatus("dispatched")).toBe("dispatched");
  });

  test("'enRoute' passes through unchanged", () => {
    expect(normalizeLifecycleStatus("enRoute")).toBe("enRoute");
  });

  test("'arrived' passes through unchanged", () => {
    expect(normalizeLifecycleStatus("arrived")).toBe("arrived");
  });

  test("'completed' passes through unchanged", () => {
    expect(normalizeLifecycleStatus("completed")).toBe("completed");
  });

  test("'cancelled' passes through unchanged", () => {
    expect(normalizeLifecycleStatus("cancelled")).toBe("cancelled");
  });
});

describe("normalizeLifecycleStatus — legacy aliases", () => {
  test("'en_route' maps to 'enRoute'", () => {
    expect(normalizeLifecycleStatus("en_route")).toBe("enRoute");
  });

  test("'arrived_patient' maps to 'arrived'", () => {
    expect(normalizeLifecycleStatus("arrived_patient")).toBe("arrived");
  });

  test("'patient_picked' maps to 'arrived'", () => {
    expect(normalizeLifecycleStatus("patient_picked")).toBe("arrived");
  });

  test("'assigned' maps to 'dispatched'", () => {
    expect(normalizeLifecycleStatus("assigned")).toBe("dispatched");
  });

  test("'unassigned' maps to 'dispatched'", () => {
    expect(normalizeLifecycleStatus("unassigned")).toBe("dispatched");
  });

  test("'assigned_ambulance' maps to 'dispatched'", () => {
    expect(normalizeLifecycleStatus("assigned_ambulance")).toBe("dispatched");
  });

  test("'en_route_hospital' maps to 'enRoute'", () => {
    expect(normalizeLifecycleStatus("en_route_hospital")).toBe("enRoute");
  });

  test("'en_route_to_scene' maps to 'enRoute'", () => {
    expect(normalizeLifecycleStatus("en_route_to_scene")).toBe("enRoute");
  });

  test("'accepted' maps to 'dispatched'", () => {
    expect(normalizeLifecycleStatus("accepted")).toBe("dispatched");
  });
});

// ─── sessionStatusForLifecycle ────────────────────────────────────────────────

describe("sessionStatusForLifecycle", () => {
  test("'completed' returns 'resolved'", () => {
    expect(sessionStatusForLifecycle("completed")).toBe("resolved");
  });

  test("'cancelled' returns 'cancelled'", () => {
    expect(sessionStatusForLifecycle("cancelled")).toBe("cancelled");
  });

  test("'dispatched' returns 'active'", () => {
    expect(sessionStatusForLifecycle("dispatched")).toBe("active");
  });

  test("'enRoute' returns 'active'", () => {
    expect(sessionStatusForLifecycle("enRoute")).toBe("active");
  });

  test("'arrived' returns 'active'", () => {
    expect(sessionStatusForLifecycle("arrived")).toBe("active");
  });
});

// ─── lifecycleIndex ───────────────────────────────────────────────────────────

describe("lifecycleIndex", () => {
  test("'dispatched' is at index 0", () => {
    expect(lifecycleIndex("dispatched")).toBe(0);
  });

  test("'enRoute' is at index 1", () => {
    expect(lifecycleIndex("enRoute")).toBe(1);
  });

  test("'arrived' is at index 2", () => {
    expect(lifecycleIndex("arrived")).toBe(2);
  });

  test("'completed' is at index 3", () => {
    expect(lifecycleIndex("completed")).toBe(3);
  });

  test("'cancelled' returns -1 (terminal, not in main order)", () => {
    expect(lifecycleIndex("cancelled")).toBe(-1);
  });
});

// ─── canTransitionLifecycle — valid forward progressions ─────────────────────

describe("canTransitionLifecycle — valid progressions", () => {
  test("dispatched → enRoute is allowed", () => {
    expect(canTransitionLifecycle("dispatched", "enRoute")).toBe(true);
  });

  test("enRoute → arrived is allowed", () => {
    expect(canTransitionLifecycle("enRoute", "arrived")).toBe(true);
  });

  test("arrived → completed is allowed", () => {
    expect(canTransitionLifecycle("arrived", "completed")).toBe(true);
  });

  test("dispatched → cancelled is allowed", () => {
    expect(canTransitionLifecycle("dispatched", "cancelled")).toBe(true);
  });

  test("enRoute → cancelled is allowed", () => {
    expect(canTransitionLifecycle("enRoute", "cancelled")).toBe(true);
  });

  test("arrived → cancelled is allowed", () => {
    expect(canTransitionLifecycle("arrived", "cancelled")).toBe(true);
  });
});

// ─── LIFECYCLE_ORDER ──────────────────────────────────────────────────────────

describe("LIFECYCLE_ORDER constant", () => {
  test("has exactly 4 active steps", () => {
    expect(LIFECYCLE_ORDER).toHaveLength(4);
  });

  test("starts with 'dispatched'", () => {
    expect(LIFECYCLE_ORDER[0]).toBe("dispatched");
  });

  test("ends with 'completed'", () => {
    expect(LIFECYCLE_ORDER[LIFECYCLE_ORDER.length - 1]).toBe("completed");
  });
});

// ─── stripUndefinedDeep ───────────────────────────────────────────────────────

describe("stripUndefinedDeep", () => {
  test("removes top-level undefined values", () => {
    expect(stripUndefinedDeep({ a: 1, b: undefined, c: "x" })).toEqual({ a: 1, c: "x" });
  });

  test("preserves null (Firestore allows null, not undefined)", () => {
    expect(stripUndefinedDeep({ a: null, b: undefined })).toEqual({ a: null });
  });

  test("preserves falsy but defined values (0, '', false)", () => {
    expect(stripUndefinedDeep({ a: 0, b: "", c: false })).toEqual({ a: 0, b: "", c: false });
  });

  test("returns primitives unchanged", () => {
    expect(stripUndefinedDeep(42)).toBe(42);
    expect(stripUndefinedDeep("hello")).toBe("hello");
    expect(stripUndefinedDeep(true)).toBe(true);
  });
});

// ─── parseLatLng ──────────────────────────────────────────────────────────────

describe("parseLatLng", () => {
  test("returns coordinate object for valid numbers", () => {
    expect(parseLatLng({ latitude: 31.7, longitude: 35.2 })).toEqual({
      latitude: 31.7,
      longitude: 35.2,
    });
  });

  test("returns null for null input", () => {
    expect(parseLatLng(null)).toBeNull();
  });

  test("returns null when both coordinate fields are absent", () => {
    expect(parseLatLng({})).toBeNull();
  });
});

// ─── etaMinutesFromDistanceMeters ─────────────────────────────────────────────

describe("etaMinutesFromDistanceMeters", () => {
  test("calculates 6 minutes for 4 km at 40 km/h", () => {
    // 4000 / (40000/60) = 4000 / 666.67 ≈ 6 min
    expect(etaMinutesFromDistanceMeters(4000)).toBe(6);
  });

  test("returns undefined for null distance", () => {
    expect(etaMinutesFromDistanceMeters(null)).toBeUndefined();
  });

  test("returns minimum 1 minute for very short distances", () => {
    expect(etaMinutesFromDistanceMeters(50)).toBe(1);
  });

  test("calculates 18 minutes for 12 km at 40 km/h", () => {
    expect(etaMinutesFromDistanceMeters(12000)).toBe(18);
  });
});

// ─── normalizeConditionLevel ──────────────────────────────────────────────────

describe("normalizeConditionLevel", () => {
  test("'stable' passes through", () => {
    expect(normalizeConditionLevel("stable")).toBe("stable");
  });

  test("'moderate' passes through", () => {
    expect(normalizeConditionLevel("moderate")).toBe("moderate");
  });

  test("'critical' passes through", () => {
    expect(normalizeConditionLevel("critical")).toBe("critical");
  });

  test("unknown value defaults to 'moderate'", () => {
    expect(normalizeConditionLevel("unknown-level")).toBe("moderate");
  });
});

// ─── ambulanceStatusLabel ─────────────────────────────────────────────────────

describe("ambulanceStatusLabel", () => {
  test("'dispatched' returns correct label", () => {
    expect(ambulanceStatusLabel("dispatched")).toBe("Dispatched — awaiting ambulance");
  });

  test("'enRoute' returns correct label", () => {
    expect(ambulanceStatusLabel("enRoute")).toBe("En route to patient");
  });

  test("'arrived' returns correct label", () => {
    expect(ambulanceStatusLabel("arrived")).toBe("Arrived at scene");
  });

  test("'completed' returns correct label", () => {
    expect(ambulanceStatusLabel("completed")).toBe("Transport / handoff completed");
  });

  test("'cancelled' returns correct label", () => {
    expect(ambulanceStatusLabel("cancelled")).toBe("Cancelled");
  });
});

// ─── allowsMedicalSnapshotFields ─────────────────────────────────────────────

describe("allowsMedicalSnapshotFields", () => {
  test("returns true only for 'arrived'", () => {
    expect(allowsMedicalSnapshotFields("arrived")).toBe(true);
  });

  test("returns false for 'dispatched'", () => {
    expect(allowsMedicalSnapshotFields("dispatched")).toBe(false);
  });

  test("returns false for 'enRoute'", () => {
    expect(allowsMedicalSnapshotFields("enRoute")).toBe(false);
  });

  test("returns false for 'completed'", () => {
    expect(allowsMedicalSnapshotFields("completed")).toBe(false);
  });

  test("returns false for 'cancelled'", () => {
    expect(allowsMedicalSnapshotFields("cancelled")).toBe(false);
  });
});

// ─── pick ─────────────────────────────────────────────────────────────────────

describe("pick — localized string selector", () => {
  const bilingual = { en: "Hello", he: "שלום" };

  test("returns English text when lang is 'en'", () => {
    expect(pick("en", bilingual)).toBe("Hello");
  });

  test("returns Hebrew text when lang is 'he'", () => {
    expect(pick("he", bilingual)).toBe("שלום");
  });
});

// ─── RTL utilities ────────────────────────────────────────────────────────────

describe("isRTL", () => {
  test("returns true for 'he'", () => {
    expect(isRTL("he")).toBe(true);
  });

  test("returns false for 'en'", () => {
    expect(isRTL("en")).toBe(false);
  });

  test("returns true for Arabic", () => {
    expect(isRTL("ar")).toBe(true);
  });

  test("returns false for other language codes", () => {
    expect(isRTL("fr")).toBe(false);
  });
});

describe("getFlexDirection", () => {
  test("returns 'row-reverse' for Hebrew (lang-driven, no reload)", () => {
    expect(getFlexDirection("he")).toBe("row-reverse");
  });

  test("returns 'row' for English", () => {
    expect(getFlexDirection("en")).toBe("row");
  });
});

describe("getTextAlign", () => {
  test("returns 'right' for Hebrew", () => {
    expect(getTextAlign("he")).toBe("right");
  });

  test("returns 'left' for English", () => {
    expect(getTextAlign("en")).toBe("left");
  });
});

describe("marginHorizontal (logical spacing)", () => {
  test("maps start/end regardless of language", () => {
    expect(marginHorizontal(10, 20)).toEqual({ marginStart: 10, marginEnd: 20 });
  });
});

describe("paddingHorizontal (logical spacing)", () => {
  test("maps start/end regardless of language", () => {
    expect(paddingHorizontal(8, 16)).toEqual({ paddingStart: 8, paddingEnd: 16 });
  });
});
