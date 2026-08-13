// Import from the defining module, not the devkit-internals barrel: the barrel
// eagerly pulls in the task-execution subsystem and instantiates a daemon
// client, all of which would stay resident for the daemon server's lifetime.
import { installPackageToTmpAsync } from '../../utils/package-json';
import { detectPackageManager } from '../../utils/package-manager';
import { ensurePackageHasProvenance } from '../../utils/provenance';
import { workspaceRoot } from '../../utils/workspace-root';
import { serverLogger } from '../logger';

// Module-level state - persists across invocations within daemon lifecycle
let latestNxTmpPath: string | null = null;
let cleanupFn: (() => Promise<void>) | null = null;
let installPromise: Promise<string> | null = null;
let cleanupPromise: Promise<void> | null = null;

// Removing the install is ~10^4 unlinks, so it is not instant. Bound it anyway:
// shutdown waits on this, and a wedged filesystem must not leave the daemon
// undead.
const CLEANUP_TIMEOUT_MS = 10_000;

/**
 * Returns the path to a temp directory containing `nx@latest`.
 * The installation is cached for the lifetime of the daemon process.
 * Guards against concurrent callers by reusing the in-flight promise.
 */
export async function getLatestNxTmpPath(): Promise<string> {
  if (latestNxTmpPath !== null) {
    serverLogger.log(
      '[LATEST-NX]: Reusing cached Nx installation from',
      latestNxTmpPath
    );
    return latestNxTmpPath;
  }

  if (installPromise) {
    return installPromise;
  }

  installPromise = (async () => {
    try {
      serverLogger.log('[LATEST-NX]: Pulling latest Nx...');
      await ensurePackageHasProvenance('nx', 'latest');
      const result = await installPackageToTmpAsync(
        'nx',
        'latest',
        detectPackageManager(workspaceRoot)
      );
      latestNxTmpPath = result.tempDir;
      cleanupFn = result.cleanup;
      // A fresh install needs its own removal, so it must not resolve against
      // the previous one's memo.
      cleanupPromise = null;
      serverLogger.log(
        '[LATEST-NX]: Successfully pulled latest Nx to',
        latestNxTmpPath
      );
      return latestNxTmpPath;
    } finally {
      installPromise = null;
    }
  })();
  return installPromise;
}

/**
 * Clean up the latest Nx installation on daemon shutdown.
 *
 * Callers must await this. The daemon calls `process.exit` once shutdown
 * finishes, and `process.exit` discards pending work rather than draining it,
 * so an unawaited removal here leaks the whole ~60MB install every time.
 */
export function cleanupLatestNx(): Promise<void> {
  // Concurrent callers must await the same removal. `respondWithErrorAndExit`
  // exits as soon as its own call resolves, so a second caller that resolved
  // early would kill the first caller's in-flight `rm`.
  cleanupPromise ??= runCleanup();
  return cleanupPromise;
}

async function runCleanup(): Promise<void> {
  const cleanup = cleanupFn;
  const tmpPath = latestNxTmpPath;
  // Drop the references first so nothing can hand out a directory that is in
  // the middle of being deleted.
  latestNxTmpPath = null;
  cleanupFn = null;

  if (!cleanup) {
    return;
  }

  serverLogger.log(
    '[LATEST-NX]: Cleaning up latest Nx installation from',
    tmpPath
  );

  try {
    await withTimeout(cleanup(), CLEANUP_TIMEOUT_MS);
    serverLogger.log('[LATEST-NX]: Cleaned up latest Nx installation');
  } catch (e) {
    // Report the failure rather than exiting on a log line that claims a
    // cleanup which did not happen.
    serverLogger.log(
      '[LATEST-NX]: Failed to clean up latest Nx installation from',
      tmpPath,
      e.message
    );
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  // When the timeout wins the race nothing else is left awaiting `promise`, so
  // a late rejection would surface as an unhandledRejection.
  promise.catch(() => {});

  let timer: NodeJS.Timeout;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timed out after ${ms}ms`)),
          ms
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
