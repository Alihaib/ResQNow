/**
 * Firestore rejects `undefined` anywhere in write payloads (including nested maps).
 * Recursively drop undefined keys; keep `null` and other values.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    const next = (value as unknown[])
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
    return next as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    const inner = stripUndefinedDeep(v);
    if (inner === undefined) continue;
    out[k] = inner;
  }
  return out as T;
}
