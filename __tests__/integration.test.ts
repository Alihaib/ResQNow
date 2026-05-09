/**
 * TYPE 2 — Integration Tests
 *
 * Tests how multiple modules cooperate.  Each test exercises a cross-module
 * workflow: patientSnapshot.ts integrates with stateMachine.ts and
 * firestoreSanitize.ts, and the combined pipeline is validated end-to-end.
 */

import {
  snapshotFromFirestore,
  mergePatientSnapshot,
  snapshotPayloadForLifecycle,
} from "../src/emergency/patientSnapshot";

import {
  normalizeLifecycleStatus,
  sessionStatusForLifecycle,
} from "../src/emergency/stateMachine";

// ─── snapshotFromFirestore ────────────────────────────────────────────────────

describe("snapshotFromFirestore — parsing raw Firestore data", () => {
  test("parses a valid full object correctly", () => {
    const raw = {
      conditionLevel: "critical",
      symptoms: ["chest pain", "sweating"],
      ambulanceStatus: "arrived",
      lastUpdate: 1_700_000_000_000,
      vitals: { heartRate: 90, oxygen: 95, bloodPressure: "120/80" },
    };
    const result = snapshotFromFirestore(raw);
    expect(result).not.toBeNull();
    expect(result?.conditionLevel).toBe("critical");
    expect(result?.symptoms).toEqual(["chest pain", "sweating"]);
    expect(result?.vitals?.heartRate).toBe(90);
    expect(result?.vitals?.bloodPressure).toBe("120/80");
  });

  test("returns null for null input", () => {
    expect(snapshotFromFirestore(null)).toBeNull();
  });

  test("returns null for a primitive (string) input", () => {
    expect(snapshotFromFirestore("not an object")).toBeNull();
  });

  test("defaults conditionLevel to 'moderate' when the stored value is unrecognised", () => {
    const result = snapshotFromFirestore({ ambulanceStatus: "x", lastUpdate: 0 });
    expect(result?.conditionLevel).toBe("moderate");
  });

  test("filters empty strings from the symptoms array", () => {
    const raw = { symptoms: ["pain", "", "   "], ambulanceStatus: "", lastUpdate: 0 };
    const result = snapshotFromFirestore(raw);
    // snapshotFromFirestore filters items whose length === 0 after String()
    expect(result?.symptoms).not.toContain("");
    expect(result?.symptoms).toContain("pain");
  });

  test("ignores non-finite vitals values (Infinity, NaN)", () => {
    const raw = {
      conditionLevel: "stable",
      ambulanceStatus: "",
      lastUpdate: 0,
      vitals: { heartRate: Infinity, oxygen: NaN, bloodPressure: "100/70" },
    };
    const result = snapshotFromFirestore(raw);
    expect(result?.vitals?.heartRate).toBeUndefined();
    expect(result?.vitals?.oxygen).toBeUndefined();
    expect(result?.vitals?.bloodPressure).toBe("100/70");
  });

  test("ignores a blank bloodPressure string", () => {
    const raw = {
      ambulanceStatus: "",
      lastUpdate: 0,
      vitals: { bloodPressure: "   " },
    };
    const result = snapshotFromFirestore(raw);
    expect(result?.vitals?.bloodPressure).toBeUndefined();
  });
});

// ─── mergePatientSnapshot — 'arrived' phase (clinical data permitted) ─────────

describe("mergePatientSnapshot — lifecycle 'arrived' (clinical data allowed)", () => {
  test("merges all clinical fields from the patch", () => {
    const patch = {
      conditionLevel: "critical" as const,
      symptoms: ["bleeding", "confusion"],
      ambulanceStatus: "On scene",
      lastUpdate: Date.now(),
    };
    const result = mergePatientSnapshot(null, patch, "arrived");
    expect(result.conditionLevel).toBe("critical");
    expect(result.symptoms).toEqual(["bleeding", "confusion"]);
    expect(result.ambulanceStatus).toBe("On scene");
  });

  test("merges patch vitals on top of existing snapshot vitals", () => {
    const prev = {
      conditionLevel: "stable",
      symptoms: [],
      ambulanceStatus: "",
      lastUpdate: Date.now(),
      vitals: { heartRate: 72, oxygen: 98 },
    };
    const patch = {
      ambulanceStatus: "updated",
      vitals: { bloodPressure: "120/80" },
      lastUpdate: Date.now(),
    };
    const result = mergePatientSnapshot(prev, patch, "arrived");
    const vitals = result.vitals as Record<string, unknown>;
    expect(vitals?.heartRate).toBe(72);
    expect(vitals?.bloodPressure).toBe("120/80");
  });

  test("lastUpdate in the result is always a number", () => {
    const result = mergePatientSnapshot(null, { ambulanceStatus: "", lastUpdate: 0 }, "arrived");
    expect(typeof result.lastUpdate).toBe("number");
  });

  test("falls back to 'moderate' conditionLevel when patch omits it and prev is null", () => {
    const result = mergePatientSnapshot(null, { ambulanceStatus: "", lastUpdate: 0 }, "arrived");
    expect(result.conditionLevel).toBe("moderate");
  });
});

