/** Pull a usable message from an Axios-style API failure. */
export function extractApiError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "response" in error) {
    const msg = (error as { response?: { data?: { error?: string } } }).response?.data
      ?.error;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
