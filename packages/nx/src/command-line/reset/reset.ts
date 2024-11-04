import { rmSync } from 'node:fs';
import { daemonClient } from '../../daemon/client/client';
import { cacheDir, workspaceDataDirectory } from '../../utils/cache-directory';
import { output } from '../../utils/output';
import { getNativeFileCacheLocation } from '../../native/native-file-cache-location';
import { ResetCommandOptions } from './command-object';

import { getCloudClient } from '../../nx-cloud/utilities/client';
import { getCloudOptions } from '../../nx-cloud/utilities/get-cloud-options';

// Wait at max 5 seconds before giving up on a failing operation.
const INCREMENTAL_BACKOFF_MAX_DURATION = 5000;

// If an operation fails, wait 100ms before first retry.
const INCREMENTAL_BACKOFF_FIRST_DELAY = 100;

export async function resetHandler(args: ResetCommandOptions) {
  let errors = [];

  const all =
    args.onlyDaemon === undefined &&
    args.onlyCache === undefined &&
    args.onlyWorkspaceData === undefined;

  const startupMessage = all
    ? 'Resetting the Nx cache and stopping the daemon.'
    : 'Resetting:';
  const bodyLines = [];
  if (!all) {
    if (args.onlyDaemon) {
      bodyLines.push('- Nx Daemon');
    }
    if (args.onlyCache) {
      bodyLines.push('- Cache directory');
    }
    if (args.onlyWorkspaceData) {
      bodyLines.push('- Workspace data directory');
    }
  }
  output.note({ title: startupMessage, bodyLines });

  if (all || args.onlyDaemon) {
    try {
      await killDaemon();
    } catch (e) {
      errors.push('Failed to stop the Nx Daemon.', e.toString());
    }
  }
  if (all || args.onlyCache) {
    try {
      await cleanupCacheEntries();
    } catch (e) {
      errors.push('Failed to clean up the cache directory.', e.toString());
    }
  }
  if (all || args.onlyWorkspaceData) {
    try {
      await cleanupNativeFileCache();
    } catch {
      // ignore, deleting the native file cache is not critical and can fail if another process is locking the file
    }
    try {
      await cleanupWorkspaceData();
    } catch (e) {
      errors.push(
        'Failed to clean up the workspace data directory.',
        e.toString()
      );
    }
  }
  if (all || args.onlyCloud) {
    try {
      await resetCloudClient();
    } catch (e) {
      errors.push('Failed to reset the Nx Cloud client.', e.toString());
    }
  }
  if (errors.length > 0) {
    output.error({
      title: 'Failed to reset the Nx workspace.',
      bodyLines: errors,
    });
    process.exit(1);
  } else {
    output.success({
      title: 'Successfully reset the Nx workspace.',
    });
  }
}

async function killDaemon(): Promise<void> {
  if (daemonClient.enabled()) {
    return daemonClient.stop();
  }
}

async function resetCloudClient() {
  // Remove nx cloud marker files. This helps if the use happens to run `nx-cloud start-ci-run` or
  // similar commands on their local machine.
  try {
    (await getCloudClient(getCloudOptions())).invoke('cleanup');
  } catch {}
}

function cleanupCacheEntries() {
  return incrementalBackoff(
    INCREMENTAL_BACKOFF_FIRST_DELAY,
    INCREMENTAL_BACKOFF_MAX_DURATION,
    () => {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  );
}

function cleanupNativeFileCache() {
  return incrementalBackoff(
    INCREMENTAL_BACKOFF_FIRST_DELAY,
    INCREMENTAL_BACKOFF_MAX_DURATION,
    () => {
      rmSync(getNativeFileCacheLocation(), { recursive: true, force: true });
    }
  );
}

function cleanupWorkspaceData() {
  return incrementalBackoff(
    INCREMENTAL_BACKOFF_FIRST_DELAY,
    INCREMENTAL_BACKOFF_MAX_DURATION,
    () => {
      rmSync(workspaceDataDirectory, { recursive: true, force: true });
    }
  );
}

async function incrementalBackoff(
  ms: number,
  maxDuration: number,
  callback: () => void
) {
  try {
    callback();
  } catch (e) {
    if (ms < maxDuration) {
      await sleep(ms);
      await incrementalBackoff(ms * 2, maxDuration, callback);
    } else {
      throw e;
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
