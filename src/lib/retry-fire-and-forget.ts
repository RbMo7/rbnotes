/**
 * For a background server-action push that follows an optimistic cache
 * update (delete/archive/pin -- see use-note-operations.ts, useTogglePin):
 * a bare `.catch(() => {})` on one of these means a single transient
 * network blip leaves the client cache permanently out of sync with the
 * server, silently, until something else happens to refetch and revert
 * it -- a "deleted" note reappearing, or a pin quietly falling off, with
 * no error ever shown. Retried a few times with backoff before giving up,
 * since most such failures are exactly that transient.
 */
export async function retryFireAndForget(
  fn: () => Promise<unknown>,
  attempts = 3,
  delayMs = 1000,
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await fn();
      return;
    } catch {
      if (attempt === attempts - 1) return;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
}
