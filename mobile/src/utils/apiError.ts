/**
 * Turns an unknown thrown value into a message safe to show a user.
 *
 * A thrown value is only treated as a server rejection when it carries an HTTP
 * response. Network faults and client-side programming errors get distinct copy
 * so a bug after a successful request never reads as "the action failed".
 */
export function extractApiError(error: unknown, fallback: string): string {
  const err = error as {
    response?: { status?: number; data?: { error?: string } };
    message?: string;
    code?: string;
  };

  const serverMessage = err?.response?.data?.error;
  if (typeof serverMessage === "string" && serverMessage.trim()) {
    return serverMessage;
  }

  if (err?.response?.status) {
    return fallback;
  }

  if (err?.code === "ECONNABORTED") {
    return "The server took too long to respond. Check your connection and try again.";
  }

  if (err?.message === "Network Error") {
    return "Could not reach the server. Check your connection and try again.";
  }

  return fallback;
}

/** True when the throw never reached the server (network / timeout / local bug). */
export function isTransportError(error: unknown): boolean {
  const err = error as { response?: unknown };
  return !err?.response;
}

/**
 * Runs post-success side effects (cache busting, analytics) without letting a
 * failure inside them roll back into the caller's error path.
 */
export function runSideEffect(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    console.warn("Side effect failed after successful request:", error);
  }
}
