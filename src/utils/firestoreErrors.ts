/**
 * Detect Firestore index / failed-precondition errors for local-friendly handling.
 */

export function isFirestoreIndexError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code ?? "").toLowerCase();
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return (
    code === "failed-precondition" ||
    message.includes("requires an index") ||
    message.includes("create_composite") ||
    (message.includes("index") && message.includes("firestore"))
  );
}

export function getFirestoreUserMessage(
  error: unknown,
  fallback = "Could not reach the server. Please check your connection and try again.",
): string {
  if (isFirestoreIndexError(error)) {
    return "Emergency data could not be loaded (database index pending). Please try again in a moment.";
  }
  const code = String((error as { code?: string })?.code ?? "").toLowerCase();
  if (code.includes("permission-denied") || code.includes("permission_denied")) {
    return "You do not have permission to perform this action.";
  }
  if (code.includes("unavailable") || code.includes("network") || code.includes("deadline")) {
    return "Network error. Please check your connection and try again.";
  }
  return fallback;
}

export function isFirestoreNetworkError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code ?? "").toLowerCase();
  return (
    code.includes("unavailable") ||
    code.includes("network") ||
    code.includes("deadline") ||
    code.includes("cancelled")
  );
}

/** User-facing copy for `startEmergency` failure reasons (UI layer). */
export function messageForStartEmergencyReason(
  reason: string,
  fallback?: string,
): string {
  switch (reason) {
    case "firestore_index":
      return "Emergency data could not be loaded (database index pending). Please try again in a moment.";
    case "network_error":
      return "Network error. Check your connection and try again.";
    case "firestore_permission_denied":
      return "You do not have permission to start an emergency. Please sign in again.";
    case "location_permission_denied":
      return "Location permission is required to send an SOS.";
    case "location_not_available":
      return "Your location could not be determined. Please try again.";
    case "in_progress":
      return "An emergency request is already in progress.";
    case "not_logged_in":
      return "Please sign in to use SOS.";
    default:
      return fallback ?? "Could not start the emergency. Please try again.";
  }
}
