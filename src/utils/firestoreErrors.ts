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
