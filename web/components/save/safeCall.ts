// Calls a save action and always returns a SaveResult: a dropped connection, an aborted request
// or an unexpected response becomes a retryable "failed", never an uncaught error.
import { FAILED_ERROR, type SaveResult } from "@/lib/save-result";

export async function safeCall(action: () => Promise<SaveResult>): Promise<SaveResult> {
  try {
    const result = await action();
    return result && typeof result === "object" && "ok" in result ? result : { ok: false, error: FAILED_ERROR };
  } catch {
    return { ok: false, error: FAILED_ERROR };
  }
}
