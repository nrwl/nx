import { installPackageToTmpAsync } from '../../devkit-internals';
import { serverLogger } from '../logger';

// Module-level state - persists across invocations within daemon lifecycle
let latestNxTmpPath: string | null = null;
let cleanupFn: (() => void) | null = null;
let installPromise: Promise<string> | null = null;

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
      const result = await installPackageToTmpAsync('nx', 'latest');
      latestNxTmpPath = result.tempDir;
      cleanupFn = result.cleanup;
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
 */
export function cleanupLatestNx(): void {
  if (cleanupFn) {
    serverLogger.log(
      '[LATEST-NX]: Cleaning up latest Nx installation from',
      latestNxTmpPath
    );
    cleanupFn();
  }
  latestNxTmpPath = null;
  cleanupFn = null;
}
