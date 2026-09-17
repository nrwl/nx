/**
 * Whether a rejection from `FileLock.waitUntilFree` is its timeout rather than a
 * filesystem failure.
 *
 * `'Timeout'` is the lock's own code, set on the error it rejects with.
 * `'Cancelled'` is the fallback it uses where the error object could not be
 * built, and means the same thing. Anything else that rejects is the lock file
 * failing and is not ours to swallow.
 */
export function isLockWaitTimeout(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === 'Timeout' || code === 'Cancelled';
}
