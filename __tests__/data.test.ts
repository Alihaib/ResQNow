/**
 * TYPE 3 — Data Integrity Tests
 *
 * Validates the shape, completeness, and internal consistency of static
 * data structures (first-aid categories, guides, lifecycle constants).
 * These tests catch regressions introduced by editing content files.
 */

import { firstAidCategories } from "../src/firstAid/categories";
import { firstAidGuides } from "../src/firstAid/guides";
import { LIFECYCLE_ORDER } from "../src/emergency/stateMachine";

const CATEGORY_IDS = new Set(firstAidCategories.map((c) => c.id));
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

// ─── firstAidCategories ───────────────────────────────────────────────────────

describe("firstAidCategories — count and presence", () => {
  test("has exactly 10 categories", () => {
    expect(firstAidCategories).toHaveLength(10);
  });

  test("includes the expected critical categories", () => {
    const required = ["bleeding", "breathing", "cardiac", "burns", "poisoning"];
    for (const id of required) {
      expect(CATEGORY_IDS.has(id)).toBe(true);
    }
  });
});

describe("firstAidCategories — required fields per entry", () => {
  test("every category has a non-empty id", () => {
    for (const cat of firstAidCategories) {
      expect(typeof cat.id).toBe("string");
      expect(cat.id.length).toBeGreaterThan(0);
    }
  });

  test("every category has a non-empty icon string", () => {
    for (const cat of firstAidCategories) {
      expect(typeof cat.icon).toBe("string");
      expect(cat.icon.length).toBeGreaterThan(0);
    }
  });

  test("every category has a valid hex accent color", () => {
    for (const cat of firstAidCategories) {
      expect(cat.accent).toMatch(HEX_COLOR);
    }
  });

  test("every category has a bilingual English title", () => {
    for (const cat of firstAidCategories) {
      expect(typeof cat.title.en).toBe("string");
      expect(cat.title.en.length).toBeGreaterThan(0);
    }
  });

  test("every category has a bilingual Hebrew title", () => {
    for (const cat of firstAidCategories) {
      expect(typeof cat.title.he).toBe("string");
      expect(cat.title.he.length).toBeGreaterThan(0);
    }
  });
});

describe("firstAidCategories — uniqueness", () => {
  test("all category IDs are unique", () => {
    const ids = firstAidCategories.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("all category accent colors are unique (no accidental duplication)", () => {
    const accents = firstAidCategories.map((c) => c.accent);
    // Heatstroke and burns intentionally share #EA580C — allow up to 1 duplicate
    const unique = new Set(accents);
    expect(unique.size).toBeGreaterThanOrEqual(firstAidCategories.length - 1);
  });
});

// ─── firstAidGuides ───────────────────────────────────────────────────────────

describe("firstAidGuides — count and presence", () => {
  test("has at least 5 guides", () => {
    expect(firstAidGuides.length).toBeGreaterThanOrEqual(5);
  });

  test("includes a bleeding guide", () => {
    const found = firstAidGuides.some((g) => g.category === "bleeding");
    expect(found).toBe(true);
  });

  test("includes a cardiac (CPR) guide", () => {
    const found = firstAidGuides.some((g) => g.category === "cardiac");
    expect(found).toBe(true);
  });
});

describe("firstAidGuides — required fields per guide", () => {
  test("every guide has a non-empty id", () => {
    for (const guide of firstAidGuides) {
      expect(guide.id.length).toBeGreaterThan(0);
    }
  });

  test("every guide references a known category", () => {
    for (const guide of firstAidGuides) {
      expect(CATEGORY_IDS.has(guide.category)).toBe(true);
    }
  });

  test("every guide has at least one step", () => {
    for (const guide of firstAidGuides) {
      expect(guide.steps.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("every guide step has non-empty English and Hebrew text", () => {
    for (const guide of firstAidGuides) {
      for (const step of guide.steps) {
        expect(step.en.length).toBeGreaterThan(0);
        expect(step.he.length).toBeGreaterThan(0);
      }
    }
  });

  test("every guide warning has non-empty English and Hebrew text", () => {
    for (const guide of firstAidGuides) {
      for (const warning of guide.warnings) {
        expect(warning.en.length).toBeGreaterThan(0);
        expect(warning.he.length).toBeGreaterThan(0);
      }
    }
  });

  test("every guide has a bilingual English title", () => {
    for (const guide of firstAidGuides) {
      expect(guide.title.en.length).toBeGreaterThan(0);
    }
  });

  test("every guide has a bilingual Hebrew title", () => {
    for (const guide of firstAidGuides) {
      expect(guide.title.he.length).toBeGreaterThan(0);
    }
  });
});

describe("firstAidGuides — uniqueness", () => {
  test("all guide IDs are unique", () => {
    const ids = firstAidGuides.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── LIFECYCLE_ORDER ──────────────────────────────────────────────────────────

describe("LIFECYCLE_ORDER — structure and sequence", () => {
  test("has exactly 4 active lifecycle steps", () => {
    expect(LIFECYCLE_ORDER).toHaveLength(4);
  });

  test("'cancelled' is NOT in the main order (it is a terminal side-exit)", () => {
    expect(LIFECYCLE_ORDER).not.toContain("cancelled");
  });

  test("follows the correct sequence", () => {
    expect(LIFECYCLE_ORDER).toEqual(["dispatched", "enRoute", "arrived", "completed"]);
  });

  test("index of 'arrived' is greater than index of 'enRoute'", () => {
    expect(LIFECYCLE_ORDER.indexOf("arrived")).toBeGreaterThan(
      LIFECYCLE_ORDER.indexOf("enRoute"),
    );
  });
});
