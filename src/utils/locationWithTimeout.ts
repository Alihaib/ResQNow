import * as Location from "expo-location";

export type LocationTimeoutError = Error & { code: "LOCATION_TIMEOUT" };

const DEFAULT_GPS_TIMEOUT_MS = 18_000;

/**
 * Resolves with a position or rejects on timeout / GPS failure.
 * Prevents indefinite SOS "Getting your location…" hangs.
 */
export async function getCurrentPositionWithTimeout(
  options: Location.LocationOptions,
  timeoutMs: number = DEFAULT_GPS_TIMEOUT_MS,
): Promise<Location.LocationObject> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error("Location request timed out") as LocationTimeoutError;
      err.code = "LOCATION_TIMEOUT";
      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Location.getCurrentPositionAsync(options),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId);
  }
}

export function isLocationTimeoutError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as LocationTimeoutError).code === "LOCATION_TIMEOUT"
  );
}
