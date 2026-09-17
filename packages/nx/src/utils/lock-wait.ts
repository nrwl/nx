/**
 * Whether a rejection from `FileLock.waitUntilFree` is its timeout rather than a
 * filesystem failure.
 *
 * The code is napi's `Cancelled`, which is what a native rejection carries when
 * the wait gives up: the async boundary can only report the statuses napi
 * defines, so this reads the one it uses rather than a code of Nx's own.
 * Anything else that rejects is the lock file failing and is not ours to
 * swallow.
 */
export function isLockWaitTimeout(e: unknown): boolean {
  return (e as { code?: string })?.code === 'Cancelled';
}
