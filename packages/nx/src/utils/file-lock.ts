/** Whether a `FileLock.waitUntilFree` rejection is its timeout, not a real lock failure. */
export function isLockWaitTimeout(e: unknown): boolean {
  return (e as { code?: string })?.code === 'Timeout';
}
