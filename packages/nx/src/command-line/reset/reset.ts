import { rmSync } from 'node:fs';

import { daemonClient } from '../../daemon/client/client';
import { DAEMON_DIR_FOR_CURRENT_WORKSPACE } from '../../daemon/tmp-dir';
import {
  cacheDir,
  cacheDirectoryForWorkspace,
  sharedDataDirectory,
  workspaceDataDirectory,
} from '../../utils/cache-directory';
import { output } from '../../utils/output';
import { globalSpinner } from '../../utils/spinner';
import { getNativeFileCacheLocationToDelete } from '../../native/native-file-cache-location';
import { workspaceRoot } from '../../utils/workspace-root';
import { ResetCommandOptions } from './command-object';
import { getCloudClient } from '../../nx-cloud/utilities/client';
import { getCloudOptions } from '../../nx-cloud/utilities/get-cloud-options';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { readNxJson } from '../../config/configuration';
import { removeDbConnections } from '../../utils/db-connection';
import { getBundleInstallDefaultLocation as getCloudClientLocation } from '../../nx-cloud/update-manager';
import { removeStaleTempInstallDirectories } from '../../utils/package-manager';

// Wait at max 5 seconds before giving up on a failing operation.
const INCREMENTAL_BACKOFF_MAX_DURATION = 5000;

// If an operation fails, wait 100ms before first retry.
const INCREMENTAL_BACKOFF_FIRST_DELAY = 100;

export async function resetHandler(args: ResetCommandOptions) {
  const errors: string[] = [];

  const all =
    args.onlyDaemon === undefined &&
    args.onlyCache === undefined &&
    args.onlyWorkspaceData === undefined;

  const nxJson = readNxJson();
  const cloudEnabled = isNxCloudUsed(nxJson);

  if (all || args.onlyDaemon) {
    await runResetStep(errors, {
      start: 'Stopping the Nx Daemon',
      success: 'Stopped the Nx Daemon',
      failure: 'Failed to stop the Nx Daemon.',
      run: killDaemon,
    });
    await runResetStep(errors, {
      start: 'Removing the Nx Daemon workspace data',
      success: 'Removed the Nx Daemon workspace data',
      failure: 'Failed to clean up the daemon workspace data directory.',
      run: cleanupDaemonWorkspaceData,
    });
  }
  if (all || args.onlyCache) {
    await runResetStep(errors, {
      start: 'Removing the cache directory',
      success: 'Removed the cache directory',
      failure: 'Failed to clean up the cache directory.',
      run: cleanupCacheEntries,
    });
  }
  if (all || args.onlyWorkspaceData) {
    await runResetStep(errors, {
      start: 'Removing the workspace data directory',
      success: 'Removed the workspace data directory',
      failure: 'Failed to clean up the workspace data directory.',
      run: async () => {
        try {
          await cleanupNativeFileCache();
        } catch {
          // ignore, deleting the native file cache is not critical and can fail if another process is locking the file
        }
        await cleanupWorkspaceData();
      },
    });
  }
  if (all) {
    await runResetStep(errors, {
      start: 'Removing stale temporary package installs',
      success: 'Removed stale temporary package installs',
      failure: 'Failed to remove stale temporary package installs.',
      run: async () => removeStaleTempInstallDirectories(),
    });
  }
  if ((cloudEnabled && all) || args.onlyCloud) {
    await runResetStep(errors, {
      start: 'Cleaning up the Nx Cloud client',
      success: 'Cleaned up the Nx Cloud client',
      failure: 'Failed to clean up the Nx Cloud client.',
      run: resetCloudClient,
    });
    await runResetStep(errors, {
      start: 'Removing the installed Nx Cloud client',
      success: 'Removed the installed Nx Cloud client',
      failure: 'Failed to reset the Nx Cloud client.',
      run: removeInstalledNxCloudClient,
    });
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

/** Records a failure in `errors` so the remaining steps still run. */
async function runResetStep(
  errors: string[],
  step: {
    start: string;
    success: string;
    failure: string;
    run: () => Promise<void>;
  }
) {
  globalSpinner.start(step.start);
  try {
    await step.run();
    globalSpinner.succeed(step.success);
  } catch (e) {
    globalSpinner.fail(step.failure);
    errors.push(step.failure, e.toString());
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
  // `exit` would end the process here, before reset reports its result.
  await (await getCloudClient(getCloudOptions())).invoke('cleanup', false);
}

function removeInstalledNxCloudClient() {
  return incrementalBackoff(
    INCREMENTAL_BACKOFF_FIRST_DELAY,
    INCREMENTAL_BACKOFF_MAX_DURATION,
    () => {
      rmSync(getCloudClientLocation(), { recursive: true, force: true });
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
      // Analytics opened the DB at startup; Windows cannot delete an open file.
      removeDbConnections();
      rmSync(workspaceDataDirectory, { recursive: true, force: true });

      // Also clean wherever the DB actually lives, which is outside this
      // checkout whenever the shared root is reachable. Resolved through the
      // same decision the DB itself uses, so reset cannot delete a directory
      // this process never wrote to -- a sandboxed agent that fell back to its
      // own checkout, or a configured location, yields nothing extra.
      removeIfDistinct(
        sharedDataDirectory(workspaceRoot, 'workspace-data'),
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