// ─── mergePatientSnapshot — non-arrived phases (clinical data stripped) ───────

describe("mergePatientSnapshot — non-arrived lifecycle phases", () => {
  const clinicalPatch = {
    conditionLevel: "critical" as const,
    symptoms: ["pain"],
    ambulanceStatus: "En route",
    eta: 8,
    lastUpdate: Date.now(),
  };

  test("strips symptoms and conditionLevel when lifecycle is 'enRoute'", () => {
    const result = mergePatientSnapshot(null, clinicalPatch, "enRoute");
    expect(result.symptoms).toBeUndefined();
    expect(result.conditionLevel).toBeUndefined();
  });

  test("preserves ambulanceStatus and eta when lifecycle is 'enRoute'", () => {
    const result = mergePatientSnapshot(null, clinicalPatch, "enRoute");
    expect(result.ambulanceStatus).toBe("En route");
    expect(result.eta).toBe(8);
  });

  test("strips clinical fields when lifecycle is 'dispatched'", () => {
    const result = mergePatientSnapshot(null, clinicalPatch, "dispatched");
    expect(result.symptoms).toBeUndefined();
    expect(result.conditionLevel).toBeUndefined();
    expect(result.vitals).toBeUndefined();
  });

  test("strips clinical fields when lifecycle is 'completed'", () => {
    const result = mergePatientSnapshot(null, clinicalPatch, "completed");
    expect(result.symptoms).toBeUndefined();
    expect(result.conditionLevel).toBeUndefined();
  });
});

// ─── snapshotPayloadForLifecycle ──────────────────────────────────────────────

describe("snapshotPayloadForLifecycle — defense-in-depth before Firestore writes", () => {
  const fullSnapshot = {
    conditionLevel: "critical",
    symptoms: ["pain", "dizziness"],
    vitals: { heartRate: 110 },
    ambulanceStatus: "at scene",
    eta: 0,
    lastUpdate: Date.now(),
  };

  test("'arrived': keeps all clinical and operational fields", () => {
    const result = snapshotPayloadForLifecycle("arrived", fullSnapshot);
    expect(result.conditionLevel).toBe("critical");
    expect(result.symptoms).toEqual(["pain", "dizziness"]);
    expect(result.vitals).toBeDefined();
    expect(result.ambulanceStatus).toBe("at scene");
  });

  test("'enRoute': strips symptoms, conditionLevel and vitals", () => {
    const result = snapshotPayloadForLifecycle("enRoute", fullSnapshot);
    expect(result.symptoms).toBeUndefined();
    expect(result.conditionLevel).toBeUndefined();
    expect(result.vitals).toBeUndefined();
  });

  test("'dispatched': strips all clinical fields but keeps operational fields", () => {
    const result = snapshotPayloadForLifecycle("dispatched", fullSnapshot);
    expect(result.symptoms).toBeUndefined();
    expect(result.conditionLevel).toBeUndefined();
    expect(result.ambulanceStatus).toBe("at scene");
  });

  test("'completed': strips clinical fields", () => {
    const result = snapshotPayloadForLifecycle("completed", fullSnapshot);
    expect(result.symptoms).toBeUndefined();
    expect(result.conditionLevel).toBeUndefined();
    expect(result.vitals).toBeUndefined();
  });
});

// ─── Cross-module pipeline: normalize → session → label ──────────────────────

describe("normalizeLifecycleStatus + sessionStatusForLifecycle pipeline", () => {
  test("legacy 'en_route' normalizes and maps to 'active' session", () => {
    const lifecycle = normalizeLifecycleStatus("en_route");
    const session = sessionStatusForLifecycle(lifecycle);
    expect(lifecycle).toBe("enRoute");
    expect(session).toBe("active");
  });

  test("legacy 'assigned_ambulance' normalizes and maps to 'active' session", () => {
    const lifecycle = normalizeLifecycleStatus("assigned_ambulance");
    const session = sessionStatusForLifecycle(lifecycle);
    expect(lifecycle).toBe("dispatched");
    expect(session).toBe("active");
  });

  test("terminal 'completed' pipeline returns 'resolved' session", () => {
    const lifecycle = normalizeLifecycleStatus("completed");
    const session = sessionStatusForLifecycle(lifecycle);
    expect(session).toBe("resolved");
  });

  test("mergePatientSnapshot output passes through snapshotPayloadForLifecycle cleanly", () => {
    const patch = {
      conditionLevel: "stable" as const,
      symptoms: ["nausea"],
      ambulanceStatus: "En route",
      eta: 5,
      lastUpdate: Date.now(),
    };
    // Merge during enRoute — clinical fields are not written
    const merged = mergePatientSnapshot(null, patch, "enRoute");
    // Double-check via snapshotPayloadForLifecycle (defence-in-depth layer)
    const payload = snapshotPayloadForLifecycle("enRoute", merged);
    expect(payload.symptoms).toBeUndefined();
    expect(payload.conditionLevel).toBeUndefined();
    expect(payload.ambulanceStatus).toBe("En route");
    expect(payload.eta).toBe(5);
  });
});
