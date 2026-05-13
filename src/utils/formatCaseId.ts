/**
 * Human-friendly emergency case ID display helpers — UI ONLY.
 *
 * Firestore emergency documents are keyed by `${uid}_${Date.now()}`, which is
 * a long opaque string that is hostile to scan under stress. These helpers
 * derive a short, stable display token from that ID for use in cards,
 * subtitles, and accessibility labels.
 *
 * Critical rule: the real `emergencyId` is the only thing that ever flows
 * into routing, Firestore reads/writes, transactions, or business logic.
 * Never round-trip the formatted value back into any of those code paths.
 *
 * Algorithm (chosen to match the project spec):
 *   1. Strip every non-digit character.
 *   2. If the stripped string is shorter than 3 chars, the ID is too short
 *      to abbreviate safely — return the original input verbatim.
 *   3. Otherwise return the last `digits` (default 4) digits, prefixed
 *      with `#`. We pick four digits by default because the SOS ID format
 *      `${uid}_${Date.now()}` ends in the millisecond portion of the
 *      timestamp; four trailing digits give 10 000 unique buckets and
 *      meaningfully reduce visual collisions when multiple cases land in
 *      the same second across the dashboards. The spec calls for "3 to 4
 *      digits"; if a caller prefers 3 they can pass `digits: 3`.
 *
 * `formatCaseId` produces a fully-formed English label ("Case #6668") for
 * places that don't have access to a translation function. Most call sites
 * have i18n available and should prefer the existing `activityEmergencyRef`
 * key ("Case {id}" / "מקרה {id}") plus `caseIdSuffix` for the `{id}` slot,
 * which keeps Hebrew / RTL working correctly.
 */

const DEFAULT_DIGITS = 4;

export type FormatCaseIdOptions = {
  /** How many trailing digits to expose (3 or 4 per spec). Defaults to 4. */
  digits?: number;
};

function trailingDigits(id: string, digits: number): string | null {
  if (!id) return null;
  const onlyDigits = id.replace(/\D+/g, "");
  if (onlyDigits.length < 3) return null;
  const take = Math.max(1, Math.min(digits, onlyDigits.length));
  return onlyDigits.slice(-take);
}

/**
 * Returns just the suffix portion: e.g. `#6668`. Falls back to the raw ID
 * when there aren't enough digits to abbreviate.
 *
 * Use this inside translated strings: `t("activityEmergencyRef", "Case {id}")
 * .replace("{id}", caseIdSuffix(rawId))`.
 */
export function caseIdSuffix(id: string, options: FormatCaseIdOptions = {}): string {
  const digits = options.digits ?? DEFAULT_DIGITS;
  const tail = trailingDigits(id, digits);
  if (tail == null) return id ?? "";
  return `#${tail}`;
}

/**
 * Returns the full English label: e.g. `Case #6668`. Falls back to the raw
 * ID when there aren't enough digits.
 *
 * Prefer i18n-aware composition where a translation function is available.
 */
export function formatCaseId(id: string, options: FormatCaseIdOptions = {}): string {
  const digits = options.digits ?? DEFAULT_DIGITS;
  const tail = trailingDigits(id, digits);
  if (tail == null) return id ?? "";
  return `Case #${tail}`;
}
