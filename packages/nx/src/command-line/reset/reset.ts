import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { daemonClient } from '../../daemon/client/client';
import { DAEMON_DIR_FOR_CURRENT_WORKSPACE } from '../../daemon/tmp-dir';
import {
  cacheDir,
  cacheDirectoryForWorkspace,
  sharedDataDirectory,
  workspaceDataDirectory,
  workspaceDataDirectoryForWorkspace,
} from '../../utils/cache-directory';
import { output } from '../../utils/output';
import { getNativeFileCacheLocationToDelete } from '../../native/native-file-cache-location';
import { workspaceRoot } from '../../utils/workspace-root';
import { ResetCommandOptions } from './command-object';
import { getCloudClient } from '../../nx-cloud/utilities/client';
import { getCloudOptions } from '../../nx-cloud/utilities/get-cloud-options';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { readNxJson } from '../../config/configuration';
import { getBundleInstallDefaultLocation as getCloudClientLocation } from '../../nx-cloud/update-manager';

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

  const nxJson = readNxJson();
  const cloudEnabled = isNxCloudUsed(nxJson);

  const startupMessage = all
    ? 'Resetting the Nx cache and stopping the daemon.'
    : 'Resetting:';
  const bodyLines = [];
  if (!all) {
    if (args.onlyDaemon) {
      bodyLines.push('- Nx Daemon and its workspace data');
    }
    if (args.onlyCache) {
      bodyLines.push('- Cache directory');
    }
    if (args.onlyWorkspaceData) {
      bodyLines.push('- Workspace data directory');
    }
    if (args.onlyCloud && cloudEnabled) {
      bodyLines.push('- Nx Cloud Client');
    }
  }
  output.note({ title: startupMessage, bodyLines });

  if (all || args.onlyDaemon) {
    try {
      await killDaemon();
    } catch (e) {
      errors.push('Failed to stop the Nx Daemon.', e.toString());
    }
    try {
      await cleanupDaemonWorkspaceData();
    } catch (e) {
      errors.push(
        'Failed to clean up the daemon workspace data directory.',
        e.toString()
      );
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
  if ((cloudEnabled && all) || args.onlyCloud) {
    try {
      await resetCloudClient();
      await removeInstalledNxCloudClient();
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

function cleanupDaemonWorkspaceData() {
  return incrementalBackoff(
    INCREMENTAL_BACKOFF_FIRST_DELAY,
    INCREMENTAL_BACKOFF_MAX_DURATION,
    () => {
      rmSync(DAEMON_DIR_FOR_CURRENT_WORKSPACE, {
        recursive: true,
        force: true,
      });
    }
  );
}

async function resetCloudClient() {
  // Remove nx cloud marker files. This helps if the use happens to run `nx-cloud start-ci-run` or
  // similar commands on their local machine.
  try {
    (await getCloudClient(getCloudOptions())).invoke('cleanup');
  } catch {}
}

function removeInstalledNxCloudClient() {
  return incrementalBackoff(
    INCREMENTAL_BACKOFF_FIRST_DELAY,
    INCREMENTAL_BACKOFF_MAX_DURATION,
    () => {
      const cloudClientDir = getCloudClientLocation();
      rmSync(join(cloudClientDir, 'cloud'), { recursive: true, force: true });
    }
  );
}

function cleanupCacheEntries() {
  return incrementalBackoff(
    INCREMENTAL_BACKOFF_FIRST_DELAY,
    INCREMENTAL_BACKOFF_MAX_DURATION,
    () => {
      rmSync(cacheDir, { recursive: true, force: true });
      // `cacheDir` is the shared directory whenever sharing is available, so
      // this is the checkout's own `.nx/cache`: still there from before the
      // move, and still what a later run falls back to if `~/.nx` stops being
      // reachable. Reset means both.
      removeIfDistinct(cacheDirectoryForWorkspace(workspaceRoot), cacheDir);
    }
  );
}

/** Skips the no-op when the two resolve to one directory. */
function removeIfDistinct(dir: string, from: string) {
  if (dir !== from) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function cleanupNativeFileCache() {
  return incrementalBackoff(
    INCREMENTAL_BACKOFF_FIRST_DELAY,
    INCREMENTAL_BACKOFF_MAX_DURATION,
    () => {
      // Null when the native cache root is not a real directory we own, which
      // would mean deleting through a path another user planted.
      const cacheDir = getNativeFileCacheLocationToDelete();
      if (cacheDir) {
        rmSync(cacheDir, { recursive: true, force: true });
      }
    }
  );
}

function cleanupWorkspaceData() {
  return incrementalBackoff(
    INCREMENTAL_BACKOFF_FIRST_DELAY,
    INCREMENTAL_BACKOFF_MAX_DURATION,
    () => {
      rmSync(workspaceDataDirectory, { recursive: true, force: true });

      // Also clean wherever the DB actually lives, which is outside this
      // checkout whenever the shared root is reachable. Resolved through the
      // same decision the DB itself uses, so reset cannot delete a directory
      // this process never wrote to -- a sandboxed agent that fell back to its
      // own checkout, or a configured location, yields nothing extra.
      removeIfDistinct(
        sharedDataDirectory(
          workspaceRoot,
          'workspace-data',
          workspaceDataDirectoryForWorkspace
        ),
        workspaceDataDirectory
      );
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
