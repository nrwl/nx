/**
 * Whether a rejection from `FileLock.waitUntilFree` is its timeout rather than a
 * filesystem failure.
 *
 * `'Timeout'` is the lock's own code, set on the error it rejects with, and the
 * only thing this accepts: anything else that rejects is the lock file failing
 * and is not ours to swallow.
 */
export function isLockWaitTimeout(e: unknown): boolean {
  return (e as { code?: string })?.code === 'Timeout';
}
